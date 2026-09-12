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

One observer starts at `document_start` on `document`, so a replaced app root cannot detach it. It examines added subtrees and the nearest dialog affected by a mutation, batches dialogs in a Set, and performs one initial scan. `characterData` also supports delayed text and context. Global attribute changes are not observed because the live prompt is inserted/removed, not toggled from a permanently hidden node.

When the validated dialog has a class ending in `_enter` or `_enterActive`, a temporary observer waits for those transition-state markers to clear. It watches only that dialog's `class` attribute and disconnects after at most one second. The generated class prefix is irrelevant. Two animation frames and native animation completion then allow mounting to finish before revalidation and one click. WeakSets prevent duplicate scheduling and repeated activation of the same element. Nothing is scheduled when no matching dialog exists.

The public transition implementation maintains its own entry state beyond CSS completion. Waiting for that state is a conservative mounting safeguard. Early investigations incorrectly attributed navigation failures to click timing: the harness was operating Songsterr's read-only radio input instead of its surrounding source-toggle control. Correcting that interaction produced a successful complete live run without adding mouse events or changing execution worlds. Those early failures do not establish that all these timing safeguards are necessary. Regression scenarios cover delayed handler attachment, native animations, entry state outlasting animation, and changed targets.

No prehide CSS is shipped. The extension leaves the site's blur, blocker, pause timing, entitlements, and API responses to Songsterr. No measured evidence justifies hiding additional UI.

## Controlled browser checks

Both actual unpacked-extension runs passed **31 scenarios**, reported by Node as 32 tests including the parent test. Fixtures are served at a Songsterr-matching URL; the real manifest injects the extension in its isolated world. No page-script substitute is used.

Covered: observed markup, changed classes, whitespace/case/NBSP, nested text, button and ARIA-button targets, `aria-modal`, unrelated dialogs, missing context, near matches, navigation/submit controls, hidden/inert/disabled controls, nested dialogs, unknown localization, delayed insertion/text/context, repeat replacement prompts, SPA root replacement, detached nodes, delayed handler mount, queued-target changes, normal neighboring controls, and another origin excluded by the manifest. No page exceptions occurred.

Insertion-to-click timing uses `performance.now()` immediately before fixture insertion and in the capture listener. Each browser ran 200 insertions:

| Browser engine | Minimum | Median | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Chromium 151.0.7922.34 | 4.20 ms | 10.60 ms | 11.30 ms | 14.00 ms |
| Brave / Chromium 152.0.7977.83 | 6.90 ms | 10.90 ms | 11.50 ms | 13.70 ms |

These are synthetic headless measurements without an entry animation on one Windows host. They are not guarantees about the live site's paint timing, throttled tabs, or other hardware. The live site's entry state lasts roughly 200 ms and adds its own delay. No trace established zero visible frames. No CPU-wakeup comparison was measured.

Commands:

```sh
npm run check
npm test
node tests/extension.test.cjs "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"
python scripts/package.py
```

## Real Songsterr check

The final isolated-world unpacked extension passed the complete live script in Brave:

1. [Master of Puppets](https://www.songsterr.com/a/wsa/metallica-master-of-puppets-tab-s455118): automatic clicks at 19.189 s and 30.460 s after navigation; both dialogs removed after exit.
2. Pause responded normally.
3. Internal navigation through Search to [Enter Sandman](https://www.songsterr.com/a/wsa/metallica-enter-sandman-tab-s19): a third automatic continuation, dialog removed, Original Audio still selected, playback active.

The process exited successfully. No page exceptions were recorded before navigation. Site and YouTube requests were not intercepted. This is one complete clean live run, plus repeated first-song checks; it is not an exhaustive reliability or frame-paint study.

Some isolated-browser attempts stalled with the YouTube video at time 0 / readyState 0 and produced no prompt within three minutes. These runs are not counted as successful checks. A final attempt to evaluate a shorter activation delay was likewise inconclusive because playback stalled, so the proven implementation was retained. The live script fails when it does not observe the required cycles; it never substitutes synthetic prompts for live acceptance.

Live command:

```sh
node tests/live.cjs "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe" "https://www.songsterr.com/a/wsa/metallica-master-of-puppets-tab-s455118"
```

## Prior art comparison

[Better Songsterr](https://github.com/Josie5734/better-songsterr/blob/main/addon/content.js) uses a generated selector, observes `#apptab`, and hides several global classes. [Popup Auto Clicker](https://github.com/WeWake1/Clicker_ChromeExtension/blob/main/chrome-extension-auto-clicker/content.js) polls every second, adds 500 ms delay, and sends native plus synthetic click events. Both also include unrelated ad changes. Their source was inspected; they were not installed, copied, or benchmarked. This extension keeps the free action while adding context validation and avoiding those unrelated behaviors.

## Limits

- English wording and dialog semantics are required; a site redesign can disable recognition.
- Renaming the transition-state suffixes could invalidate the mount-readiness check.
- An already handled DOM element reused for a later prompt is not clicked again. The observed flow creates replacement elements.
- Attribute-only visibility changes and text without a later DOM mutation are not retried.
- Background tabs can delay animation frames. An animation that never finishes leaves the prompt for manual use.
- A failed click is not repeated blindly; the real dialog remains available for manual use.
- Zero flicker, background-tab latency, and all localized site variants are unverified.
- Static content-script access covers `https://www.songsterr.com/*` only, with no additional permissions, background worker, storage, telemetry, or extension network requests.

Browser APIs: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), [Element.checkVisibility](https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility), [Playwright extension loading](https://playwright.dev/docs/chrome-extensions).
