const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdir, mkdtemp, rm } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const currentPopup = `<div class="w_eHuW_modal w_eHuW_modalRedesign">
  <div class="_2e9mvq_popup w_eHuW_popupRedesign">
    <p>Plus playback message copy can change</p>
    <p>Or switch to Synth audio</p>
    <div><button type="button">Use Synth</button><a href="/plus">Upgrade</a></div>
    <p class="w_eHuW_continueLink">Or <a href="">continue with sync pauses</a></p>
  </div>
</div>`;

async function withBrowser(fn) {
  const temporary = path.resolve(".reference/tmp");
  await mkdir(temporary, { recursive: true });
  const profile = await mkdtemp(path.join(temporary, "current-popup-"));
  const extension = path.resolve("extension");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const page = await context.newPage();
  await context.route("https://www.songsterr.com/**", (route) => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><main id="apptab"></main>',
  }));
  try {
    await page.goto("https://www.songsterr.com/a/wsa/test-tab-s1");
    await fn(page);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}

test("clicks the current Songsterr continue link without depending on dialog role or headline copy", async () => {
  await withBrowser(async (page) => {
    await page.evaluate(() => { window.continuations = 0; });
    await page.evaluate((html) => {
      const root = document.querySelector("#apptab");
      root.innerHTML = html;
      const popup = root.querySelector(".w_eHuW_modal");
      const target = popup.querySelector(".w_eHuW_continueLink a");
      target.addEventListener("click", (event) => {
        event.preventDefault();
        window.continuations += 1;
        popup.remove();
      }, { once: true });
    }, currentPopup);

    await page.waitForFunction(() => window.continuations === 1, undefined, { timeout: 1000 });
    assert.equal(await page.locator(".w_eHuW_modal").count(), 0);
  });
});
