# Songsterr Auto Continue v0.1.9

Automatically chooses Songsterr's free **continue with sync pauses** action. Normal sync pauses remain. No Plus unlock, extra permissions, or runtime dependencies.

Version 0.1.9 makes the prompt disappear roughly 100-160 ms sooner. Nothing else changes.

To find out how much room was actually left, the link was activated on every animation frame on the live site with no extension loaded, which leaves only Songsterr's own delay. The page starts accepting the click after **449, 458, 720, 2229, 2286 and 2306 ms** across six real prompts. That is the floor, and no extension can beat it. Version 0.1.8 dismissed the same prompts in 613-2420 ms, so its own 200 ms retry spacing was adding 97-164 ms on top of it.

The retry interval is now 50 ms, so at most 50 ms is added to whenever Songsterr becomes ready. The per-prompt cap became a 12 s budget instead of 60 attempts, so the shorter interval cannot shorten how long a slow prompt is pursued.

Detection, the safety rules and the outcome-verified activation from 0.1.8 are unchanged. The extension never clicks **Upgrade** or **Use Synth**, never hides the popup with CSS, and does not remove Songsterr's real sync pauses.

Download the ZIP below, extract it, select that folder with **Load unpacked** in `brave://extensions` or `chrome://extensions`, then reload open Songsterr tabs.
