// Optional live smoke check; no accounts, response rewriting, or entitlement changes.
const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const temporary = path.resolve(".reference/tmp");
  await mkdir(temporary, { recursive: true });
  const profile = await mkdtemp(path.join(temporary, "live-"));
  const extension = path.resolve("extension");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium", executablePath: process.argv[2] || undefined, headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript(() => {
    window.continuations = [];
    document.addEventListener("click", (event) => {
      const target = event.target.closest("a,button");
      if (target?.textContent.trim() !== "continue with sync pauses") return;
      const record = { at: performance.now(), trusted: event.isTrusted,
        url: location.href, html: target.closest('[role="dialog"]')?.outerHTML };
      window.continuations.push(record);
      queueMicrotask(() => { record.defaultPrevented = event.defaultPrevented; });
    }, true);
  });
  try {
    await page.goto(process.argv[3] || "https://www.songsterr.com/a/wsa/led-zeppelin-stairway-to-heaven-tab-s27");
    await page.getByRole("button", { name: "Reject All", exact: true }).click({ timeout: 20000 });
    await page.locator('#control-source input[value="original"]').check();
    await page.locator("#control-play").click();
    for (let tick = 0; tick < 6; tick++) {
      try {
        await page.waitForFunction(() => window.continuations.length >= 2, undefined, { timeout: 30000 });
        break;
      } catch (error) {
        if (error.name !== "TimeoutError") throw error;
        console.log("Live playback:", JSON.stringify(await page.evaluate(() => ({
          seconds: Math.round(performance.now()/1000), clicks: window.continuations.length,
          playing: document.querySelector("#control-play")?.getAttribute("aria-pressed"),
          dialog: document.querySelector('[role="dialog"]')?.textContent,
        }))));
        const videoFrame = page.frames().find((frame) => frame.url().startsWith("https://www.youtube.com/embed/"));
        if (videoFrame) console.log("Video:", await videoFrame.evaluate(() => {
          const video = document.querySelector("video");
          return video ? { time: video.currentTime, paused: video.paused, ready: video.readyState } : null;
        }));
      }
    }
    await page.locator('form[role="dialog"]').filter({ hasText: "continue with sync pauses" }).waitFor({ state: "detached", timeout: 3000 });
    const result = await page.evaluate(() => ({
      continuations: window.continuations,
      original: document.querySelector('#control-source input[value="original"]').checked,
      playing: document.querySelector("#control-play")?.getAttribute("aria-pressed"),
      remainingDialogs: document.querySelectorAll('[role="dialog"]').length,
    }));
    result.browser = context.browser().version();
    result.errors = errors;
    await writeFile(path.join(temporary, "live-results.json"), JSON.stringify(result, null, 2));
    await page.screenshot({ path: path.join(temporary, "live-result.png") });
    console.log(JSON.stringify(result, null, 2));
    assert.ok(result.continuations.length >= 2, "Two real interruption cycles were not observed within three minutes");
    assert.ok(result.continuations.every((event) => event.trusted === false));
    assert.ok(result.original, "Original Audio must stay selected");
    assert.equal(result.remainingDialogs, 0);
    await page.locator("#control-play").click();
    assert.equal(await page.locator("#control-play").getAttribute("aria-pressed"), "false");
    // The playing layout can keep the sidebar link outside the viewport.
    await page.locator("#menu-search").evaluate((element) => element.click());
    await page.locator('a[href*="metallica-enter-sandman-tab-s19"]').first().click();
    await page.waitForFunction(() => document.querySelector("#song-ttl")?.textContent === "Enter Sandman" &&
      document.querySelector("#control-play")?.getAttribute("data-can-play") === "true");
    await page.locator('#control-source input[value="original"]').check();
    await page.locator("#control-play").click();
    await page.waitForFunction(() => window.continuations.length >= 3, undefined, { timeout: 60000 });
    await page.locator('form[role="dialog"]').filter({ hasText: "continue with sync pauses" }).waitFor({ state: "detached", timeout: 3000 });
    result.afterNavigation = await page.evaluate(() => ({
      url: location.href, continuations: window.continuations.length,
      original: document.querySelector('#control-source input[value="original"]').checked,
      playing: document.querySelector("#control-play").getAttribute("aria-pressed"),
    }));
    assert.ok(result.afterNavigation.original);
    await writeFile(path.join(temporary, "live-results.json"), JSON.stringify(result, null, 2));
    console.log("SPA continuation:", JSON.stringify(result.afterNavigation));
  } catch (error) {
    console.log("Failure state:", JSON.stringify(await page.evaluate(() => ({
      url: location.href, continuations: window.continuations,
      dialogs: [...document.querySelectorAll('form[role="dialog"]')].map((dialog) => dialog.outerHTML),
    })), null, 2));
    const manual = page.getByRole("link", { name: "continue with sync pauses", exact: true });
    if (await manual.count() === 1) {
      await manual.click();
      await page.waitForTimeout(1000);
      console.log("Manual control comparison:", await page.locator('form[role="dialog"]').count());
    }
    throw error;
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
