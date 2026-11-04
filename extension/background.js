"use strict";

importScripts("target.js");

const activeTabs = new Set();
const maxActiveTabs = 16;

// Coordinates come from fresh validation, never from a message or the page's scripts.
const targetExpression = `(() => {
  const target = (${findContinueTarget})();
  if (!target) return null;
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
  const rect = target.getBoundingClientRect();
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  return target.contains(document.elementFromPoint(x, y)) ? { x, y } : null;
})()`;

async function continuePlayback(tabId, documentId) {
  const debuggee = { tabId };
  await chrome.debugger.attach(debuggee, "1.3");
  let detachPromise;
  let stopReason = "";
  let frameId;
  let loaderId;
  const detach = () => detachPromise ??= chrome.debugger.detach(debuggee);
  const cancel = (reason) => {
    stopReason = reason;
    detach().catch((error) => console.warn("Songsterr Auto Continue:", error.message));
  };
  const navigation = (source, method, params) => {
    if (source.tabId === tabId && ((method === "Page.frameStartedLoading" && params.frameId === frameId) ||
      (method === "Page.frameNavigated" && !params.frame.parentId && params.frame.loaderId !== loaderId))) cancel("navigation");
  };
  const deadline = setTimeout(() => cancel("timeout"), 12000);
  try {
    await chrome.debugger.sendCommand(debuggee, "Page.enable");
    const { frameTree } = await chrome.debugger.sendCommand(debuggee, "Page.getFrameTree");
    if (!frameTree.frame.url.startsWith("https://www.songsterr.com/")) return;
    frameId = frameTree.frame.id;
    loaderId = frameTree.frame.loaderId;
    chrome.debugger.onEvent.addListener(navigation);
    const { executionContextId } = await chrome.debugger.sendCommand(debuggee, "Page.createIsolatedWorld", {
      frameId, worldName: "songsterr-auto-continue",
    });
    const { result, exceptionDetails } = await chrome.debugger.sendCommand(debuggee, "Runtime.evaluate", {
      expression: targetExpression, contextId: executionContextId, returnByValue: true,
    });
    if (exceptionDetails) throw new Error("Could not validate the continuation control");
    const point = result?.value;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const armed = await chrome.tabs.sendMessage(tabId, { type: "arm", ...point }, { documentId });
    if (!armed) return;
    if (stopReason) throw new Error(`Continuation cancelled after ${stopReason}`);
    await chrome.debugger.sendCommand(debuggee, "Input.dispatchMouseEvent", {
      type: "mousePressed", ...point, button: "left", buttons: 1, clickCount: 1,
    });
    if (stopReason) throw new Error(`Continuation cancelled after ${stopReason}`);
    await chrome.debugger.sendCommand(debuggee, "Input.dispatchMouseEvent", {
      type: "mouseReleased", ...point, button: "left", buttons: 0, clickCount: 1,
    });
  } catch (error) {
    if (stopReason !== "navigation") throw error;
  } finally {
    clearTimeout(deadline);
    chrome.debugger.onEvent.removeListener(navigation);
    await detach();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message !== "continue" || sender.id !== chrome.runtime.id || sender.frameId !== 0 ||
    !sender.documentId || !Number.isInteger(sender.tab?.id) ||
    !sender.url?.startsWith("https://www.songsterr.com/")) return false;
  if (activeTabs.has(sender.tab.id) || activeTabs.size >= maxActiveTabs) {
    sendResponse({ ok: false });
    return false;
  }
  activeTabs.add(sender.tab.id);
  continuePlayback(sender.tab.id, sender.documentId).then(
    () => sendResponse({ ok: true }),
    (error) => sendResponse({ error: error.message }),
  ).finally(() => activeTabs.delete(sender.tab.id));
  return true;
});
