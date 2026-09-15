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

test("clicks when an already-mounted dialog becomes visible by attribute change", async () => {
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
  await context.addInitScript(() => {
    window.continuations = 0;
    document.addEventListener("click", (event) => {
      const target = event.target.closest("a,button");
      if (target?.textContent.trim().toLowerCase() === "continue with sync pauses") {
        event.preventDefault();
        window.continuations++;
      }
    }, true);
  });

  try {
    await page.goto("https://www.songsterr.com/a/wsa/test-tab-s1");
    await page.evaluate((html) => {
      document.querySelector("#app").insertAdjacentHTML("beforeend", html);
    }, modal);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.continuations), 0);

    await page.evaluate(() => {
      document.querySelector('[role="dialog"]').style.display = "block";
    });

    await page.waitForFunction(() => window.continuations === 1, undefined, { timeout: 1000 });
    assert.equal(await page.evaluate(() => window.continuations), 1);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
