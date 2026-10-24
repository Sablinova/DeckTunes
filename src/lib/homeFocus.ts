type NavNode = {
  m_element?: Element
  m_Element?: Element
  Element?: Element
  m_pElement?: Element
  element?: Element
  m_Tree?: NavTree
}
type NavTree = {
  m_ID?: string
  m_lastFocusNode?: NavNode
  m_LastFocusNode?: NavNode
  m_Root?: NavNode
  m_root?: NavNode
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
    GetFocusedWindowInstance?: () => { BrowserWindow?: Window } | undefined
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
  focusDocumentRoute?: string
  ignoredNavigationNodes?: string[]
  focusTreeId?: string
  focusNode?: string
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
  return (
    node?.m_element ??
    node?.m_Element ??
    node?.Element ??
    node?.m_pElement ??
    node?.element
  )
}
function visibleElement(element: Element): boolean {
  if (
    element.isConnected === false ||
    element.ownerDocument?.hidden ||
    !element.getClientRects().length
  )
    return false
  const view = element.ownerDocument?.defaultView
  if (!view) return true
  const style = view.getComputedStyle(element)
  return style.visibility !== 'hidden' && style.display !== 'none'
}
export function navigationDocuments(win: Window): Document[] {
  const documents: Document[] = []
  for (const controller of controllers(win)) {
    for (const context of contexts(controller)) {
      for (const tree of context.m_rgGamepadNavigationTrees ?? []) {
        const doc = elementOf(
          tree.Root ?? tree.m_Root ?? tree.m_root
        )?.ownerDocument
        if (doc && !documents.includes(doc)) documents.push(doc)
      }
    }
  }
  return documents
}
type NavigationFocus = { element: Element; tree?: NavTree }

function isHomeRenderer(doc: Document, tree?: NavTree): boolean {
  const route = steamRoute(doc.defaultView)
  return (
    /^\/library\/home\/?$/i.test(route) ||
    (/^\/(?:index\.html)?$/i.test(route) &&
      tree?.m_ID === 'GamepadUI_Full_Root')
  )
}

function navigationFocusCandidate(
  hosts: Window[],
  ignored?: string[],
  homeDocument?: Document
): NavigationFocus | undefined {
  const usable = (element: Element | undefined, tree?: NavTree) => {
    if (!element) return false
    if (!visibleElement(element)) {
      if (ignored && ignored.length < 6)
        ignored.push(
          `${element.isConnected === false ? 'Disconnected' : 'Hidden or empty-layout'} node in ${steamRoute(element.ownerDocument?.defaultView) || 'unknown document'}`
        )
      return false
    }
    const owner = element.ownerDocument
    const route = steamRoute(owner?.defaultView)
    // Steam retains visible nodes in bootstrap/login renderers. They must not
    // prevent checking other controllers, tree focus, or the Home DOM fallback.
    // A Full_Root tree can render Home in an index.html shell while the router
    // reports /library/home in a different document.
    if (
      !homeDocument ||
      !owner ||
      owner === homeDocument ||
      isHomeRenderer(owner, tree)
    )
      return true
    // Explicit overlay focus still blocks remembered Home cards.
    if (
      owner.hasFocus?.() ||
      /^\/(?:quickaccess|mainmenu|overlay|keyboard)(?:\/|$)/i.test(route)
    )
      return true
    if (ignored && ignored.length < 6)
      ignored.push(
        `Unrelated navigation document ${route || '(unknown route)'}; tree ${tree?.m_ID ?? '(none)'}`
      )
    return false
  }
  for (const host of hosts) {
    for (const controller of controllers(host)) {
      for (const context of contexts(controller)) {
        const trees = [
          context.m_LastActiveNavTree,
          ...(context.m_rgGamepadNavigationTrees ?? [])
        ].filter((tree): tree is NavTree => !!tree)
        // Active QAM/modal focus takes precedence over a stale remembered Home card.
        for (const node of [
          context.ActiveElementNavNode,
          context.m_lastFocusNode,
          context.m_LastFocusNode
        ]) {
          const direct = elementOf(node)
          const tree =
            node?.m_Tree ??
            trees.find((candidate) => {
              const root = elementOf(
                candidate.Root ?? candidate.m_Root ?? candidate.m_root
              )
              return !!direct && (root === direct || root?.contains?.(direct))
            })
          if (direct && usable(direct, tree)) {
            const root = elementOf(tree?.Root ?? tree?.m_Root ?? tree?.m_root)
            const leaf = elementOf(
              tree?.m_lastFocusNode ?? tree?.m_LastFocusNode
            )
            if (
              direct === root &&
              leaf &&
              leaf !== root &&
              root?.contains?.(leaf) &&
              usable(leaf, tree)
            )
              return { element: leaf, tree }
            return { element: direct, tree }
          }
        }
        for (const tree of trees) {
          const focused = elementOf(
            tree?.m_lastFocusNode ?? tree?.m_LastFocusNode
          )
          if (focused && usable(focused, tree))
            return { element: focused, tree }
        }
      }
    }
  }
  return undefined
}
export function navigationFocus(
  hosts: Window[],
  ignored?: string[],
  homeDocument?: Document
): Element | undefined {
  return navigationFocusCandidate(hosts, ignored, homeDocument)?.element
}

function focusedSteamWindow(hosts: Window[]): Window | undefined {
  for (const host of hosts) {
    try {
      const focused = (
        host as SteamFocusWindow
      ).SteamUIStore?.GetFocusedWindowInstance?.()?.BrowserWindow
      if (focused?.document && !focused.document.hidden) return focused
    } catch {
      // A closing window cannot own usable focus.
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
  const ignoredNavigationNodes: string[] = []
  const navigation = navigationFocusCandidate(
    hosts,
    ignoredNavigationNodes,
    doc
  )
  const navFocus = navigation?.element
  if (ignoredNavigationNodes.length)
    result.ignoredNavigationNodes = ignoredNavigationNodes
  if (navFocus?.ownerDocument)
    result.focusDocumentRoute = steamRoute(navFocus.ownerDocument.defaultView)
  if (navigation?.tree?.m_ID) result.focusTreeId = navigation.tree.m_ID
  if (navFocus)
    result.focusNode = `${navFocus.tagName ?? ''}.${String(navFocus.className ?? '').slice(0, 160)}`
  const focusedWindow = focusedSteamWindow(hosts)
  if (
    focusedWindow &&
    focusedWindow.document !== doc &&
    !isHomeRenderer(
      focusedWindow.document,
      focusedWindow.document === navFocus?.ownerDocument
        ? navigation?.tree
        : undefined
    )
  )
    return {
      ...result,
      reason: 'Another Steam window owns input focus',
      focusSource: 'Steam focused window',
      focusDocumentRoute: steamRoute(focusedWindow)
    }
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
    if (!focused) continue
    const focusedDocument = focused.ownerDocument ?? doc
    if (
      focusedDocument !== doc &&
      (!navFocus || !isHomeRenderer(focusedDocument, navigation?.tree))
    ) {
      result.reason = 'Navigation focus belongs to a different Steam document'
      continue
    }
    if (!focused.getClientRects().length) {
      result.reason = 'Focused node has no visible layout'
      continue
    }
    const style = (focusedDocument.defaultView ?? win).getComputedStyle(focused)
    if (style.visibility === 'hidden' || style.display === 'none') {
      result.reason = 'Focused node is hidden'
      continue
    }
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
