const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdir, mkdtemp, readFile, rm } = require("node:fs/promises");
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

// Detection stays event-driven. Activation cannot be, because the moment Songsterr's own
// handler becomes effective produces no DOM change to observe - see docs/engineering.md.
// What must hold is that the first activation is immediate, retries are rate limited rather
// than a busy loop, and they stop the moment the prompt is gone.
test("detection is event-driven and never keyed to animation state", async () => {
  const source = await readFile(path.resolve("extension/content.js"), "utf8");

  assert.match(source, /MutationObserver/);
  for (const guess of ["setInterval(", ".getAnimations(", "_enter", "_enterActive"]) {
    assert.ok(!source.includes(guess), `production still depends on ${guess}`);
  }
});

test("stops activating as soon as the prompt is gone", async () => {
  await withBrowser(async (page) => {
    await page.evaluate((html) => {
      window.activations = 0;
      const app = document.querySelector("#app");
      app.innerHTML = html.replace('style="display:none"', 'style="display:block"');
      const dialog = app.querySelector('[role="dialog"]');
      dialog.querySelector('a[href=""]').addEventListener("click", (event) => {
        event.preventDefault();
        window.activations++;
        dialog.remove();
      });
    }, modal);

    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 2000 });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.activations), 1);
  });
});

test("retries a prompt that never responds without busy-looping", async () => {
  await withBrowser(async (page) => {
    await page.evaluate((html) => {
      window.activations = 0;
      const app = document.querySelector("#app");
      app.innerHTML = html.replace('style="display:none"', 'style="display:block"');
      app.querySelector('a[href=""]').addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.activations++;
      });
    }, modal);

    await page.waitForTimeout(1500);
    const activations = await page.evaluate(() => window.activations);
    assert.ok(activations > 1, `expected retries, saw ${activations}`);
    assert.ok(activations <= 12, `expected rate-limited retries, saw ${activations}`);
    assert.equal(await page.locator('[role="dialog"]').count(), 1);
  });
});

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

test("clicks as soon as progressive mounting makes the prompt actionable", async () => {
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
      document.querySelector("#app").innerHTML = '<form role="dialog"><div id="prompt"></div></form>';
    });

    await page.evaluate(() => {
      document.querySelector("#prompt").insertAdjacentHTML("beforeend", `
        <p>Upgrade to Plus for Original audio without sync pauses</p>
        <p>Or switch to Synth audio</p>
        <button type="button">Use Synth</button>
        <a href="/plus">Upgrade</a>
      `);
    });
    assert.equal(await page.evaluate(() => window.continuations), 0);

    await page.evaluate(() => {
      document.querySelector("#prompt").insertAdjacentHTML("beforeend", '<p>Or <a href="">continue with sync pauses</a></p>');
    });
    await page.waitForFunction(() => window.continuations === 1, undefined, { timeout: 1000 });
  });
});

test("handles every repeated prompt when the site handler is attached in the same DOM commit", async () => {
  await withBrowser(async (page) => {
    await page.evaluate(() => { window.activations = 0; });

    for (let i = 1; i <= 12; i++) {
      await page.evaluate((html) => {
        const app = document.querySelector("#app");
        app.innerHTML = html.replace('style="display:none"', 'style="display:block"');
        const dialog = app.querySelector('[role="dialog"]');
        const target = dialog.querySelector('a[href=""]');
        target.addEventListener("click", (event) => {
          event.preventDefault();
          window.activations++;
          dialog.remove();
        }, { once: true });
      }, modal);

      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 1000 });
      assert.equal(await page.evaluate(() => window.activations), i);
    }
  });
});

test("retries exact prompt until a later-frame Songsterr handler is ready without DOM mutation", async () => {
  await withBrowser(async (page) => {
    await page.evaluate(() => { window.activations = 0; });
    const frameDelays = [1, 5, 2, 8, 3, 1, 6, 4, 7, 2, 5, 3];

    for (let i = 0; i < frameDelays.length; i++) {
      await page.evaluate(({ html, frames }) => {
        const app = document.querySelector("#app");
        app.innerHTML = html.replace('style="display:none"', 'style="display:block"');
        const dialog = app.querySelector('[role="dialog"]');
        const target = dialog.querySelector('a[href=""]');

        const attach = (remaining) => {
          if (remaining > 0) {
            requestAnimationFrame(() => attach(remaining - 1));
            return;
          }
          target.addEventListener("click", (event) => {
            event.preventDefault();
            window.activations++;
            dialog.remove();
          }, { once: true });
        };
        attach(frames);
      }, { html: modal, frames: frameDelays[i] });

      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 1500 });
      assert.equal(await page.evaluate(() => window.activations), i + 1);
    }
  });
});
