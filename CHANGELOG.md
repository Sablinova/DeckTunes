# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
