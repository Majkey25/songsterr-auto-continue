Automatically chooses Songsterr's free **continue with sync pauses** action. Normal sync pauses remain. No Plus unlock, extra permissions, or runtime dependencies.

Download the extension ZIP below, extract it, then select that folder using **Load unpacked** in `brave://extensions` or `chrome://extensions` with Developer mode enabled. Reload open Songsterr tabs.

Updating an existing installation: replace its files, click **Reload** on the extension card, then reload the Songsterr tab.

Version 0.1.3 removes the misleading position-specific assumption completely. Every recognized continuation prompt follows the same logic. If Songsterr has mounted the prompt before its click handler is ready, the extension safely retries the same validated free action while the dialog is still present and suppresses the empty-link fallback navigation that could otherwise reload the page. Regression coverage applies the same deliberately late handler to every repeated prompt.

Detection still requires the observed English dialog semantics. Site redesigns or localization may require an update.

Browser validation details and remaining limitations: [engineering report](https://github.com/Majkey25/songsterr-auto-continue/blob/main/docs/engineering.md).
