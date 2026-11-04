# Songsterr Auto Continue

[![CI](https://github.com/Majkey25/songsterr-auto-continue/actions/workflows/ci.yml/badge.svg)](https://github.com/Majkey25/songsterr-auto-continue/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Majkey25/songsterr-auto-continue)](https://github.com/Majkey25/songsterr-auto-continue/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)

Automatically clicks **“continue with sync pauses”** when Songsterr interrupts free Original Audio playback. **Songsterr's normal sync pauses remain.**

[![Download latest version](https://img.shields.io/badge/Download-latest%20version-2ea44f?style=for-the-badge&logo=github)](https://github.com/Majkey25/songsterr-auto-continue/releases/latest)

No settings, analytics, network requests, or runtime dependencies. A content script and service worker run the continuation on `https://www.songsterr.com/*`. Version 0.1.11 requires the powerful `debugger` permission because Songsterr now rejects programmatic DOM clicks.

[Privacy, data deletion, and terms of use](PRIVACY.md).

## Install in Brave / Chrome

1. Download the extension ZIP from [Releases](https://github.com/Majkey25/songsterr-auto-continue/releases).
2. Extract it into a permanent folder.
3. Open `brave://extensions` or `chrome://extensions`.
4. Enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
5. **Reload any open Songsterr tabs.** Select **Original**, then play a song. Installing the extension does not activate it in already open pages until they reload.

From a source checkout, load the **`extension/`** folder instead. Node/npm is only needed to run development tests.

To update, extract the new release, use **Reload** on the extension card, then reload Songsterr. Keep the installation folder; unpacked extensions load their files from it. Disable the extension from the same extensions page.

Updating to 0.1.11 adds a permission. Read the browser's permission warning before enabling it. `debugger` can inspect and control pages beyond Songsterr; the restriction to Songsterr is enforced by this extension's code, not by a browser host-permission boundary. A browser debugging banner may appear briefly during continuation. Cancelling it or an attachment error stops automation until the Songsterr page reloads.

## Behavior

Version 0.1.11 watches Songsterr DOM changes and looks for a
visible dialog that carries the interruption's own controls - a visible **Upgrade** link to `/plus`
or a visible **Use Synth** control - then targets the action inside it whose exact normalized text is
**continue with sync pauses** and which cannot navigate away or submit a form.

Songsterr requires a trusted click. The content script requests continuation without supplying a
tab ID, coordinates, JavaScript, or a debugger command. The worker accepts only its own top-level
Songsterr content script, checks the current page, and revalidates the control in an isolated world.
It clicks only when the control is visible and under the click point, then detaches the debugger.
Retries are spaced by at least 50 ms and stop when the prompt disappears or the 12 s budget expires.
Detection uses neither generated class names nor the headline sentence.

It never clicks Upgrade or Use Synth, changes subscriptions, hides the popup with CSS, removes ads, or bypasses the actual sync pauses. It has no relationship with Songsterr.

Hidden, disabled, navigating, submit, near-match, and localized targets cause it to do nothing. Changed site markup can still require an update. A brief visible prompt is possible; zero flicker is not guaranteed.

## Verify

Play free Original Audio long enough to reach multiple interruption prompts. Each prompt should dismiss itself while Original remains selected. Compare with the extension disabled: the same free continuation should be available manually. Other dialogs should remain usable.

There is no production logging. Errors, if any, appear in the browser's extension card or developer console. Include browser version, page URL, and the prompt's HTML when [reporting a bug](https://github.com/Majkey25/songsterr-auto-continue/issues); remove account details first.

## Development

Requires Node.js 22+ and npm. No bundler or build step.

```sh
npm ci
npx playwright install chromium
npm run check
npm test
```

The tests load the real unpacked extension into isolated Chromium and exercise controlled DOM fixtures, including the exact prompt markup captured from live Songsterr and the delayed page-handler readiness that caused the 0.1.7 failure. Fixtures dismiss the prompt when the free action is activated, so clicking without dismissing cannot pass. They never replace the extension with a page-script mock. For a local Brave executable:

```sh
node tests/extension.test.cjs "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"
```

Optional live check, requiring reachable Songsterr and YouTube playback:

```sh
node tests/live.cjs "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"
```

It uses an isolated temporary profile, observes real interruption cycles when playback is available, and saves results under `.reference/tmp/`. It does not run in CI. See [engineering evidence](docs/engineering.md) for measured results and limitations.

## Releases

CI tests and packages the extension on every pull request and `main` push. After a green `main` run, it publishes the stable `v<manifest version>` GitHub release if that version does not already exist. Release ZIPs include only manifest-referenced runtime files, icons, this README, the privacy notice, and the MIT license; SHA-256 checksums accompany each release.
