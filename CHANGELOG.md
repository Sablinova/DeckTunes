# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.0] - 2026-10-17

### Added
- Experimental Home Screen Music Preview for Steam Deck Gaming Mode, disabled by default. Focus a game card for 500 ms to preview its saved theme or discover one using the configured music source.
- Shared theme resolution and song selections across Home, game details, and per-game settings, including No Music and per-game volume.
- Home preview diagnostics under Tools & support.

### Changed
- Group settings into Playback, Music source, Updates, and Tools & support while retaining backup, restore, downloads, community, and QR-code controls.
- Refresh theme selection with separate Preview and Apply actions, a compact No Music row, consistent button sizing, and clearer English and Chinese text.
- Store yt-dlp updates in Decky's persistent runtime directory so plugin ZIP updates do not overwrite them. The existing in-Decky update controls remain available.
- Bundle checksum-pinned yt-dlp 2026.08.19.

### Fixed
- Detect Home game focus across Steam's routing and rendering documents, skipping stale login/bootstrap nodes and respecting Quick Access focus.
- Stop Home audio on focus changes, navigation to details, and game launch; discard stale search results and preserve manual song choices.
- Keep automatic theme discovery from blocking manual search, and surface search failures with a retry action.
- Constrain native Steam button widths, align the search controls, prevent horizontal page shifts during Tab navigation, and reduce About-page spacing.

## [1.8.0] - 2026-03-24

### Added
- Created independent fork "DeckTunes" continuing from SDH-GameThemeMusic v1.7.11
- HTTP Server backend for local file playback
- Auto-migration of settings and downloaded music from SDH-GameThemeMusic
- In-UI yt-dlp auto-updater with manual check button
- GitHub Actions CI/CD workflows for automated builds and releases

### Changed
- Refactored audio backend to serve local cached music via an internal HTTP server, fixing the March 2026 Chromium Embedded Framework update that broke base64 audio data URLs.
- Modernized all NPM dependencies fixing numerous vulnerabilities
- Updated remote yt-dlp binary to `2026.03.17`

### Removed
- Base64 data URL injection for cached music

## [1.7.11] - 2025-06-03
### Changed
- *Previous releases by moraroy and OMGDuke...*
