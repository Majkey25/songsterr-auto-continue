const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const extension = path.resolve("extension");
const sender = { id: "extension-id", frameId: 0, documentId: "document-id", tab: { id: 7 }, url: "https://www.songsterr.com/a/wsa/test" };

function worker({ url = sender.url, point = { x: 10, y: 20 }, errorAt, cancelAt, expireAt, armed = true, pauseAt } = {}) {
  const calls = [];
  let listener;
  let navigation;
  let deadline;
  let resume;
  let paused = false;
  let signalPaused;
  const ready = new Promise((resolve) => { signalPaused = resolve; });
  const pause = async (method) => {
    if (method === pauseAt && !paused) {
      paused = true;
      signalPaused();
      await new Promise((resolve) => { resume = resolve; });
    }
  };
  const context = vm.createContext({
    console,
    setTimeout: (fn) => { deadline = fn; return 1; },
    clearTimeout: () => { deadline = undefined; },
    chrome: {
      runtime: { id: sender.id, onMessage: { addListener: (fn) => { listener = fn; } } },
      tabs: { sendMessage: async (tabId, message, options) => {
        assert.equal(tabId, sender.tab.id);
        assert.equal(options.documentId, sender.documentId);
        return armed;
      } },
      debugger: {
        onEvent: { addListener: (fn) => { navigation = fn; }, removeListener: () => { navigation = undefined; } },
        attach: async (target) => { calls.push({ method: "attach", target }); },
        detach: async (target) => { calls.push({ method: "detach", target }); await pause("detach"); },
        sendCommand: async (target, method, params) => {
          calls.push({ method, target, params });
          await pause(method);
          if (method === cancelAt) navigation(target, "Page.frameStartedLoading", { frameId: "main" });
          if (method === expireAt) deadline();
          if (method === errorAt) throw new Error("debugger cancelled");
          if (method === "Page.getFrameTree") return { frameTree: { frame: { id: "main", url } } };
          if (method === "Page.createIsolatedWorld") return { executionContextId: 3 };
          if (method === "Runtime.evaluate") return { result: { value: point } };
          return {};
        },
      },
    },
    importScripts: (file) => vm.runInContext(readFileSync(path.join(extension, file), "utf8"), context),
  });
  vm.runInContext(readFileSync(path.join(extension, "background.js"), "utf8"), context);
  const request = (message, origin) => new Promise((resolve) => {
    if (!listener(message, origin, resolve)) resolve(undefined);
  });
  return { calls, request, ready, resume: () => resume() };
}

test("debugger rejects messages outside the top-level Songsterr content script", async () => {
  const { calls, request } = worker();
  for (const origin of [
    { ...sender, id: "another-extension" },
    { ...sender, frameId: 1 },
    { ...sender, documentId: undefined },
    { ...sender, tab: undefined },
    { ...sender, url: "https://www.songsterr.com.evil.example/" },
    { ...sender, url: "http://www.songsterr.com/" },
    { ...sender, url: "chrome-extension://extension-id/page.html" },
  ]) assert.equal(await request("continue", origin), undefined);
  assert.equal(await request({ command: "continue", tabId: 99, x: 100 }, sender), undefined);
  assert.equal(calls.length, 0);
});

test("debugger rechecks origin, target, and finite coordinates before sending input", async () => {
  for (const options of [{ url: "https://example.com/" }, { point: null }, { point: { x: NaN, y: 20 } }, { armed: false }]) {
    const { calls, request } = worker(options);
    await request("continue", sender);
    assert.ok(!calls.some((call) => call.method.startsWith("Input.")));
    assert.equal(calls.at(-1).method, "detach");
  }
});

test("debugger uses the sender tab and always detaches after success or error", async () => {
  for (const errorAt of [undefined, "Runtime.evaluate"]) {
    const { calls, request } = worker({ errorAt });
    const response = await request("continue", sender);
    assert.equal(Boolean(response.error), Boolean(errorAt));
    assert.ok(calls.every((call) => call.target.tabId === sender.tab.id));
    assert.equal(calls.at(-1).method, "detach");
    if (!errorAt) {
      assert.deepEqual(calls.filter((call) => call.method === "Input.dispatchMouseEvent")
        .map((call) => call.params.type), ["mousePressed", "mouseReleased"]);
      assert.equal(calls.find((call) => call.method === "Runtime.evaluate").params.contextId, 3);
    }
  }
});

test("navigation and the worker deadline cancel input after validation", async () => {
  for (const options of [{ cancelAt: "Runtime.evaluate" }, { expireAt: "Runtime.evaluate" }]) {
    const { calls, request } = worker(options);
    const response = await request("continue", sender);
    if (options.expireAt) assert.match(response.error, /cancelled/);
    else assert.equal(response.error, undefined);
    assert.ok(!calls.some((call) => call.method.startsWith("Input.")));
    assert.equal(calls.filter((call) => call.method === "detach").length, 1);
  }
});

test("a new document waits until the previous request has detached from the same tab", async () => {
  const { calls, request, ready, resume } = worker({ pauseAt: "Runtime.evaluate" });
  const first = request("continue", sender);
  await ready;
  const busy = await request("continue", { ...sender, documentId: "new-document" });
  assert.equal(busy.ok, false);
  assert.equal(calls.filter((call) => call.method === "attach").length, 1);
  resume();
  await first;
  await new Promise(setImmediate);
  await request("continue", sender);
  assert.equal(calls.filter((call) => call.method === "attach").length, 2);
});

test("navigation after mousePressed sends no release into the new document", async () => {
  const { calls, request } = worker({ cancelAt: "Input.dispatchMouseEvent" });
  await request("continue", sender);
  assert.deepEqual(calls.filter((call) => call.method.startsWith("Input.")).map((call) => call.params.type), ["mousePressed"]);
  assert.equal(calls.filter((call) => call.method === "detach").length, 1);
});

test("navigation keeps the tab locked until the original detach promise settles", async () => {
  const { calls, request, ready, resume } = worker({ cancelAt: "Runtime.evaluate", pauseAt: "detach" });
  let finished = false;
  const first = request("continue", sender).then(() => { finished = true; });
  await ready;
  await new Promise(setImmediate);
  assert.equal(finished, false, "the request must await its in-flight detach");
  const busy = await request("continue", { ...sender, documentId: "new-document" });
  assert.equal(busy.ok, false);
  resume();
  await first;
  assert.equal(calls.filter((call) => call.method === "detach").length, 1);
});
