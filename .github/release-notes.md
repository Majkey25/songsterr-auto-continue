# Songsterr Auto Continue v0.1.12

Automatically chooses Songsterr's free **continue with sync pauses** action. Normal sync pauses remain. No Plus unlock or runtime dependencies.

Version 0.1.12 keeps one debugger connection while retrying a prompt, reducing repeated attachment and detachment. Each click still requires fresh target and document validation. Reaching the 12-second limit no longer disables later prompts in the same page.

The powerful `debugger` permission introduced in 0.1.11 remains required. A browser debugging banner may stay visible during an operation, up to 12 seconds. Read the README and privacy notice before enabling it.

The extension never clicks **Upgrade** or **Use Synth**, never hides the popup with CSS, and does not remove Songsterr's real sync pauses.

Download the ZIP below, extract it, select that folder with **Load unpacked** in `brave://extensions` or `chrome://extensions`, then reload open Songsterr tabs.

For an existing unpacked installation, replace its files, click **Reload** on the extension card, and reload Songsterr tabs.
