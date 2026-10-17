type NavNode = {
  m_element?: Element
  Element?: Element
  m_pElement?: Element
  element?: Element
}
type NavTree = {
  m_ID?: string
  m_lastFocusNode?: NavNode
  m_LastFocusNode?: NavNode
  m_Root?: NavNode
  Root?: NavNode
}
type NavContext = {
  m_lastFocusNode?: NavNode
  m_LastFocusNode?: NavNode
  ActiveElementNavNode?: NavNode
  m_LastActiveNavTree?: NavTree
  m_rgGamepadNavigationTrees?: NavTree[]
}
type NavController = {
  m_ActiveContext?: NavContext
  m_LastActiveContext?: NavContext
}
export type SteamFocusWindow = Window & {
  FocusNavController?: NavController
  GamepadNavTree?: { m_context?: { m_controller?: NavController } }
  SteamUIStore?: {
    NavigationManager?: NavController
    WindowStore?: {
      GamepadUIMainWindowInstance?: { BrowserWindow?: Window }
      SteamUIWindows?: { BrowserWindow?: Window }[]
    }
  }
}
export type HomeFocusInspection = {
  appId: number | null
  route: string
  reason: string
  focusSource: string
  appIdSource?: string
}

export function steamRoute(win: Window | null | undefined): string {
  if (!win) return ''
  const route = win.location.hash?.startsWith('#/')
    ? win.location.hash.slice(1).split('?')[0]
    : win.location.pathname
  return (route ?? '').replace(/^\/routes(?=\/)/i, '')
}

function controllers(win: Window): NavController[] {
  const host = win as SteamFocusWindow
  return [
    host.GamepadNavTree?.m_context?.m_controller,
    host.FocusNavController,
    host.SteamUIStore?.NavigationManager
  ].filter((value): value is NavController => !!value)
}
function contexts(controller: NavController): NavContext[] {
  return [controller.m_ActiveContext, controller.m_LastActiveContext].filter(
    (value): value is NavContext => !!value
  )
}
function elementOf(node?: NavNode): Element | undefined {
  return node?.m_element ?? node?.Element ?? node?.m_pElement ?? node?.element
}
export function navigationDocuments(win: Window): Document[] {
  const documents: Document[] = []
  for (const controller of controllers(win)) {
    for (const context of contexts(controller)) {
      for (const tree of context.m_rgGamepadNavigationTrees ?? []) {
        const doc = elementOf(tree.Root ?? tree.m_Root)?.ownerDocument
        if (doc && !documents.includes(doc)) documents.push(doc)
      }
    }
  }
  return documents
}
function navigationFocus(hosts: Window[]): Element | undefined {
  for (const host of hosts) {
    for (const controller of controllers(host)) {
      for (const context of contexts(controller)) {
        // Active QAM/modal focus takes precedence over a stale remembered Home card.
        const direct = elementOf(
          context.m_lastFocusNode ??
            context.m_LastFocusNode ??
            context.ActiveElementNavNode
        )
        if (direct) return direct
        for (const tree of [
          context.m_LastActiveNavTree,
          ...(context.m_rgGamepadNavigationTrees ?? [])
        ]) {
          const focused = elementOf(
            tree?.m_lastFocusNode ?? tree?.m_LastFocusNode
          )
          if (focused) return focused
        }
      }
    }
  }
  return undefined
}
function appId(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (!/^\d+$/.test(String(value))) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 && id <= 0xffffffff ? id : null
}
function propsAppId(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const props = value as Record<string, unknown>
  for (const key of ['appid', 'appId', 'nAppID', 'unAppID']) {
    const id = appId(props[key])
    if (id) return id
  }
  for (const key of ['overview', 'appOverview', 'app']) {
    const overview = props[key] as Record<string, unknown> | undefined
    const id = overview && (appId(overview.appid) ?? appId(overview.appId))
    if (id) return id
  }
  return null
}
function focusedAppId(focused: Element): { id: number; source: string } | null {
  const card = focused.closest<HTMLElement>('[data-appid]')
  if (card) {
    const id = appId(card.getAttribute('data-appid'))
    return id ? { id, source: 'data-appid' } : null
  }
  // Native Steam cards need not carry Deck-Shelves' data-appid. Inspect only
  // the focused element's ancestor fibers, never sibling games or children arrays.
  type Fiber = {
    memoizedProps?: unknown
    pendingProps?: unknown
    return?: Fiber
  }
  const element = focused as unknown as Record<string, unknown>
  const propsKey = Object.keys(element).find((key) =>
    key.startsWith('__reactProps$')
  )
  const propsId = propsAppId(propsKey ? element[propsKey] : undefined)
  if (propsId) return { id: propsId, source: 'React props' }
  const fiberKey = Object.keys(element).find(
    (key) =>
      key.startsWith('__reactFiber$') ||
      key.startsWith('__reactInternalInstance$')
  )
  let fiber = (fiberKey ? element[fiberKey] : undefined) as Fiber | undefined
  for (let depth = 0; fiber && depth < 12; depth++, fiber = fiber.return) {
    const id = propsAppId(fiber.memoizedProps) ?? propsAppId(fiber.pendingProps)
    if (id) return { id, source: 'React overview' }
  }
  // Accept a single capsule; never pick the first game image of a whole carousel.
  const images = focused.querySelectorAll?.('img')
  if (images?.length === 1) {
    const src = images[0].getAttribute('src') ?? ''
    const match = src.match(
      /\/(?:steam\/apps|assets|librarycache)\/(\d+)(?:\/|_)/i
    )
    const id = appId(match?.[1])
    if (id) return { id, source: 'capsule artwork' }
  }
  return null
}
export function inspectHomeFocus(
  doc: Document,
  hosts: Window[] = doc.defaultView ? [doc.defaultView] : []
): HomeFocusInspection {
  const win = doc.defaultView
  const route = steamRoute(win)
  const result: HomeFocusInspection = {
    appId: null,
    route,
    reason: 'No focused game card',
    focusSource: 'none'
  }
  if (!win || !/^\/library\/home\/?$/i.test(route))
    return { ...result, reason: 'Not on the Home screen' }
  if (doc.hidden) return { ...result, reason: 'Steam window is hidden' }
  const navFocus = navigationFocus(hosts)
  const gamepadFocus = Array.from(doc.querySelectorAll('.gpfocus'))
  const candidates = navFocus
    ? [navFocus]
    : gamepadFocus.length
      ? gamepadFocus.reverse()
      : [doc.activeElement]
  result.focusSource = navFocus
    ? 'Steam navigation tree'
    : gamepadFocus.length
      ? 'gpfocus'
      : 'DOM focus'
  for (const focused of candidates) {
    if (!focused || (focused.ownerDocument && focused.ownerDocument !== doc))
      continue
    if (!focused.getClientRects().length) continue
    const style = win.getComputedStyle(focused)
    if (style.visibility === 'hidden' || style.display === 'none') continue
    const found = focusedAppId(focused)
    if (found)
      return {
        ...result,
        appId: found.id,
        appIdSource: found.source,
        reason: 'Game card detected'
      }
    result.reason = 'Focused control has no game AppID'
  }
  return result
}
export function getFocusedHomeAppId(doc: Document): number | null {
  return inspectHomeFocus(doc).appId
}
