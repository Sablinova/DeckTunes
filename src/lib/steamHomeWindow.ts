import {
  navigationDocuments,
  navigationFocus,
  SteamFocusWindow,
  steamRoute
} from './homeFocus'

export function findSteamHomeWindow(
  current: Window,
  preferred?: Window,
  main?: Window,
  fallback?: () => Window | undefined
): { doc?: Document; hosts: Window[] } {
  const windows: Window[] = []
  const push = (candidate?: Window | null) => {
    try {
      if (candidate?.document && !windows.includes(candidate))
        windows.push(candidate)
    } catch {
      /* Closed or foreign Steam windows are not usable hosts. */
    }
  }
  push(main)
  push(preferred)
  push(current)
  try {
    push(current.opener)
  } catch {
    /* Opener may have been closed. */
  }
  for (const host of [...windows]) {
    const store = (host as SteamFocusWindow).SteamUIStore?.WindowStore
    push(store?.GamepadUIMainWindowInstance?.BrowserWindow)
    for (const item of store?.SteamUIWindows ?? []) push(item.BrowserWindow)
    for (const doc of navigationDocuments(host)) push(doc.defaultView)
  }
  try {
    push(fallback?.())
  } catch {
    /* Older findSP() can fail on modern nav trees. */
  }
  // Recognize non-Home Steam routes too, avoiding stale Home windows behind details.
  const host =
    windows.find((win) =>
      /^\/(?:library|gamethememusic|steamweb|store)(?:\/|$)/i.test(
        steamRoute(win)
      )
    ) ?? windows.find((win) => win.document.title === 'SP')
  // The router window can retain a Home document after Steam moves the live UI
  // to another renderer. The active navigation node is the authority for which
  // Home document actually owns focus. Never override a non-Home main route.
  const focusHosts = [current, ...windows.filter((win) => win !== current)]
  const focusedDocument = navigationFocus(focusHosts)?.ownerDocument
  const onHome = (win?: Window | null) =>
    /^\/library\/home\/?$/i.test(steamRoute(win))
  if (
    (!host || onHome(host)) &&
    focusedDocument &&
    onHome(focusedDocument.defaultView) &&
    !focusedDocument.hidden
  ) {
    push(focusedDocument.defaultView)
    return {
      doc: focusedDocument,
      hosts: [current, ...windows.filter((win) => win !== current)]
    }
  }
  return { doc: host?.document, hosts: focusHosts }
}
