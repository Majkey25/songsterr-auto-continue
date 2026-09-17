# Songsterr Auto Continue v0.1.7

Automatically chooses Songsterr's free **continue with sync pauses** action. Normal sync pauses remain. No Plus unlock, extra permissions, or runtime dependencies.

Version 0.1.7 fixes the current Songsterr Plus interruption popup that could remain visible even with v0.1.6 installed. The extension now recognizes Songsterr's current `.w_eHuW_continueLink` wrapper and exact continuation action directly instead of requiring the older combination of dialog role, exact headline, Use Synth, and Upgrade semantics before it can act.

The previous split `content.js` + MAIN-world `main.js` bridge has been replaced by one smaller content script. It keeps the useful late-handler protection: the same validated free target is retried on animation frames only while it remains valid, and empty-link browser navigation is suppressed on unsuccessful probes.

A conservative legacy semantic fallback remains for the older dialog shape. Hidden, disabled, navigation, submit, near-match, localized, or unrelated targets remain fail-closed. The extension never clicks **Upgrade** or **Use Synth**, never hides the popup with CSS, and does not remove Songsterr's real sync pauses.

CI includes a regression for the current popup shape without a dialog role or fixed headline, delayed site-handler readiness, progressive mounting, visibility changes, repeated prompts, SPA replacement, safety negatives, and release-package completeness.

Download the ZIP below, extract it, select that folder with **Load unpacked** in `brave://extensions` or `chrome://extensions`, then reload open Songsterr tabs.
