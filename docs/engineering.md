# Engineering evidence

This report separates what was observed on the live site from what was inferred. The current
implementation is version 0.1.9.

## The failure, reproduced live

Reproduced on 2026-09-17 with the released v0.1.7 ZIP loaded unpacked into Brave 153.0.8010.37
(Chromium 153) on Windows 11, in a throwaway profile, on
`https://www.songsterr.com/a/wsa/nirvana-smells-like-teen-spirit-tab-s269` with **Original** audio
selected and playback started by a real mouse click.

A page-world recorder logged prompt insertion, prompt removal, and every click reaching `window`:

```
t=37333ms  MODAL_APPEAR   linkFound=true
t=37335ms  CLICK_CAPTURE  isTrusted=false  <A> "continue with sync pauses"
           (no window bubble event, no navigation, no MODAL_GONE)
[state] modalOpen=true textPresent=true   ← repeated until the run ended
```

The prompt subtree at that moment, captured verbatim:

```html
<form role="dialog" class="w_eHuW_modal e7HakW_enter"><div class="_2e9mvq_popup"><div class="_2e9mvq_body"><div class="w_eHuW_contentBase w_eHuW_content"><p>Upgrade to Plus for Original audio without sync pauses</p></div><p class="w_eHuW_synthText">Or switch to Synth audio</p></div><div class="_2e9mvq_footer"><div class="_2e9mvq_actions"><button aria-label="Use Synth" type="button" tabindex="0" class="qzgWxW_button qzgWxW_actionsButton"><span>Use Synth</span></button><a href="/plus" class="qzgWxW_button qzgWxW_button qzgWxW_buttonSubmit">Upgrade</a></div><div class="_2e9mvq_afterButtons"><p class="w_eHuW_continueLink">Or <a href="">continue with sync pauses</a></p></div></div></div></form>
```

Measured properties of the target: `<a href="">`, `pointerEvents: auto`, `visibility: visible`,
`checkVisibility() === true`, in the main document - not in an iframe, not in a shadow root, and its
root node is `document`. `DOMDebugger.getEventListeners` reported exactly one listener: `click`,
non-capturing, from the page bundle.

So detection was never the problem in 0.1.7. The extension found the correct element and clicked it.

## Root cause

**Songsterr's handler is not effective the instant the prompt is inserted, and a click that lands
too early is cancelled by the page without dismissing the prompt.**

Evidence, from the same live page with no extension loaded:

| Activation | Result |
| --- | --- |
| `element.click()` fired 2 ms after insertion, from a `MutationObserver` callback | prompt stays open |
| `element.click()` after a 4 s settle | **prompt dismissed** |

The second row rules out the theories that would have demanded a different architecture: the action
does not need a trusted event, does not need a `PointerEvent`/`MouseEvent` sequence, and does not
need to run in the page's MAIN world. A plain untrusted `click()` from an isolated content script is
enough, provided it is late enough. Grepping the served bundles for `isTrusted` finds only the
bundled session recorder, never a gate on this action.

What turned a recoverable race into a permanent failure was 0.1.7's success test. `probe()` inferred
success from the click event: if propagation stopped before `window` and `defaultPrevented` was set,
it treated the prompt as consumed, added the node to a `handled` WeakSet and never retried. The live
capture shows exactly that shape - propagation stopped, default prevented, prompt still on screen -
so the extension declared victory on its first and only attempt and went quiet for the session.

## What could not be trusted for identification

Two markers 0.1.7 relied on have already changed on the live site. An archived build from
2025-12-13 (`ConstraintsModal-Cuyj47vD.js`, via the Wayback Machine) against today's
(`ConstraintsModal-ChqDKW7RkWAu7o8r.js`):

| | 2025-12-13 | current |
| --- | --- | --- |
| continue link wrapper class | `C83v7g` | `w_eHuW_continueLink` |
| dialog class | `C8325s` | `w_eHuW_modal` |
| continue link copy | `continue playback` | `continue with sync pauses` |
| headline copy | `Subscribe to Plus for Original audio syncing without pauses.` | `Upgrade to Plus for Original audio without sync pauses` |
| upgrade action copy | `Subscribe` | `Upgrade` |

The class naming scheme changed wholesale, and `w_eHuW_` is a per-file CSS-module hash that moves
whenever that stylesheet changes. The headline sentence was rewritten. Neither is used in 0.1.8.

What did survive both builds, and is used: the `role="dialog"` container, an `<a href="">` free
continuation, a `Use Synth` control, and an `<a href="/plus">` upgrade action. The component source
also shows the `/plus` link is replaced by an app-store action on app devices, so either the upgrade
link or the Use Synth control is accepted as corroboration rather than requiring both.

## How soon the prompt can possibly go

Measured on the live site with no extension loaded, activating the link on every animation frame
from the moment it appears, so the only delay left is Songsterr's own:

| prompt | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| accepted after | 449 ms | 458 ms | 720 ms | 2229 ms | 2286 ms | 2306 ms |

Those numbers are the floor; nothing an extension does can beat them. The 0.1.8 release dismissed the
same prompts in 613-2420 ms, so its own 200 ms retry spacing was adding 97-164 ms on top. 0.1.9 uses a
50 ms interval, which caps that addition at 50 ms, and replaces the 60-attempt cap with a 12 s budget
so a shorter interval cannot shorten how long a slow prompt is pursued.

## 0.1.9 architecture

One Manifest V3 isolated content script, no MAIN-world bridge, no background worker.

Detection stays event driven: a `MutationObserver` over the document schedules a scan on childList,
characterData and the attribute changes that can affect visibility. A scan looks for a visible
dialog that contains a visible `/plus` upgrade link or a visible **Use Synth** control, then takes
the control inside it whose exact normalized text is `continue with sync pauses`, that is visible and
enabled, that is not an anchor pointing anywhere except `""` or `#`, and that is not a submit button.

