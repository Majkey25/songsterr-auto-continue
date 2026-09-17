# Engineering evidence

This report separates controlled browser tests from real Songsterr behavior. The current implementation is version 0.1.7.

## Current Songsterr prompt

The current English free Original Audio interruption has been observed with a generated-class structure equivalent to:

```html
<div class="w_eHuW_modal w_eHuW_modalRedesign">
  <div class="_2e9mvq_popup w_eHuW_popupRedesign">
    <p>Upgrade to Plus for Original audio without sync pauses</p>
    <p>Or switch to Synth audio</p>
    <button type="button">Use Synth</button>
    <a href="/plus">Upgrade</a>
    <p class="w_eHuW_continueLink">Or <a href="">continue with sync pauses</a></p>
  </div>
</div>
```

The important change for this extension is that the current popup is not required to expose the older `role="dialog"` contract. Independent Songsterr tools in active public repositories also target the current `.w_eHuW_continueLink` continuation wrapper or scan for the exact continuation text.

## v0.1.7 architecture

Version 0.1.7 uses one Manifest V3 isolated content script instead of the v0.1.5/v0.1.6 split isolated/MAIN-world bridge.

The primary detector looks for Songsterr's current `.w_eHuW_continueLink` wrapper and still validates that its action is visible, enabled, has exact normalized English text **continue with sync pauses**, and cannot navigate away to a Plus page. This path deliberately does not depend on the popup's role or headline copy.

A conservative legacy fallback keeps the older semantic dialog detection for previous markup. That path continues to require the expected Original Audio headline plus **Use Synth** and **Upgrade** controls before activating the free continuation target.

The click probe remains condition-driven rather than based on fixed millisecond delays. If the prompt appears before Songsterr attaches its handler, the same validated target can be retried on animation frames. Probes stop when Songsterr consumes/cancels the click, removes the target, the target stops matching, or the bounded retry window expires. Empty-link browser navigation is prevented on unsuccessful probes without stopping event propagation.

There is no CSS popup hiding, network interception, background interval, entitlement change, or fallback to Upgrade/Use Synth.

## TDD reproduction

Before the v0.1.7 production change, a real unpacked-Chromium regression test mounted the current `.w_eHuW_continueLink` popup without `role="dialog"` and with deliberately changed headline copy. Version 0.1.6 timed out without clicking it, while the existing 31-test browser suite stayed green. This isolated the failure to the old detection gate rather than packaging or extension loading.

Earlier TDD also reproduces late click-handler attachment across multiple animation frames with no DOM mutation. The v0.1.7 single-script implementation retains coverage for that race.

## Controlled browser checks

CI loads the actual unpacked MV3 extension into Chromium rather than substituting a page-script mock. Coverage includes:

- current `.w_eHuW_continueLink` popup without a dialog role or fixed headline
- older semantic dialog markup and changed generated classes
- whitespace/case/NBSP and nested target text
- anchor, button, ARIA button and `aria-modal` variants for the legacy path
- unrelated, localized, hidden, inert, disabled, navigation and submit negatives
- progressive mounting and attribute-only visibility changes
- delayed target/text/context insertion
- repeated replacement prompts and SPA root replacement
- DOM revalidation before activation
- late page-handler attachment across multiple animation frames without DOM mutation
- another origin excluded by the manifest
- syntax and release-package completeness checks

Synthetic insertion latency from older fixture runs is not a guarantee about live paint timing, background tabs, hardware, or Songsterr rendering work.

## Real Songsterr checks

Earlier versions achieved complete live Brave runs on free Original Audio, including multiple automatic continuations and internal navigation, while leaving normal sync pauses intact. Automated live checks can be inconclusive when embedded YouTube playback never starts and therefore never produces the interruption prompt; those stalled runs are not treated as successful validation.

Version 0.1.7 is therefore gated primarily by reproducible real-browser fixtures matching the current observed popup plus the existing race/safety suite. A user-visible live acceptance check remains useful after installation.

## Safety boundary

The extension only automates Songsterr's existing free **continue with sync pauses** action. It does not click Upgrade or Use Synth, alter entitlements, intercept API responses, remove the actual sync pauses, hide advertising, or modify subscription state. It requests no extra extension permissions and has no runtime dependencies, telemetry, storage, background worker, or extension-origin network requests.

## Limits

- The continuation action still uses observed English wording. Localization may require an update.
- The primary path intentionally uses Songsterr's current continuation wrapper; a future redesign can require another selector update.
- Animation-frame scheduling can be throttled in background tabs.
- Zero visible frames cannot be guaranteed because the prompt may paint before the page handler becomes ready.

Browser APIs used: Manifest V3 content scripts, `MutationObserver`, `Element.checkVisibility`, DOM events, `MessageChannel`, and `requestAnimationFrame`.
