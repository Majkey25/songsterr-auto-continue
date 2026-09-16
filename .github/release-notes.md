Automatically chooses Songsterr's free **continue with sync pauses** action. Normal sync pauses remain. No Plus unlock, extra permissions, or runtime dependencies.

Download the extension ZIP below, extract it, then select that folder using **Load unpacked** in `brave://extensions` or `chrome://extensions` with Developer mode enabled. Reload open Songsterr tabs.

Updating an existing installation: replace its files, click **Reload** on the extension card, then reload the Songsterr tab.

Version 0.1.5 fixes the remaining intermittent race where Songsterr could render the free continuation prompt before attaching its click handler. Detection stays semantic and fail-closed in the isolated content script. A tiny MAIN-world bridge then retries only the already validated free continuation target on animation frames until Songsterr consumes the click or the target changes/disappears. There are no fixed millisecond delays, generated-class readiness rules, subscription changes, or alternate control clicks.

CI covers the observed prompt semantics, progressive mounting, hidden-to-visible dialogs, DOM changes before activation, repeated prompts, SPA replacement, fail-closed cases, and a regression where the site's handler becomes ready several render frames after the prompt appears without any DOM mutation.

Detection still requires the observed English dialog semantics. Site redesigns or localization may require an update.

Browser validation details and remaining limitations: [engineering report](https://github.com/Majkey25/songsterr-auto-continue/blob/main/docs/engineering.md).
