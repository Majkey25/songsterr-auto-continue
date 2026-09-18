# Songsterr Auto Continue v0.1.8

Automatically chooses Songsterr's free **continue with sync pauses** action. Normal sync pauses remain. No Plus unlock, extra permissions, or runtime dependencies.

Version 0.1.8 fixes the interruption prompt staying on screen during real playback even with v0.1.7 installed.

The failure was reproduced on live Songsterr: the extension found the right link and clicked it 2 ms after the prompt appeared, but Songsterr's own handler is not effective that early. It cancelled the click without dismissing the prompt. Earlier versions read that cancellation as "the page consumed it", recorded the target as handled and never tried again, so the prompt stayed up for the rest of the session. The same synthetic click dismisses the prompt once the page is ready, so this was never a trusted-event or JavaScript-world problem.

Activation is now verified by outcome instead of by inspecting the click event. The validated free action is re-activated on a rate-limited interval until the prompt has actually disappeared, and stops the moment it does.

Identification was also made resilient to changes Songsterr has already shipped. The generated `.w_eHuW_continueLink` class is a per-build CSS-module hash and the whole naming scheme has changed at least once; the headline sentence has been rewritten at least once too. Neither is used any more. A visible Upgrade link or Use Synth control corroborates the prompt, which also covers app builds that render an app-store action instead of a `/plus` link.

Hidden, disabled, navigating, submitting, near-match, localized and unrelated targets remain fail-closed. The extension never clicks **Upgrade** or **Use Synth**, never hides the popup with CSS, and does not remove Songsterr's real sync pauses.

Download the ZIP below, extract it, select that folder with **Load unpacked** in `brave://extensions` or `chrome://extensions`, then reload open Songsterr tabs.