Activation is verified by outcome, which is the actual fix. The target is activated immediately on
detection and then re-activated at most once per 50 ms until it is gone, for at most 12 s per
prompt. The moment a scan finds no target, the per-prompt state is dropped, so the next prompt - and a
reused DOM node - starts from a clean slate. Nothing is ever recorded as handled on the strength of
event flags.

Because the target is always an empty-href link or a plain button, a one-shot capture listener
cancels the browser's default action for that click so an early activation cannot reload the page.
Propagation is untouched, so Songsterr's own handler runs exactly as it would for a real click.

There is no CSS popup hiding, network interception, polling interval, entitlement change, or any path
that can activate Upgrade or Use Synth.

## TDD

`tests/current-popup.test.cjs` mounts the verbatim captured prompt and reproduces the live lifecycle:
until the page is ready, a click on the continue link is cancelled (`preventDefault` +
`stopPropagation`) and does nothing; afterwards it dismisses the prompt. Every assertion is that the
prompt is **gone**, never that a click happened.

Against 0.1.7 that file fails for readiness delays of 100 ms, 500 ms and 2000 ms and for repeated
prompts, and passes only the already-ready case. Against 0.1.8 it passes.

The older suite could not catch this: its fixture recorded clicks and cancelled them but never
dismissed anything, so "the extension clicked once" was indistinguishable from "the prompt went
away". That fixture now dismisses the prompt when the free action is activated.

## Automated coverage

46 tests, all loading the real unpacked MV3 extension into Chromium 151 rather than a page-script
mock:

- verbatim live prompt markup, with page readiness at 0 / 100 / 500 / 2000 ms
- 100 consecutive prompts with varying readiness, to expose retry-state leaks
- 200 insertion-to-click measurements: 0.5 ms median, 0.8 ms p95, 8.9 ms max
- 12 repeated prompts whose handler attaches 1-8 animation frames late with no DOM mutation
- rewritten headline copy, changed generated classes, app-style upgrade action, renamed synth action
- whitespace/NBSP/case variation, nested target text, anchor / button / ARIA-button / `aria-modal`
- progressive mounting, delayed target insertion, attribute-only visibility changes, SPA root
  replacement, revalidation before activation
- retries stop the instant the prompt is gone, and a prompt that never responds is retried at a
  limited rate rather than in a busy loop
- negatives that must never activate anything: exact text outside a dialog, dialog without any
  interruption marker, hidden corroborators, near-match text, localized text, navigating anchor,
  submit button, hidden / CSS-hidden / inert dialog, disabled target, nested unrelated dialog,
  another origin
- syntax check and release-package completeness

## Live acceptance

Run on 2026-09-18 against real Songsterr with the packaged 0.1.8 ZIP loaded unpacked into Brave
153.0.8010.48, a throwaway profile, free Original Audio, no account. "Activations" is how many times
the extension had to activate the link before Songsterr accepted it.

| # | Phase | Result | Dismissed after | Activations |
| --- | --- | --- | --- | --- |
| 1 | song A | PASS | 625 ms | 4 |
| 2 | song A | PASS | 2420 ms | 13 |
| 3 | song A | PASS | 817 ms | 5 |
| 4 | song A | PASS | 615 ms | 4 |
| 5 | song A | PASS | 2220 ms | 12 |
| 6 | song A | PASS | 2425 ms | 13 |
| 7 | song A | PASS | 613 ms | 4 |
| 8 | song A | PASS | 613 ms | 4 |
| 9 | song A | PASS | 613 ms | 4 |
| 10 | song A | PASS | 613 ms | 4 |
| 11 | song B, after SPA navigation | PASS | 621 ms | 4 |
| 12 | song B, after SPA navigation | PASS | 613 ms | 4 |
| 13 | after a full page reload | PASS | 619 ms | 4 |
| 14 | after a full page reload | PASS | 616 ms | 4 |
| 15 | second tab | PASS | 627 ms | 4 |
| 16 | second tab | PASS | 2425 ms | 13 |

16 real interruption prompts, 16 dismissed, 0 missed. Original stayed selected throughout and
playback continued normally. Recorded activations of anything other than the free continuation -
Upgrade, Use Synth or any other control inside the prompt - across both tabs: **none** (empty list).

The activation counts are the load-bearing result. **No prompt was ever dismissed by the first
click**; every one needed between 4 and 13. Songsterr's handler took 0.6 s to become effective in the
common case and 2.2-2.4 s in the slow case. That also shows the 0.1.7 design could not have worked
even with a correct success test: it retried for about 30 animation frames, roughly 0.5 s, which is
shorter than the slow case. The measured worst case leaves roughly a 5x margin inside the current
12 s budget.

## Safety boundary

The extension only automates Songsterr's existing free **continue with sync pauses** action. It does
not click Upgrade or Use Synth, alter entitlements, intercept API responses, remove the actual sync
pauses, hide advertising, or modify subscription state. It requests no extra permissions and has no
runtime dependencies, telemetry, storage, background worker, or extension-origin network requests.

## Limits

- The continuation action is matched on its exact English wording. Songsterr has rewritten this
  string before; localization or another rewrite will require an update.
- Identification needs a visible `/plus` link or a visible Use Synth control in the same dialog. A
  redesign that drops both would require an update.
- The prompt is briefly visible: 0.6 s typically and 2.4 s at worst in the live run above. Zero
  visible frames is not achievable, because the page ignores activation until its own handler is
  ready.
- Timer scheduling can be throttled in background tabs.

Browser APIs used: Manifest V3 content scripts, `MutationObserver`, `Element.checkVisibility`, DOM
events and `setTimeout`.
