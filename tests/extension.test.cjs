const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const modal = `<form role="dialog" class="w_eHuW_modal"><div class="_2e9mvq_popup">
  <div><p>Upgrade to Plus for Original audio without sync pauses</p><p>Or switch to Synth audio</p></div>
  <div><button type="button">Use Synth</button><a href="/plus">Upgrade</a></div>
  <p>Or <a href="">continue with sync pauses</a></p></div></form>`;

test("unpacked MV3 extension in a real browser", async (t) => {
  const temporary = path.resolve(".reference/tmp");
  await mkdir(temporary, { recursive: true });
  const profile = await mkdtemp(path.join(temporary, "browser-"));
  const extension = path.resolve("extension");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    executablePath: process.argv[2] || undefined,
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("https://www.songsterr.com/**", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html><head><title>Extension fixture</title></head><body>
      <button id="nearby">Normal control</button><main id="app"></main></body></html>`,
  }));
  // Stands in for Songsterr: it records every activated control and, like the real page,
  // dismisses the prompt when the free continuation is activated. A fixture that recorded
  // clicks but never dismissed anything is what let a non-working release pass CI.
  await context.addInitScript(() => {
    window.clicks = [];
    window.started = 0;
    document.addEventListener("click", (event) => {
      const control = event.target.closest("a,button,[role=button]");
      if (!control) return;
      event.preventDefault();
      window.clicks.push({ text: control.textContent, latency: performance.now() - window.started });
      if ((control.innerText || "").replace(/\s+/gu, " ").trim().toLowerCase() === "continue with sync pauses") {
        control.closest('[role="dialog"], [aria-modal="true"], dialog')?.remove();
      }
    }, true);
  });

  async function reset() {
    await page.goto("https://www.songsterr.com/a/wsa/test-tab-s1");
  }
  async function insert(html) {
    await page.evaluate((html) => {
      window.started = performance.now();
      document.querySelector("#app").insertAdjacentHTML("beforeend", html);
    }, html);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  async function count(expected) {
    if (expected > 0) await page.waitForFunction((expected) => window.clicks.length >= expected, expected);
    else await page.evaluate(() => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    assert.equal(await page.evaluate(() => window.clicks.length), expected);
  }

  try {
    await t.test("current live markup, one click, unchanged neighboring controls", async () => {
      await reset();
      await insert(modal);
      await count(1);
      assert.equal(await page.evaluate(() => window.clicks[0].text), "continue with sync pauses");
      assert.equal(await page.locator('[role="dialog"]').count(), 0, "prompt should be dismissed");
      await count(1);
      await page.locator("#nearby").click();
      await count(2);
    });

    const variants = [
      ["changed classes", modal.replaceAll(/class="[^"]*"/g, 'class="new"')],
      ["whitespace and case", modal.replace("continue with sync pauses", "  CONTINUE\u00a0with\n sync\tpauses  ")],
      ["nested target text", modal.replace("continue with sync pauses", "<span>continue with <b>sync pauses</b></span>")],
      ["button target", modal.replace('<a href="">continue with sync pauses</a>', '<button type="button">continue with sync pauses</button>')],
      ["ARIA button target", modal.replace('<a href="">continue with sync pauses</a>', '<span role="button" tabindex="0">continue with sync pauses</span>')],
      ["aria-modal", modal.replace('role="dialog"', 'aria-modal="true"')],
      // Songsterr has already rewritten this sentence once ("Subscribe to Plus for Original
      // audio syncing without pauses." -> the current copy), so it cannot identify the prompt.
      ["rewritten headline copy", modal.replace("Upgrade to Plus for Original audio without sync pauses", "Go Plus for uninterrupted Original audio")],
      // App devices render an app-store button instead of the /plus link.
      ["upgrade link replaced by an app action", modal.replace('<a href="/plus">Upgrade</a>', "<span>Upgrade in App</span>")],
      ["synth action renamed", modal.replace("Use Synth", "Switch to Synth")],
    ];
    for (const [name, html] of variants) {
      await t.test(name, async () => { await reset(); await insert(html); await count(1); });
    }

    const negatives = [
      ["exact text outside dialog", '<a href="">continue with sync pauses</a>'],
      ["page-wide context", modal.replace('role="dialog"', "")],
      ["unrelated dialog", modal
        .replace("Upgrade to Plus for Original audio without sync pauses", "Account settings")
        .replace("Use Synth", "Cancel")
        .replace('href="/plus"', 'href="/help"')],
      ["near match", modal.replace("continue with sync pauses", "continue with sync pauses please")],
      ["navigation target", modal.replace('href=""', 'href="/plus"')],
      ["form submission", modal.replace('<a href="">continue with sync pauses</a>', '<button>continue with sync pauses</button>')],
      ["hidden dialog", modal.replace('role="dialog"', 'role="dialog" hidden')],
      ["CSS hidden dialog", modal.replace('role="dialog"', 'role="dialog" style="display:none"')],
      ["inert dialog", modal.replace('role="dialog"', 'role="dialog" inert')],
      ["disabled target", modal.replace('href=""', 'href="" aria-disabled="true"')],
      ["hidden context", modal
        .replace("<button type=\"button\">Use Synth", '<button type="button" hidden>Use Synth')
        .replace('href="/plus"', 'href="/help"')],
      ["nested unrelated dialog", modal.replace('<a href="">', '<span role="dialog"><a href="">').replace('pauses</a>', 'pauses</a></span>')],
      ["localized text fails closed", modal.replace("continue with sync pauses", "pokračovat")],
    ];
    for (const [name, html] of negatives) {
      await t.test(name, async () => { await reset(); await insert(html); await count(0); });
    }

    await t.test("delayed target insertion and repeated replacement prompts", async () => {
      await reset();
      await insert(modal.replace('<a href="">continue with sync pauses</a>', ""));
      await count(0);
      await page.evaluate(() => document.querySelector('[role="dialog"] p:last-child')
        .insertAdjacentHTML("beforeend", '<a href="">continue with sync pauses</a>'));
      await count(1);
      await insert(modal);
      await count(2);
    });
    await t.test("late text node and late sibling context", async () => {
      await reset();
      await insert(modal
        .replace("continue with sync pauses", "pending")
        .replace("Use Synth", "pending")
        .replace('href="/plus"', 'href="/help"'));
      await page.evaluate(() => {
        document.querySelector('a[href=""]').firstChild.data = "continue with sync pauses";
      });
      await count(0);
      await page.evaluate(() => { document.querySelector('[role="dialog"] button').firstChild.data = "Use Synth"; });
      await count(1);
    });
    await t.test("SPA root replacement and detached nodes", async () => {
      await reset();
      await page.evaluate(() => {
        history.pushState({}, "", "/a/wsa/next-tab-s2");
        document.querySelector("#app").outerHTML = '<main id="app"></main>';
      });
      await insert(modal);
      await count(1);
      await page.evaluate((html) => {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = html;
        document.body.append(wrapper);
        wrapper.remove();
      }, modal);
      await count(1);
    });
    await t.test("page finishes mounting before the single click", async () => {
      await reset();
      await page.evaluate((html) => {
        document.querySelector("#app").innerHTML = html;
        queueMicrotask(() => document.querySelector('a[href=""]').addEventListener("click", () => {
          document.querySelector('[role="dialog"]')?.remove();
        }));
      }, modal);
      await page.locator('[role="dialog"]').waitFor({ state: "detached" });
      await count(1);
    });
    await t.test("revalidates against DOM changes before observer delivery", async () => {
      await reset();
      await page.evaluate((html) => {
        document.querySelector("#app").innerHTML = html;
        queueMicrotask(() => { document.querySelector('a[href=""]').textContent = "Upgrade"; });
      }, modal);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await count(0);
    });
    await t.test("CSS animation does not impose an artificial wait", async () => {
      await reset();
      await page.evaluate((html) => {
        window.started = performance.now();
        document.querySelector("#app").innerHTML = '<style>@keyframes enter {from {opacity:.5} to {opacity:1}} form {animation: enter 2s}</style>' + html;
      }, modal);
      await count(1);
      assert.ok((await page.evaluate(() => window.clicks[0].latency)) < 150);
    });
    await t.test("hashed entry classes do not control readiness", async () => {
      await reset();
      await page.evaluate((html) => {
        window.started = performance.now();
        document.querySelector("#app").innerHTML = html.replace('class="w_eHuW_modal"', 'class="anything_enter anything_enterActive"');
      }, modal);
      await count(1);
      assert.ok((await page.evaluate(() => window.clicks[0].latency)) < 150);
    });
    await t.test("another origin is excluded by the manifest", async () => {
      await context.route("https://example.com/**", (route) => route.fulfill({
        contentType: "text/html", body: `<!doctype html><main id="app">${modal}</main>`,
      }));
      await page.goto("https://example.com/");
      await insert(modal);
      await count(0);
    });
    await t.test("200 insertion-to-click measurements", async () => {
      await reset();
      for (let i = 0; i < 200; i++) {
        await page.evaluate(() => document.querySelector("#app").replaceChildren());
        await insert(modal);
        await count(i + 1);
      }
      await count(200);
      const values = await page.evaluate(() => window.clicks.map((click) => click.latency).sort((a,b) => a-b));
      const result = { browser: context.browser().version(), runs: values.length,
        min: values[0], median: (values[99] + values[100]) / 2, p95: values[189], max: values[199] };
      console.log("Insertion latency (ms):", JSON.stringify(result));
      await writeFile(path.join(temporary, process.argv[2] ? "brave-results.json" : "chromium-results.json"), JSON.stringify(result, null, 2));
    });
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});