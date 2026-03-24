# 🎵 DeckTunes

> **Credits:** DeckTunes is a modernized fork of [SDH-GameThemeMusic](https://github.com/moraroy/SDH-GameThemeMusic) by [moraroy](https://github.com/moraroy), which itself was a maintained fork of the original plugin by [OMGDuke](https://github.com/OMGDuke). Full credit and gratitude to both original authors for their excellent work.

**Automatic game theme music for Steam Deck** - Plays your favorite game soundtracks automatically when you launch games.

[![Chat](https://img.shields.io/badge/chat-on%20discord-7289da.svg)](https://deckbrew.xyz/discord)

## ✨ Features

- 🎮 **Automatic theme music** - Plays when you view a game in your library
- 🔍 **Powered by yt-dlp** - Searches YouTube for official game soundtracks
- 📦 **Offline playback** - Downloads themes locally for instant playback
- 🔄 **Auto-update** - Keep yt-dlp up-to-date with built-in update manager
- ⚙️ **Customizable** - Volume control, auto-play toggle, loop settings
- 🔌 **Backwards compatible** - Imports settings from SDH-GameThemeMusic

## 🆕 What's New in DeckTunes

### v1.8.6
- ✅ **yt-dlp update notification on load** - Get notified when an update is available
- ✅ **Fixed context menu crash** on Oct 2025+ Steam client updates

### v1.8.5
- ✅ **Fixed critical audio playback issue** caused by March 2026 Steam Deck updates
- ✅ **yt-dlp auto-update** functionality with manual controls in settings
- ✅ **Modernized dependencies** for better reliability and security
- ✅ **Improved error handling** and logging throughout
- ✅ **CI/CD pipeline** for automated builds and releases

![DeckTunes Screenshot](./assets/screenshot.jpg)

## 📦 Installation

### Via Decky Loader Plugin Store (Coming Soon)
1. Open Decky Loader on your Steam Deck
2. Go to the Plugin Store
3. Search for "DeckTunes"
4. Click Install

### Manual Installation (For Now)
1. Download the latest release from [Releases](https://github.com/Sablinova/DeckTunes/releases)
2. Extract the archive
3. Copy the `DeckTunes` folder to `~/homebrew/plugins/`
4. Restart Steam or reload Decky Loader

### Requirements

- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) installed
- Internet connection (for initial theme downloads)

## 🎮 Usage

1. **Launch DeckTunes** from the Decky Loader menu (... button → Plugins)
2. **Navigate to a game** in your library
3. **Theme music plays automatically** (if auto-play is enabled)
4. **Customize settings** in the DeckTunes menu:
   - Volume control
   - Auto-play on/off
   - Loop playback
   - yt-dlp updates
5. **Customize per-game themes** via the game's context menu

![Customize themes](./assets/screenshot2.jpg)

## 🔧 Settings

### Audio Settings
- **Volume** - Adjust theme music volume (0-100%)
- **Auto-play** - Automatically play themes when viewing games

### yt-dlp Updates
- **Current Version** - Shows installed yt-dlp version
- **Latest Version** - Shows latest available version
- **Update Button** - Manually update yt-dlp

## 🤝 Compatibility

- **AudioLoader Integration** - Compatible with [AudioLoader](https://github.com/EMERALD0874/SDH-AudioLoader) plugin (v1.5.0+)
- **Non-Steam Games** - Full support for non-Steam games
- **Decky Loader** - Tested with Decky Loader v3.1.x through v3.2.x

## 🐛 Troubleshooting

### Music won't play
- Check that you have an internet connection (for initial download)
- Check plugin logs in Decky Loader (Settings → Developer → Plugin Logs)
- Try manually downloading a theme for a game via the context menu
- Ensure yt-dlp is up-to-date (use the update button in settings)

### Audio stutters or cuts out
- Check available storage space on your Steam Deck
- Try lowering the volume
- Check system audio settings
- Verify no other audio plugins are conflicting

### Settings not saving
- Ensure the plugin has write permissions to `~/.local/share/decky/plugins/DeckTunes/`
- Try restarting Steam
- Check Decky Loader logs for permission errors

### Migrating from SDH-GameThemeMusic
- DeckTunes will automatically import your settings on first launch
- Your existing music library and preferences will be preserved
- You can safely uninstall the old plugin after confirming everything works

## 🙏 Credits & History

**DeckTunes** is built on the shoulders of giants:

- **[OMGDuke](https://github.com/OMGDuke)** - Original SDH-GameThemeMusic plugin creator
- **[moraroy](https://github.com/moraroy)** - Maintainer who added Windows support, improved logging, and kept the plugin alive through 2025
- **[Sablinova](https://github.com/Sablinova)** - Current maintainer (DeckTunes fork)

If this plugin enhances your Steam Deck experience, please consider starring all three repositories!

### Why a New Fork?

This fork was created to:
1. Fix critical playback issues introduced by March 2026 Steam Deck system updates
2. Modernize dependencies and tooling for long-term maintainability
3. Add community-requested features (auto-updates, better error handling)
4. Ensure continued active maintenance and support
5. Provide a stable, reliable experience on current and future Steam Deck firmware

All improvements made here are offered back to the community with gratitude for the original excellent work.

## 🌍 Localisation

Localisation support is inherited from the original plugin via [Crowdin](https://crowdin.com/project/sdh-gamethememusic). 

Current translations include: Bulgarian, Chinese (Simplified & Traditional), Czech, Danish, Dutch, Finnish, French, German, Greek, Hungarian, Italian, Japanese, Korean, Norwegian, Polish, Portuguese (EU & Brazilian), Romanian, Russian, Spanish (EU & Latin America), Swedish, Thai, Turkish, Ukrainian, and Vietnamese.

Thank you to all the community translators!

## 📄 License

GPL-2.0-or-later

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/Sablinova/DeckTunes/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Sablinova/DeckTunes/discussions)
- **Decky Loader Discord:** [Join the community](https://deckbrew.xyz/discord)

## 🔗 Related Projects

- [ProtonDB Badges](https://github.com/OMGDuke/protondb-decky) - Another excellent plugin by OMGDuke
- [AudioLoader](https://github.com/EMERALD0874/SDH-AudioLoader) - Complementary audio plugin for Steam Deck
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) - The plugin framework that makes this possible

---

**Made with ❤️ for the Steam Deck community**
