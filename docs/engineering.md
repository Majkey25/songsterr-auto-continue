# Engineering evidence

Observed on 2026-09-12. This report separates controlled browser tests from real Songsterr behavior.

## Live DOM

On the English [Stairway to Heaven tab](https://www.songsterr.com/a/wsa/led-zeppelin-stairway-to-heaven-tab-s27), a signed-out Original Audio session produced:

```html
<form role="dialog" class="w_eHuW_modal">
  <div class="_2e9mvq_popup">
    <!-- Layout wrappers omitted -->
    <p>Upgrade to Plus for Original audio without sync pauses</p>
    <p>Or switch to Synth audio</p>
    <button aria-label="Use Synth" type="button">Use Synth</button>
    <a href="/plus">Upgrade</a>
    <p class="w_eHuW_continueLink">Or <a href="">continue with sync pauses</a></p>
  </div>
</form>
```

The continuation anchor had no ID, role override, ARIA label, or data identifier. Its empty `href` distinguished it from the Upgrade navigation. The dialog was outside `#apptab`, inside a `display: contents` wrapper. No Shadow DOM was involved in this control. The generated `popupRedesign` and `modalRedesign` classes from the supplied brief were absent in the initial session. The current page contains a Preact application, rather than a React-specific requirement.

The loaded [ConstraintsModal module](https://static3.songsterr.com/production-main/static3/latest/ConstraintsModal-BURZ5_JjaxUbJVVj.js) confirms that the free anchor invokes the site's ordinary layer-close action. Its unmount cleanup invokes the normal constraints-modal close action. The same module contains ten non-English translations; this release deliberately recognizes English only. No stable language-independent action ID was exposed in the observed DOM.

## Implementation

The semantic contract is a dialog marker + exact normalized continuation text + exact visible heading + Use Synth and Upgrade controls. Generated classes are not used. Ancestor matching stops at the nearest dialog and rejects BODY/HTML as context. Hidden, inert, disabled, nested unrelated, navigation, and submit controls are rejected.

One observer starts at `document_start` on `document`, so a replaced app root cannot detach it. It examines added subtrees and the nearest dialog affected by a mutation, batches dialogs in a Set, and performs one initial scan. `characterData` also supports delayed text and context. No attribute observer is installed because the observed live prompt is inserted/removed, not toggled from a permanently hidden node.

Activation waits two animation frames for the page to start its entry transition, then waits for the dialog's native animations to finish and revalidates. This is event-triggered scheduling, not polling. WeakSets prevent both duplicate scheduling and repeated activation of the same element. Nothing is scheduled when no matching dialog exists.

An immediate MutationObserver click and a next-task click both failed in live Brave: each produced one click event during the entry phase, but the dialog remained indefinitely. Clicking a fully mounted real prompt manually with native `.click()` closed it and left Original Audio selected and playback active. Waiting for entry animations allowed subsequent real prompts to appear and close. The public transition implementation schedules entry work across two animation frames; the precise internal ordering that leaves the early-closed dialog orphaned was not instrumented. Regression scenarios cover delayed handler attachment, waiting for an animation, and revalidation of a changed target.

No prehide CSS is shipped. The extension leaves the site's blur, blocker, pause timing, entitlements, and API responses to Songsterr. No measured evidence justifies hiding additional UI.

## Controlled browser checks

Both actual unpacked-extension runs passed **30 scenarios**, reported by Node as 31 tests including the parent test. Fixtures are served at a Songsterr-matching URL; the real manifest injects the extension in its isolated world. No page-script substitute is used.

Covered: observed markup, changed classes, whitespace/case/NBSP, nested text, button and ARIA-button targets, `aria-modal`, unrelated dialogs, missing context, near matches, navigation/submit controls, hidden/inert/disabled controls, nested dialogs, unknown localization, delayed insertion/text/context, repeat replacement prompts, SPA root replacement, detached nodes, delayed handler mount, queued-target changes, normal neighboring controls, and another origin excluded by the manifest. No page exceptions occurred.

Insertion-to-click timing uses `performance.now()` immediately before fixture insertion and in the capture listener. Each browser ran 200 insertions:

| Browser engine | Minimum | Median | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Chromium 151.0.7922.34 | 2.50 ms | 9.00 ms | 12.80 ms | 14.70 ms |
| Brave / Chromium 152.0.7977.83 | 3.20 ms | 10.05 ms | 13.40 ms | 66.90 ms |

These are synthetic headless measurements without an entry animation on one Windows host, with the two browser checks running concurrently. They are not guarantees about the live site's paint timing, throttled tabs, or other hardware. A live entry animation adds its own duration. No trace established zero visible frames. No CPU-wakeup comparison was measured.

Commands:

```sh
npm run check
npm test
node tests/extension.test.cjs "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"
python scripts/package.py
```

## Real Songsterr check

The revised unpacked extension ran in an isolated Brave profile on [Master of Puppets](https://www.songsterr.com/a/wsa/metallica-master-of-puppets-tab-s455118). It generated one untrusted native click for each of two real prompt instances at 18.897 s and 30.169 s after navigation. Both dialogs were removed after their exit animations. Original Audio remained selected, playback remained active, Pause responded, and no page exceptions were recorded. Site and YouTube requests were not intercepted.

An earlier fresh-profile Stairway to Heaven run stayed at the initial score position without producing a prompt for three minutes. A later Master of Puppets run reproduced prompts normally. The live script reports a failure if playback does not produce the required cycles; it never substitutes synthetic prompts for live acceptance.

## Prior art comparison

[Better Songsterr](https://github.com/Josie5734/better-songsterr/blob/main/addon/content.js) uses a generated selector, observes `#apptab`, and hides several global classes. [Popup Auto Clicker](https://github.com/WeWake1/Clicker_ChromeExtension/blob/main/chrome-extension-auto-clicker/content.js) polls every second, adds 500 ms delay, and sends native plus synthetic click events. Both also include unrelated ad changes. Their source was inspected; they were not installed, copied, or benchmarked. This extension keeps the free action while adding context validation and avoiding those unrelated behaviors.

## Limits

- English wording and dialog semantics are required; a site redesign can disable recognition.
- An already handled DOM element reused for a later prompt is not clicked again. The observed flow creates replacement elements.
- Attribute-only visibility changes and text without a later DOM mutation are not retried.
- Background tabs can delay animation frames. An animation that never finishes leaves the prompt for manual use.
- A failed click is not repeated blindly; the real dialog remains available for manual use.
- Zero flicker, background-tab latency, and all localized site variants are unverified.
- Static content-script access covers `https://www.songsterr.com/*` only, with no additional permissions, background worker, storage, telemetry, or extension network requests.

Browser APIs: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), [Element.checkVisibility](https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility), [Playwright extension loading](https://playwright.dev/docs/chrome-extensions).
