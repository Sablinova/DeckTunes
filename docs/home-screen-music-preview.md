# Home Screen Music Preview (experimental)

Enable **Home Screen Music Preview** in DeckTunes settings to preview the theme
of a focused game card on the Steam Deck Gaming Mode Home screen. It is disabled
by default, including for existing settings files.

After a card stays focused for 500 ms, DeckTunes reads that game's existing
`game-theme-music-cache` entry and resolves its saved video ID through the selected
yt-dlp or Invidious resolver. Resolver/network latency can add to the 500 ms wait.
Previously downloaded audio is reused by the existing yt-dlp backend. A cached
selection can still require network access if the audio is not downloaded.

Games without a cached video ID, volume-only cache entries, and games explicitly
set to **No Music** stay silent. Home browsing never searches for new themes,
downloads new selections, or writes cache entries. Default Muted retains its
existing behavior: saved themes are allowed, and games without a theme stay silent.
The saved per-game volume takes priority over the global volume, including a
per-game volume of zero.

Changing focus immediately releases the previous audio. Leaving Home, hiding the
Steam document, entering a game page, starting a game, disabling the toggle, or
unloading the plugin cancels pending playback and stops active previews. Page
playback claims audio synchronously, so opening game details restarts the normal
page theme without overlapping the Home preview. Previews stay suppressed while
any game is running, including when returning Home over a running game.

## Focus detection research

Investigated Deck-Shelves at commit
[`b46fbf8`](https://github.com/santojon/Deck-Shelves/tree/b46fbf84d590783ff95132df75cf30ba09708b08):

- [SearchOverlay](https://github.com/santojon/Deck-Shelves/blob/b46fbf84d590783ff95132df75cf30ba09708b08/src/features/search/SearchOverlay.tsx)
  uses `.gpfocus[data-appid]` to capture a focused game card.
- [focusedCardTracker](https://github.com/santojon/Deck-Shelves/blob/b46fbf84d590783ff95132df75cf30ba09708b08/src/core/focusedCardTracker.ts)
  reads `data-appid`, subscribes to focus events, and seeds from gamepad/DOM focus.
- [PerShelfHero](https://github.com/santojon/Deck-Shelves/blob/b46fbf84d590783ff95132df75cf30ba09708b08/src/components/shelf/PerShelfHero.tsx)
  explains that Steam's native gamepad navigation can change `gpfocus` without
  firing `focusin`, and also supports actual DOM focus on clients without that class.
- [steamHost](https://github.com/santojon/Deck-Shelves/blob/b46fbf84d590783ff95132df75cf30ba09708b08/src/runtime/steamHost.ts)
  distinguishes the actual Steam window/document from the plugin host context.

DeckTunes uses the Gaming Mode main window (with Decky's `findSP()` fallback),
restricts detection to `/library/home`, and reads `data-appid` on the `.gpfocus`
element or its enclosing card. DOM focus is a fallback when no gamepad focus class
exists. A MutationObserver handles class changes and card replacement; focus and
visibility events provide immediate updates. An enabled-only 100 ms fallback
handles `pushState`, running-app changes, and late/replaced Steam documents.
The 500 ms debounce starts when a focus change is observed; repeated observations
of the same AppID do not restart it or create another audio element.

Deck-Shelves is a research reference, not a runtime dependency. Steam DOM and
window APIs are unofficial: a client that no longer exposes usable focus/AppID
data will stay silent. Native recent-game cards and Deck-Shelves cards both need
hardware confirmation; the local tests simulate their focus contracts.

## Local validation

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec tsc --noEmit --skipLibCheck
pnpm run build
```

The tests cover debounce, rapid navigation, repeated focus, cached-only resolution,
No Music, per-game/global volume, stale resolver responses, page/launch inhibition,
AudioLoader ownership, live settings migration/updates, media errors, and cleanup.
Tests use Node's test runner and the already-installed TypeScript transpiler.

`--skipLibCheck` skips existing dependency declaration conflicts: `SteamClient` is
declared by both this project and Decky UI, Decky API references absent
`react-router` types, and the locked Node types conflict with newer TypeScript DOM
declarations. The application source passes type checking with that flag.

## Steam Deck Gaming Mode test checklist

Hardware validation has not been performed in the development environment.
Record the Steam client channel/version, SteamOS version, and Decky version.

1. Install the experimental ZIP using Decky's developer **Install Plugin From Zip**
   flow. With existing settings, verify the new toggle is off. Open game details
   and confirm normal theme playback and Change Theme Music still work.
2. Prepare two games with different cached themes by opening their details pages
   or choosing themes. Download one through the existing yt-dlp settings. Give
   one a per-game volume different from the global volume. Prepare a third game
   with **No Music**, plus a game with no cached selection.
3. Enable **Home Screen Music Preview** and close Quick Access. On the native Home
   recent-games row, focus a cached game with the D-pad. Confirm one looping theme
   starts after at least 500 ms plus any resolver latency. Verify the game volume,
   then a zero-volume override and the global-volume fallback.
4. Scroll rapidly between cards in under 500 ms. Confirm intermediate games do
   not resolve/play, old audio stops immediately, and only the final card plays
   after its own debounce. Leave the same card selected and verify no restarts.
5. Focus No Music and uncached games. Confirm silence and no theme search or new
   cache entries. Repeat with Default Muted enabled; cached themes remain allowed.
6. Move focus to Home navigation/non-game controls and visit Library or Store.
   Confirm the Home preview stops. Return Home and verify a fresh debounce.
7. While music plays, open that game's details and a different game's details.
   Confirm only the existing details player plays, with no overlapping Home
   audio. Repeat before the debounce expires and while the resolver is slow.
8. Launch a game while previewing or resolving. Confirm playback stops on the
   app-lifetime notification and stays stopped when opening Home over the running
   game. Exit the game and verify previews recover. Reload DeckTunes with a game
   already running and verify silence.
9. Switch resolver/settings, disable the feature during playback/resolution,
   then enable it again. Confirm changes apply without plugin reload. Reload the
   plugin to confirm the toggle persists. Unload it during playback; verify no
   leftover music, duplicate listeners, or late starts.
10. With a downloaded yt-dlp theme, test offline playback. Test an unavailable
    stream/network failure; confirm no unhandled rejection and that another card
    can still play. If AudioLoader is installed, verify it pauses for preview/page
    music and resumes after release only when no game is running.
11. Repeat Home navigation with Deck-Shelves installed, including nested focused
    card controls, and with it disabled. Test native recent-game cards first;
    successful Deck-Shelves playback alone does not establish native compatibility.

For focus troubleshooting, inspect the actual Gaming Mode SP document at
`/library/home`, not Decky's host document. Check `.gpfocus[data-appid]`, a
`.gpfocus` child with a `[data-appid]` ancestor, and `document.activeElement`.
If Steam exposes none of those contracts, leave the experiment disabled and
capture the card markup before extending detection.
