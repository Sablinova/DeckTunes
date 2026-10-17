# Home Screen Music Preview

Enable **Home Screen Music Preview** in DeckTunes settings to preview the theme
of a focused game card on the Steam Deck Gaming Mode Home screen. It is disabled
by default, including for existing settings files.

After a card stays focused for 500 ms, DeckTunes reads that game's
`game-theme-music-cache` entry and resolves its saved video ID through the selected
yt-dlp or Invidious resolver. If no theme is saved and Saved themes only is off, it
searches for `<game name> Theme Music` through the same resolver, plays the result,
and saves the video ID for future previews and game-details playback. Enable
**Use yt-dlp** to search YouTube directly. Resolver/network latency and any queued
search can add to the 500 ms wait.
Previously downloaded audio is reused by the existing yt-dlp backend. A cached
selection can still require network access if the audio is not downloaded.

Games explicitly set to **No Music** stay silent. With **Saved themes only** enabled,
saved themes are allowed and games without a theme stay silent. With it disabled,
uncached games and volume-only cache entries can discover a theme automatically.
Automatic discovery streams the result and saves its selection; it does not
download a full audio file, matching the existing game-details discovery behavior.
Search failures and missing game names remain silent without writing a cache entry.
The saved per-game volume takes priority over the global volume, including a
per-game volume of zero.

Home, details, and game settings use one theme-resolution function and the same
AppID cache entry. Applying a song or No Music changes all three views; mounted
views observe selection changes, and an already-focused Home card refreshes its
preview. Automatic discovery only fills a missing selection and cannot overwrite
a manual choice. A losing discovery resolves the winning saved song instead.

