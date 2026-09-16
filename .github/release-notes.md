Automatically chooses Songsterr's free **continue with sync pauses** action. Normal sync pauses remain. No Plus unlock, extra permissions, or runtime dependencies.

Download the extension ZIP below, extract it, then select that folder using **Load unpacked** in `brave://extensions` or `chrome://extensions` with Developer mode enabled. Reload open Songsterr tabs.

Updating an existing installation: replace its files, click **Reload** on the extension card, then reload the Songsterr tab.

Version 0.1.6 fixes the release packaging regression in v0.1.5: the manifest referenced the MAIN-world `main.js` bridge, but the generated release ZIP omitted that file, so Chrome/Brave reported `Could not load javascript 'main.js' for script` and refused to load the extension. Packaging now derives its JavaScript payload directly from `manifest.json`, and CI verifies that every manifest-referenced script is actually present in the release ZIP.

The v0.1.5 runtime fix remains unchanged: detection stays semantic and fail-closed in the isolated content script, while the tiny MAIN-world bridge retries only the already validated free continuation target on animation frames until Songsterr consumes the click or the target changes/disappears.

CI covers prompt semantics, progressive mounting, hidden-to-visible dialogs, DOM changes before activation, repeated prompts, SPA replacement, fail-closed cases, delayed site-handler readiness, and release-package completeness.

Detection still requires the observed English dialog semantics. Site redesigns or localization may require an update.

Browser validation details and remaining limitations: [engineering report](https://github.com/Majkey25/songsterr-auto-continue/blob/main/docs/engineering.md).
