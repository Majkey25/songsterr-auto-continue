const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdir, mkdtemp, rm } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const modal = `<form role="dialog" style="display:none"><div>
  <p>Upgrade to Plus for Original audio without sync pauses</p>
  <p>Or switch to Synth audio</p>
  <button type="button">Use Synth</button>
  <a href="/plus">Upgrade</a>
  <p>Or <a href="">continue with sync pauses</a></p>
</div></form>`;

async function withBrowser(fn) {
  const temporary = path.resolve(".reference/tmp");
  await mkdir(temporary, { recursive: true });
  const profile = await mkdtemp(path.join(temporary, "visibility-"));
  const extension = path.resolve("extension");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const page = await context.newPage();
  await context.route("https://www.songsterr.com/**", (route) => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><main id="app"></main>',
  }));
  try {
    await page.goto("https://www.songsterr.com/a/wsa/test-tab-s1");
    await fn(page);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}

test("clicks when an already-mounted dialog becomes visible by attribute change", async () => {
  await withBrowser(async (page) => {
    await page.evaluate(() => {
      window.continuations = 0;
      document.addEventListener("click", (event) => {
        const target = event.target.closest("a,button");
        if (target?.textContent.trim().toLowerCase() === "continue with sync pauses") {
          event.preventDefault();
          window.continuations++;
        }
      }, true);
    });
    await page.evaluate((html) => document.querySelector("#app").insertAdjacentHTML("beforeend", html), modal);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.continuations), 0);
    await page.evaluate(() => { document.querySelector('[role="dialog"]').style.display = "block"; });
    await page.waitForFunction(() => window.continuations === 1, undefined, { timeout: 1000 });
  });
});

test("retries a recognized prompt if the site's click handler attaches late", async () => {
  await withBrowser(async (page) => {
    await page.evaluate(() => { window.activations = 0; });

    for (let i = 1; i <= 8; i++) {
      await page.evaluate(({ html, delayed }) => {
        const app = document.querySelector("#app");
        app.innerHTML = html.replace('style="display:none"', 'style="display:block"');
        const dialog = app.querySelector('[role="dialog"]');
        const target = dialog.querySelector('a[href=""]');
        const attach = () => target.addEventListener("click", (event) => {
          event.preventDefault();
          window.activations++;
          dialog.remove();
        }, { once: true });
        if (delayed) setTimeout(attach, 250);
        else attach();
      }, { html: modal, delayed: i % 4 === 0 });

      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 1500 });
      assert.equal(await page.evaluate(() => window.activations), i);
    }
  });
});
