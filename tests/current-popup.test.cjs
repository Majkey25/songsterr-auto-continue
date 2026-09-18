// Regression coverage for the failure observed on live Songsterr.
//
// The prompt below is the exact DOM captured from www.songsterr.com during free Original
// Audio playback. On the live site the page swallows clicks that arrive before its own
// handler is effective: the click is cancelled (preventDefault + stopPropagation) but the
// prompt is not dismissed. Version 0.1.7 read that cancellation as success, recorded the
// target as handled and never tried again, so the prompt stayed on screen forever.
//
// Every assertion here is therefore about the prompt being *gone*, never about a click
// having happened.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdir, mkdtemp, rm } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const livePrompt = `<form role="dialog" class="w_eHuW_modal e7HakW_enter"><div class="_2e9mvq_popup"><div class="_2e9mvq_body"><div class="w_eHuW_contentBase w_eHuW_content"><p>Upgrade to Plus for Original audio without sync pauses</p></div><p class="w_eHuW_synthText">Or switch to Synth audio</p></div><div class="_2e9mvq_footer"><div class="_2e9mvq_actions"><button aria-label="Use Synth" type="button" tabindex="0" class="qzgWxW_button qzgWxW_actionsButton"><span>Use Synth</span></button><a href="/plus" class="qzgWxW_button qzgWxW_button qzgWxW_buttonSubmit">Upgrade</a></div><div class="_2e9mvq_afterButtons"><p class="w_eHuW_continueLink">Or <a href="">continue with sync pauses</a></p></div></div></div></form>`;

// Runs in the page. Reproduces the live lifecycle: until the page is ready, a click on the
// continue link is cancelled and does nothing; once ready it dismisses the prompt.
function mountPrompt(html, readyAfterMs) {
  const host = document.querySelector("#app");
  host.innerHTML = html;
  const form = host.querySelector('[role="dialog"]');
  const link = [...form.querySelectorAll("a")].find((a) => /continue with sync pauses/i.test(a.textContent));
  window.swallowed = 0;
  window.forbidden = [];
  let ready = readyAfterMs === 0;
  if (!ready) setTimeout(() => { ready = true; }, readyAfterMs);

  for (const control of form.querySelectorAll("a,button")) {
    if (control === link) continue;
    control.addEventListener("click", (event) => {
      event.preventDefault();
      window.forbidden.push((control.textContent || "").trim());
    });
  }
  if (!link) return;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!ready) { window.swallowed += 1; return; }
    form.remove();
  });
}

const mount = (page, html, readyAfterMs) =>
  page.evaluate(
    ([source, markup, delay]) => new Function(`return (${source})`)()(markup, delay),
    [mountPrompt.toString(), html, readyAfterMs],
  );

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
    body: '<!doctype html><html><body><main id="app"></main></body></html>',
  }));
  try {
    await page.goto("https://www.songsterr.com/a/wsa/test-tab-s1");
    await fn(page);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}

const dismissed = (page) =>
  page.waitForFunction(() => document.querySelector('[role="dialog"]') === null, undefined, { timeout: 25000 });

const assertSafe = async (page) =>
  assert.deepEqual(await page.evaluate(() => window.forbidden), []);

// The live failure: Songsterr's handler is not effective the instant the prompt is inserted.
for (const readyAfterMs of [0, 100, 500, 2000]) {
  test(`dismisses the live prompt when the page becomes ready after ${readyAfterMs}ms`, async () => {
    await withBrowser(async (page) => {
      await mount(page, livePrompt, readyAfterMs);
      await dismissed(page);
      await assertSafe(page);
      if (readyAfterMs > 0) {
        assert.ok(
          (await page.evaluate(() => window.swallowed)) > 0,
          "fixture should have swallowed at least one early click",
        );
      }
    });
  });
}

test("dismisses replacement prompts for the whole session", async () => {
  await withBrowser(async (page) => {
    for (let round = 0; round < 3; round += 1) {
      await mount(page, livePrompt, 300);
      await dismissed(page);
      await assertSafe(page);
    }
  });
});

// The retry bookkeeping is per prompt. 100 cycles with varying readiness proves it is
// reset for every new prompt instead of leaking state from the previous one.
test("handles 100 consecutive prompts with varying readiness", async () => {
  await withBrowser(async (page) => {
    for (let round = 0; round < 100; round += 1) {
      await mount(page, livePrompt, [0, 50, 120, 250, 400][round % 5]);
      await dismissed(page);
    }
    await assertSafe(page);
  });
});

test("leaves Upgrade and Use Synth alone when the continue action is absent", async () => {
  await withBrowser(async (page) => {
    await mount(page, livePrompt.replace(/<p class="w_eHuW_continueLink">.*?<\/p>/, ""), 0);
    await page.waitForTimeout(3000);
    await assertSafe(page);
    assert.equal(await page.locator('[role="dialog"]').count(), 1);
  });
});
