# Changelog

## 0.1.2 - 2026-09-15

- Fixed intermittent missed continuation prompts caused by mount/readiness races.
- Rechecks recognized prompts across visibility and attribute changes.
- Waits for Songsterr's UI to finish mounting before activation.
- Added regression coverage for prompts whose click handler becomes available late, including repeated every-fourth-prompt failures.

## 0.1.1 - 2026-09-12

- Fixed continuation blocked by a stale entry-animation class on redesigned dialogs.
- Added a custom continuation icon at 16, 32, 48, and 128 pixels.
- Added a Download latest version button to the README.
- Publish standard GitHub releases with installable ZIPs and checksums.

## 0.1.0 - 2026-09-12

- Initial Brave / Chromium Manifest V3 extension.
- Automatically activates the exact free Original Audio continuation action.
- Validates dialog context without generated CSS classes; ignores unrelated, hidden, and disabled controls.
- Handles delayed text, replacement prompts, and SPA root replacement.
- No runtime dependencies, additional permissions, polling, CSS hiding, or network interception.
- Includes browser checks, release ZIPs, and SHA-256 checksums.
