Automatically chooses Songsterr's free **continue with sync pauses** action. Normal sync pauses remain. No Plus unlock, extra permissions, or runtime dependencies.

Download the extension ZIP below, extract it, then select that folder using **Load unpacked** in `brave://extensions` or `chrome://extensions` with Developer mode enabled. Reload open Songsterr tabs.

Updating an existing installation: replace its files, click **Reload** on the extension card, then reload the Songsterr tab.

Version 0.1.2 targets intermittent missed prompts. It rechecks recognized dialogs when Songsterr changes visibility/state, waits longer for the site's prompt handlers to finish mounting, and includes regression coverage for repeated prompts where every fourth prompt becomes actionable late. Detection still requires the observed English dialog semantics. Site redesigns or localization may require an update.

Browser validation details and remaining limitations: [engineering report](https://github.com/Majkey25/songsterr-auto-continue/blob/main/docs/engineering.md).
