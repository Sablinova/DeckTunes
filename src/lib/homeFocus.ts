export function getFocusedHomeAppId(doc: Document): number | null {
  const win = doc.defaultView
  const route = win?.location.hash?.startsWith('#/')
    ? win.location.hash.slice(1).split('?')[0]
    : win?.location.pathname
  // Use the actual Gaming Mode window, not Decky's about:blank host document.
  if (!win || !/^\/library\/home\/?$/i.test(route ?? '') || doc.hidden)
    return null

  // Steam's BTakeFocus navigation can change gpfocus without a DOM focus event.
  // The focused node can also be a child inside the card carrying data-appid.
  const gamepadFocus = Array.from(doc.querySelectorAll('.gpfocus'))
  const candidates = gamepadFocus.length ? gamepadFocus : [doc.activeElement]
  for (const focused of candidates.reverse()) {
    const card = focused?.closest<HTMLElement>('[data-appid]')
    if (!card || !card.getClientRects().length) continue
    const style = win.getComputedStyle(card)
    if (style.visibility === 'hidden' || style.display === 'none') continue
    const value = card.getAttribute('data-appid') ?? ''
    if (!/^\d+$/.test(value)) continue
    const appId = Number(value)
    if (Number.isSafeInteger(appId) && appId > 0 && appId <= 0xffffffff) {
      return appId
    }
  }
  return null
}