Automatic discovery uses a separate yt-dlp subprocess from manual search. Only
background discoveries queue together; a slow automatic search cannot hold up
Change Theme Music. Manual searches replace older searches and use generation tokens so old
iterators cannot consume new results. Obsolete discovery requests are skipped, and
cancelled results cannot start playback or save a selection. A manual theme or No Music selection made
during discovery takes precedence over the automatic result.

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
- [focusRestore](https://github.com/santojon/Deck-Shelves/blob/b46fbf84d590783ff95132df75cf30ba09708b08/src/core/focusRestore.ts)
  reads the active navigation context's `m_lastFocusNode` and tree focus because
  some clients apply neither `gpfocus` nor DOM focus consistently. It also handles
  the modern `GamepadUI_Full_Root` tree instead of relying on the older `root_1_`.
- [PerShelfHero](https://github.com/santojon/Deck-Shelves/blob/b46fbf84d590783ff95132df75cf30ba09708b08/src/components/shelf/PerShelfHero.tsx)
  explains that Steam's native gamepad navigation can change `gpfocus` without
  firing `focusin`, and also supports actual DOM focus on clients without that class.
- [steamHost](https://github.com/santojon/Deck-Shelves/blob/b46fbf84d590783ff95132df75cf30ba09708b08/src/runtime/steamHost.ts)
  distinguishes the actual Steam window/document from the plugin host context.

DeckTunes finds the Gaming Mode document through its rendered host, Steam's main
window store, or navigation-tree root documents, with Decky's legacy `findSP()`
as a fallback. If the router retains an older Home document, a live Home navigation
node's actual `ownerDocument` takes priority, including during the handoff before
the next polling tick. Hidden, disconnected, or empty-layout remembered navigation
nodes are skipped. Visible remembered nodes in unrelated `/login` or bootstrap
renderers are also skipped so other controllers, tree focus, and Home DOM focus
can be checked. A `GamepadUI_Full_Root` tree may render the actual Home card in an
`/index.html` shell while the routing document reports `/library/home`; its focused
card is accepted using tree identity rather than rejecting its document URL.
If the context remembers the tree root, use the tree's live focused descendant.
A non-Home main route still suppresses previews. Steam's focused-window API and
actual foreign-document focus suppress previews while Quick Access owns input. It recognizes
both `/library/home` and `/routes/library/home`,
including hash routes. Active navigation-context focus takes priority over DOM
classes, including while Quick Access or a modal owns focus. `gpfocus` and actual
DOM focus are fallbacks.

For a focused card, DeckTunes reads `data-appid` when available. Native Steam
cards can instead expose AppIDs in their direct React props or bounded ancestor
fibers (`overview`, `appOverview`, `app`, or AppID props). A single capsule artwork
inside the focused node can identify a card when neither is available. It never
walks sibling games or page-wide React children, and never chooses the first
artwork of a multi-card carousel. A MutationObserver handles card replacement; focus and
visibility events provide immediate updates. An enabled-only 100 ms fallback
handles `pushState`, running-app changes, and late/replaced Steam documents.
The 500 ms debounce starts when a focus change is observed; repeated observations
of the same AppID do not restart it or create another audio element.

Deck-Shelves is a research reference, not a runtime dependency. Steam DOM and
window APIs are unofficial: a client that exposes none of these usable focus/AppID
signals will stay silent. Native Home game focus has been reported working on Steam Deck. Deck-Shelves
compatibility and other Steam client versions still require confirmation; local
tests simulate their focus contracts.

## Local validation

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run test:backend
pnpm exec tsc --noEmit --skipLibCheck
pnpm run build
```

The tests cover debounce, rapid navigation, repeated focus, automatic discovery,
cache reuse, Saved themes only, No Music, isolated Home searches, manual search generation tokens,
per-game/global volume, stale resolver responses, page/launch inhibition,
AudioLoader ownership, live settings migration/updates, media errors, and cleanup.
Tests use Node's test runner and the already-installed TypeScript transpiler.

`--skipLibCheck` skips existing dependency declaration conflicts: `SteamClient` is
declared by both this project and Decky UI, Decky API references absent
`react-router` types, and the locked Node types conflict with newer TypeScript DOM
declarations. The application source passes type checking with that flag.

## Steam Deck Gaming Mode test checklist

Home previews and game-details playback have been reported working by the user
on Steam Deck Gaming Mode. The development environment cannot run Steam Deck
hardware tests; the checklist below covers additional scenarios and client
configurations. Record the Steam client channel/version, SteamOS version, and Decky version.

1. Install the DeckTunes ZIP using Decky's developer **Install Plugin From Zip**
   flow. With existing settings, verify the new toggle is off. Open game details
   and confirm normal theme playback and Change Theme Music still work.
2. Prepare two games with different cached themes by opening their details pages
   or choosing themes. Download one through the existing yt-dlp settings. Give
   one a per-game volume different from the global volume. Prepare a third game
   with **No Music**, plus a game with no cached selection. For automatic YouTube
   discovery, enable Use yt-dlp and disable Saved themes only.
3. Enable **Home Screen Music Preview** and close Quick Access. On the native Home
   recent-games row, focus a cached game with the D-pad. Confirm one looping theme
   starts after at least 500 ms plus any resolver latency. Verify the game volume,
   then a zero-volume override and the global-volume fallback.
4. Scroll rapidly between cards in under 500 ms. Confirm intermediate games do
   not resolve/play, old audio stops immediately, and only the final card plays
   after its own debounce. Leave the same card selected and verify no restarts.
5. Focus No Music: confirm silence and no theme search or changed selection. Focus
   an uncached game without visiting its details: confirm automatic search and
   playback after the debounce plus network latency. Refocus it and verify the
   saved selection is reused. Repeat with Saved themes only enabled: uncached games
   stay silent while cached themes remain allowed. Verify a volume-only override
   survives discovery, and a search failure does not save an empty/No Music entry.
6. Move focus to Home navigation/non-game controls and visit Library or Store.
   Confirm the Home preview stops. Return Home and verify a fresh debounce.
7. While music plays, open that game's details and a different game's details.
   Confirm only the existing details player plays, with no overlapping Home
   audio. Repeat before the debounce expires and while the resolver is slow.
   Start an uncached Home search and then open Change Theme Music: verify each
   search shows results for its own game. Apply a new song and confirm both
   details and Home reuse that exact selection without another search. Apply
   No Music and confirm both views stop; repeat with Download Audio enabled. Switch cards during a search and verify
   the old result neither plays nor changes the old game's selection. Select No
   Music manually while a search is in flight and confirm it remains selected.
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

## Diagnosing silence on hardware

After installing the updated ZIP, enable the preview, close Quick Access, and
focus a game that plays correctly on its details page. Wait several seconds, then
open DeckTunes and choose **Tools & support → Open tools → Diagnostics → Home Preview Diagnostics**.
The report identifies build `home-preview-window-focus-v6` and retains the last playback
result and attempted AppID even when opening Quick Access changes current focus.

- `runtime: Not started`: the global preview component has not mounted.
- `Steam UI window not found`: no usable Steam window/document was found.
- `Not on the Home screen`: check the recorded route.
- `Focused control has no game AppID`: focus exists, but card identification failed.
- `ignoredNavigationNodes`: remembered nodes were disconnected or had no visible
  layout, or belonged to unrelated login/bootstrap documents. Other controllers,
  tree focus, and live DOM/gamepad focus remain eligible as fallbacks.
- `Navigation focus belongs to a different Steam document` / `Another Steam
  window owns input focus`: input is in another window, such as Quick Access.
- `focusDocumentRoute: /index.html` with `focusTreeId: GamepadUI_Full_Root`:
  Home is rendered in Steam's shell document; this combination is accepted.
  `focusNode` records the selected node's tag/class for further identification.
- Theme search blocked by **Saved themes only**, or **No Music** selected: intentional silence.
- `search returned no playable theme` / `saved theme has no playable audio URL`:
  card detection worked; investigate the selected resolver or saved theme.
- `Playback failed`: the media element reported a failure or rejected play().

Capture that report for further debugging. Current QAM focus can report no game;
`lastAppId` and `lastResult` preserve what happened before the menu was opened.
`recentFocus` also retains recent changed focus inspections, so a menu's current
focus does not erase the observations made while selecting Home cards.
The original cached-only build did not have this diagnostic panel. A successful
build or local mock test does not establish on-device compatibility.

## yt-dlp updates and search errors

The existing DeckTunes **Check for Updates / Update yt-dlp** controls remain
available inside Decky. The active binary lives in
`DECKY_PLUGIN_RUNTIME_DIR/bin/yt-dlp`, alongside the existing persistent music
data. Startup seeds that directory from the bundled binary only if it is missing.
Installing another plugin ZIP does not overwrite an existing persistent update.
Future yt-dlp releases can still be installed using the same settings controls;
a new plugin ZIP is not required. This persistence applies to plugin updates
that retain Decky's runtime data.

The bundled fallback is pinned to 2026.08.19. This backend change requires a full
plugin ZIP installation and reload. First leave Home Screen Music Preview off
and verify normal details playback and Change Theme Music. yt-dlp failures now
show the actual backend error and a retry button rather than silently looking
like an empty result set. No Music remains an explicit manual selection.
If search still fails on hardware, capture the complete displayed error.

To verify update persistence, record Current Version, use Update yt-dlp when a
new release is available, reinstall a plugin ZIP while retaining runtime data,
and verify the updated Current Version is retained and Check for Updates still
works. Backend tests exercise the existing update action writing to persistent
storage, ZIP reinstall behavior, error propagation, search isolation, and unload.

For the cross-document focus regression, verify build `home-preview-window-focus-v6`.
Close Quick Access, focus two cached native Home games with the D-pad, and wait
several seconds on each. Confirm `lastAppId` records the selected game and audio
switches. Reopen Quick Access and confirm audio stops, then close it and confirm
a fresh debounce. Check that entering details and launching a game still stops
the Home owner. The local suite simulates stale `/login` focus before a Home
card in an `/index.html` main navigation tree. The user subsequently reported
Home playback working on their Steam Deck.
