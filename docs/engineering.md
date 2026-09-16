# Engineering evidence

This report separates controlled browser tests from real Songsterr behavior. The current implementation is version 0.1.5.

## Observed Songsterr prompt

The English free Original Audio interruption has been observed with this semantic structure:

```html
<form role="dialog">
  <p>Upgrade to Plus for Original audio without sync pauses</p>
  <p>Or switch to Synth audio</p>
  <button type="button">Use Synth</button>
  <a href="/plus">Upgrade</a>
  <p>Or <a href="">continue with sync pauses</a></p>
</form>
```

The continuation anchor exposes no stable ID or language-independent action identifier. The empty `href` distinguishes it from Upgrade navigation. Generated CSS classes are intentionally not part of the production contract.

## 0.1.5 architecture

The extension now uses two minimal Manifest V3 content-script worlds.

`content.js` runs in the normal isolated extension world. It observes the document from `document_start`, collects only affected dialogs, and validates the complete free-continuation context. The candidate must be visible and enabled, have the exact normalized English continuation text, live inside a dialog containing the expected Original Audio heading plus visible **Use Synth** and **Upgrade** controls, and be a non-navigating anchor or non-submit button. Unknown or incomplete states fail closed.

Once the target is validated, `content.js` emits a private DOM event on that exact element. `main.js` runs with `world: "MAIN"`, revalidates the same semantic contract in Songsterr's page world, and performs the native click there.

The MAIN-world bridge exists because controlled Chromium reproduction showed a real race class that cannot be observed from DOM mutations alone: a prompt can already be fully rendered while the site's click handler is attached several render frames later with no intervening DOM change. A one-shot isolated-world click therefore can be too early.

For that case the bridge probes the same validated target once per animation frame. It stops immediately when the page consumes/cancels the click, removes the target/dialog, or the semantic target changes. The empty-link browser fallback is prevented on unsuccessful probes. There is no hard-coded millisecond delay, generated-class readiness rule, background interval, network interception, CSS hiding, or alternate-control fallback.

## TDD reproduction

Before changing production code, a regression was added that mounts twelve prompts and attaches the Songsterr-like handler after different numbers of animation frames without changing the DOM. Version 0.1.4 fails that regression because it activates the target only once. That RED failure was confirmed in GitHub Actions before the 0.1.5 implementation was introduced.

Several simpler retry approaches were rejected during development because they produced duplicate clicks in the existing browser suite. The accepted split-world design is the first tested architecture that satisfies both constraints: late-handler prompts are retried, while already-consumed prompts remain single-activation behavior.

## Controlled browser checks

CI loads the actual unpacked MV3 extension into Chromium rather than substituting a page-script mock. Current coverage includes:

- observed English markup and changed generated classes
- whitespace/case/NBSP and nested target text
- anchor, button, ARIA button and `aria-modal` variants
- unrelated, incomplete, localized, hidden, inert, disabled, navigation and submit negatives
- progressive mounting and attribute-only visibility changes
- delayed target/text/context insertion
- repeated replacement prompts and SPA root replacement
- DOM revalidation before activation
- late page-handler attachment across multiple animation frames without DOM mutation
- another origin excluded by the manifest
- syntax checks for both production scripts and release packaging

The 0.1.5 PR's complete CI run passed `npm run check`, the main Chromium suite, the visibility/readiness suite, and packaging.

Synthetic insertion-to-first-click measurements remain sub-millisecond in the existing fixture on Chromium. Those figures describe a controlled headless fixture only; they are not a guarantee about live paint timing, background tabs, hardware, or Songsterr's own rendering work.

## Real Songsterr checks

Earlier versions achieved a complete live Brave run on free Original Audio, including multiple automatic continuations and internal navigation, while leaving normal sync pauses intact. Later automated live attempts were sometimes inconclusive because embedded YouTube playback remained at time 0 / readyState 0 and therefore never generated the prompt. Those stalled runs are not treated as successful live validation.

Version 0.1.5's late-handler fix is therefore verified by reproducible real-browser fixtures that model the observed race class, not by a claimed fresh end-to-end Songsterr playback run.

## Safety boundary

The extension only automates Songsterr's existing free **continue with sync pauses** action. It does not click Upgrade or Use Synth, alter entitlements, intercept API responses, remove the actual sync pauses, hide advertising, or modify subscription state. It requests no extra extension permissions and has no runtime dependencies, telemetry, storage, background worker, or extension-origin network requests.

## Limits

- The observed English wording and dialog semantics are required. Localization or a site redesign may require an update.
- Animation-frame scheduling can be throttled in background tabs.
- The MAIN-world bridge intentionally runs only on Songsterr and exposes no generic page API.
- Zero visible frames cannot be guaranteed because the prompt may paint before the page handler becomes ready.
- A live Songsterr/YouTube acceptance run for 0.1.5 remains unavailable when the test environment cannot start embedded playback.

Browser APIs used: Manifest V3 content scripts, `world: "MAIN"`, `MutationObserver`, `Element.checkVisibility`, DOM events, and `requestAnimationFrame`.
