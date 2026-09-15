Automatically chooses Songsterr's free **continue with sync pauses** action. Normal sync pauses remain. No Plus unlock, extra permissions, or runtime dependencies.

Download the extension ZIP below, extract it, then select that folder using **Load unpacked** in `brave://extensions` or `chrome://extensions` with Developer mode enabled. Reload open Songsterr tabs.

Updating an existing installation: replace its files, click **Reload** on the extension card, then reload the Songsterr tab.

Version 0.1.4 replaces fixed timing guesses with DOM-driven handling. The extension watches Songsterr dialog mutations, waits only for the current DOM commit and its microtasks to settle, revalidates the exact visible free continuation action, and clicks it immediately. There are no millisecond delays, polling loops, animation waits, or generated-class readiness rules in production code.

CI covers progressive mounting, hidden-to-visible dialogs, DOM changes before activation, repeated prompts, SPA replacement, fail-closed semantics, and a guard against timer-based scheduling returning. In a 200-run Chromium fixture, insertion-to-click latency measured 0.6 ms median, 0.8 ms p95, and 4.2 ms maximum.

Detection still requires the observed English dialog semantics. Site redesigns or localization may require an update.

Browser validation details and remaining limitations: [engineering report](https://github.com/Majkey25/songsterr-auto-continue/blob/main/docs/engineering.md).
