# Changelog

## 0.1.8 - 2026-09-18

- Fixed the prompt staying on screen during real Songsterr playback even though the extension had already clicked the right link.
- Root cause: Songsterr cancels a click that lands before its own handler is effective without dismissing the prompt. Earlier versions read that cancellation as success, recorded the target as handled and never tried again.
- Activation is now verified by outcome. The validated free action is re-activated on a rate-limited interval until the prompt is actually gone, and stops immediately once it is.
- Dropped the generated `.w_eHuW_continueLink` selector. That class is a per-build CSS-module hash and the whole naming scheme has already changed once on the live site.
- Identification no longer depends on the headline sentence, which Songsterr has also rewritten; a visible Upgrade link or Use Synth control now corroborates the prompt, so app builds without a `/plus` link still work.
- Test fixtures now dismiss the prompt when the free action is activated, so a release that clicks without dismissing can no longer pass CI.

## 0.1.5 - 2026-09-16

- Fixed intermittent prompts that appeared before Songsterr attached the page click handler.
- Split activation into a tiny MAIN-world bridge while keeping semantic dialog detection in the isolated content script.
- Retries only the exact validated free continuation target on animation frames until the page handler consumes the click or the prompt changes/disappears.
- Keeps empty-link fallback navigation suppressed during unsuccessful probes without using millisecond delays or generated CSS classes.
- Added a regression covering handlers that become ready several render frames after the prompt appears with no intervening DOM mutation.

## 0.1.4 - 2026-09-15

- Replaced fixed timing and animation waits with DOM-driven continuation handling.
- Detects relevant Songsterr dialog mutations, lets the current DOM commit settle, revalidates the exact free action, then activates it without any millisecond delay or polling.
- Ignores generated entry-animation classes and does not wait for CSS animations.
- Added regressions for progressive mounting, hidden-to-visible dialogs, DOM changes before activation, repeated prompts, and production code remaining free of timer-based scheduling.
- Reduced synthetic insertion-to-click latency to a 0.6 ms median and 0.8 ms p95 across 200 Chromium runs in CI.

## 0.1.3 - 2026-09-15

- Treat every recognized continuation prompt identically; there is no position- or count-based handling.
- Retry the same validated free continuation action while its dialog remains open, covering late Songsterr click-handler mounting.
- Prevent the empty-link fallback navigation during retries so an early click cannot reload the page before Songsterr is ready.
- Added regression coverage where every repeated prompt gets the same deliberately late handler.

## 0.1.2 - 2026-09-15

- Fixed intermittent missed continuation prompts caused by mount/readiness races.
- Rechecks recognized prompts across visibility and attribute changes.
- Waits for Songsterr's UI to finish mounting before activation.
- Added regression coverage for late-mounted prompt handlers.

## 0.1.1 - 2026-09-12

- Fixed continuation blocked by a stale entry-animation class on redesigned dialogs.
- Added a custom continuation icon at 16, 32, 48, and 128 pixels.
- Added a Download latest version button to the README.
- Publish standard GitHub releases with installable ZIPs and checksums.

## 0.1.0 - 2026-09-12

- Initial Brave / Chromium Manifest V3 extension.
- Automatically activates the exact free Original Audio continuation action.
- Validates dialog context without generated CSS classes; ignores unrelated, hidden, and disabled controls.
- Handles delayed text, replacement prompts, and SPA root replacement.
- No runtime dependencies, additional permissions, polling, CSS hiding, or network interception.
- Includes browser checks, release ZIPs, and SHA-256 checksums.
