import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs, tsModuleUrl, moduleUrl, fakeClock, flush } from './loadTs.mjs'

const runtimeImports = {
  '@decky/ui': moduleUrl(`
    export const Router = {
      get RunningApps() { return globalThis.homeRuntimeTest.runningApps ?? [] },
      get WindowStore() { return { GamepadUIMainWindowInstance: { BrowserWindow: globalThis.homeRuntimeTest.routerMain } } }
    };
    export const findSP = () => globalThis.homeRuntimeTest.win;
  `),
  '../cache/musicCache': moduleUrl(
    `export const getThemeRevision = (id) => String(globalThis.homeRuntimeTest.cache.get(id)?.videoId);
       export const getCache = (id) => globalThis.homeRuntimeTest.cache.get(id);
       export const updateCache = async (id, value, shouldUpdate) => {
         const data = globalThis.homeRuntimeTest;
         if (!shouldUpdate(data.cache.get(id))) return data.cache.get(id);
         data.writes.push({id, ...value});
         data.cache.set(id, {...data.cache.get(id), ...value});
         return data.cache.get(id);
       };`
  ),
  '../actions/audio': moduleUrl(`
    export const getResolver = (useYtDlp) => {
      globalThis.homeRuntimeTest.backends.push(useYtDlp);
      return { getAudioUrlFromVideo: async ({id}) => {
        globalThis.homeRuntimeTest.resolved.push(id);
        return 'http://localhost/audio/' + id;
      }, getAudio: async (name, isCurrent) => {
        const data = globalThis.homeRuntimeTest;
        data.searched.push(name);
        if (data.search) return data.search(name, isCurrent);
        return {videoId: 'found-' + name, audioUrl: 'stream:' + name};
      } };
    };
  `),
  './homeFocus': tsModuleUrl('../src/lib/homeFocus.ts'),
  './steamHomeWindow': tsModuleUrl('../src/lib/steamHomeWindow.ts', {
    './homeFocus': tsModuleUrl('../src/lib/homeFocus.ts')
  }),
  './homePreviewDiagnostics': moduleUrl(
    'export const updateHomePreviewDiagnostics = (patch) => Object.assign(globalThis.homeRuntimeTest.diagnostics, patch)'
  ),
  './homePreviewController': tsModuleUrl('../src/lib/homePreviewController.ts')
}
const themeModule = tsModuleUrl('../src/lib/gameTheme.ts', {
  '../cache/musicCache': runtimeImports['../cache/musicCache'],
  '../actions/audio': runtimeImports['../actions/audio']
})
const { resolveGameTheme } = await import(themeModule)
const { installHomeScreenMusicPreview } = await loadTs(
  '../src/lib/homeScreenMusicPreview.ts',
  { ...runtimeImports, './gameTheme': themeModule }
)

function fixture(
  t,
  entries = [[570, { videoId: 'cached-theme', volume: 0 }]],
  settings = {}
) {
  const clock = fakeClock(t)
  const win = new EventTarget()
  win.location = { pathname: '/library/home' }
  win.getComputedStyle = () => ({})
  let focusedId = '570'
  const card = {
    closest: () => card,
    getAttribute: () => focusedId,
    getClientRects: () => [{}]
  }
  const doc = new EventTarget()
  doc.defaultView = win
  doc.querySelectorAll = () => [card]
  win.document = doc
  const data = {
    win,
    cache: new Map(entries),
    backends: [],
    resolved: [],
    searched: [],
    writes: [],
    names: new Map([
      [570, 'Dota™ 2'],
      [730, 'Counter-Strike®'],
      [440, 'Team Fortress 2']
    ]),
    audios: [],
    observers: [],
    diagnostics: {}
  }
  globalThis.homeRuntimeTest = data
  const originals = {
    window: globalThis.window,
    appStore: globalThis.appStore,
    Audio: globalThis.Audio,
    MutationObserver: globalThis.MutationObserver,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval
  }
  globalThis.window = win
  globalThis.appStore = {
    GetAppOverviewByGameID: (id) => ({ display_name: data.names.get(id) })
  }
  let reconcile,
    cleared = false
  globalThis.setInterval = (callback) => {
    reconcile = callback
    return 1
  }
  globalThis.clearInterval = () => {
    cleared = true
  }
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback
      data.observers.push(this)
    }
    observe() {}
    disconnect() {
      this.disconnected = true
    }
  }
  globalThis.Audio = class {
    constructor() {
      data.audios.push(this)
    }
    play() {
      this.played = true
      return Promise.resolve()
    }
    pause() {
      this.paused = true
    }
    removeAttribute() {
      this.src = ''
    }
    load() {}
  }
  const publicState = { onAppPage: false, gamesRunning: [] }
  const activity = []
  const state = {
    eventBus: new EventTarget(),
    getPublicState: () => publicState,
    setHomePreviewActive: (active) => {
      activity.push(active)
      state.eventBus.dispatchEvent(new Event('stateUpdate'))
    }
  }
  const cleanup = installHomeScreenMusicPreview(state, {
    useYtDlp: true,
    volume: 0.7,
    defaultMuted: false,
    ...settings
  })
  t.after(() => {
    cleanup()
    Object.assign(globalThis, originals)
    delete globalThis.homeRuntimeTest
  })
  return {
    clock,
    data,
    activity,
    publicState,
    doc,
    card,
    win,
    cleanup,
    reconcile: () => reconcile(),
    cleared: () => cleared,
    focus(id) {
      focusedId = String(id)
      doc.dispatchEvent(new Event('focusin'))
    },
    setFocusedId(id) {
      focusedId = String(id)
    },
    updateState() {
      state.eventBus.dispatchEvent(new Event('stateUpdate'))
    }
  }
}

test('runtime uses the existing cache, selected resolver and zero-volume override', async (t) => {
  const f = fixture(t)
  await f.clock.tick(500)
  assert.deepEqual(f.data.resolved, ['cached-theme'])
  assert.deepEqual(f.data.backends, [true])
  assert.equal(f.data.audios[0].volume, 0)
  assert.equal(f.data.audios[0].src, 'http://localhost/audio/cached-theme')
  assert.deepEqual(f.activity, [true])
})

test('native cards on modern Steam routes play via nav-tree focus and React AppID data', async (t) => {
  const f = fixture(t)
  f.win.location.pathname = '/routes/library/home'
  f.card.closest = () => null
  f.card.__reactFiber$native = { memoizedProps: { overview: { appid: 570 } } }
  f.doc.querySelectorAll = () => []
  f.win.FocusNavController = {
    m_ActiveContext: { m_lastFocusNode: { m_element: f.card } }
  }
  f.reconcile()
  await f.clock.tick(500)
  assert.equal(f.data.audios[0].src, 'http://localhost/audio/cached-theme')
  assert.equal(f.data.diagnostics.focus.appIdSource, 'React overview')
  assert.equal(f.data.diagnostics.focus.focusSource, 'Steam navigation tree')
  assert.equal(f.data.diagnostics.lastResult, 'Playing App 570')
})

test('empty search results leave a visible diagnostic reason instead of unexplained silence', async (t) => {
  const f = fixture(t, [])
  f.data.search = async () => undefined
  await f.clock.tick(500)
  assert.match(
    f.data.diagnostics.lastResult,
    /search returned no playable theme/
  )
  assert.equal(f.data.audios.length, 0)
})

test('a different live Home renderer owning navigation focus can play despite the stale router document', async (t) => {
  const f = fixture(t)
  const liveWindow = new EventTarget()
  liveWindow.location = { pathname: '/library/home' }
  liveWindow.getComputedStyle = () => ({})
  const liveDocument = new EventTarget()
  liveDocument.defaultView = liveWindow
  liveDocument.querySelectorAll = () => []
  liveWindow.document = liveDocument
  const focused = {
    ...f.card,
    ownerDocument: liveDocument,
    closest: () => null,
    __reactFiber$native: { memoizedProps: { overview: { appid: 570 } } }
  }
  f.data.routerMain = f.win
  f.win.FocusNavController = {
    m_ActiveContext: { m_lastFocusNode: { m_element: focused } }
  }
  f.reconcile()
  await f.clock.tick(500)
  assert.equal(f.data.audios[0].src, 'http://localhost/audio/cached-theme')
  assert.equal(f.data.diagnostics.lastResult, 'Playing App 570')
  assert.equal(f.data.observers[0].disconnected, true)
})

test('No Music remains silent and is never searched or overwritten', async (t) => {
  const f = fixture(t, [[570, { videoId: '' }]])
  await f.clock.tick(500)
  assert.deepEqual(f.data.resolved, [])
  assert.deepEqual(f.data.searched, [])
  assert.deepEqual(f.data.writes, [])
  assert.equal(f.data.audios.length, 0)
})

test('uncached Home games are searched after debounce, played and cached for reuse', async (t) => {
  const f = fixture(t, [])
  await f.clock.tick(499)
  assert.deepEqual(f.data.searched, [])
  await f.clock.tick(1)
  assert.deepEqual(f.data.searched, ['Dota 2'])
  assert.deepEqual(f.data.backends, [true])
  assert.equal(f.data.cache.get(570).videoId, 'found-Dota 2')
  assert.equal(f.data.audios[0].src, 'stream:Dota 2')
  f.setFocusedId(0)
  f.reconcile()
  f.focus(570)
  await f.clock.tick(500)
  assert.deepEqual(f.data.searched, ['Dota 2'])
  assert.deepEqual(f.data.resolved, ['found-Dota 2'])
})

test('automatic discovery preserves volume-only overrides, including zero', async (t) => {
  const f = fixture(t, [[570, { volume: 0 }]])
  await f.clock.tick(500)
  assert.equal(f.data.cache.get(570).volume, 0)
  assert.equal(f.data.audios[0].volume, 0)
})

test('Default Muted prevents discovery for missing themes and volume-only entries', async (t) => {
  const f = fixture(t, [[570, { volume: 0.5 }]], { defaultMuted: true })
  await f.clock.tick(500)
  f.focus(730)
  await f.clock.tick(500)
  assert.deepEqual(f.data.searched, [])
  assert.deepEqual(f.data.writes, [])
  assert.equal(f.data.audios.length, 0)
})

test('Default Muted still permits saved themes', async (t) => {
  const f = fixture(t, [[570, { videoId: 'saved' }]], { defaultMuted: true })
  await f.clock.tick(500)
  assert.equal(f.data.audios[0].src, 'http://localhost/audio/saved')
  assert.deepEqual(f.data.searched, [])
})

test('discovery uses the selected resolver without overriding the source setting', async (t) => {
  const f = fixture(t, [], { useYtDlp: false })
  await f.clock.tick(500)
  assert.deepEqual(f.data.backends, [false])
  assert.equal(f.data.audios[0].src, 'stream:Dota 2')
})

test('missing game names and empty search results are not cached', async (t) => {
  const f = fixture(t, [])
  f.data.names.delete(570)
  await f.clock.tick(500)
  assert.deepEqual(f.data.searched, [])
  f.data.search = async () => undefined
  f.focus(730)
  await f.clock.tick(500)
  assert.deepEqual(f.data.writes, [])
  assert.equal(f.data.audios.length, 0)
})

test('an obsolete automatic search cannot cache or play its result after focus changes', async (t) => {
  const f = fixture(t, [])
  let finish, stillCurrent
  f.data.search = (_name, isCurrent) => {
    stillCurrent = isCurrent
    return new Promise((resolve) => {
      finish = resolve
    })
  }
  await f.clock.tick(500)
  assert.equal(stillCurrent(), true)
  f.focus(730)
  assert.equal(stillCurrent(), false)
  finish({ videoId: 'obsolete', audioUrl: 'old' })
  await flush()
  assert.deepEqual(f.data.writes, [])
  assert.equal(f.data.audios.length, 0)
})

test('manual theme or No Music selections made during discovery take precedence', async (t) => {
  const f = fixture(t, [])
  let finish
  f.data.search = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  await f.clock.tick(500)
  f.data.cache.set(570, { videoId: '' })
  finish({ videoId: 'automatic', audioUrl: 'old' })
  await flush()
  assert.deepEqual(f.data.writes, [])
  assert.equal(f.data.cache.get(570).videoId, '')
  assert.equal(f.data.audios.length, 0)
})

test('plugin cleanup prevents a pending discovery from caching or playing', async (t) => {
  const f = fixture(t, [])
  let finish
  f.data.search = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  await f.clock.tick(500)
  f.cleanup()
  finish({ videoId: 'obsolete', audioUrl: 'old' })
  await flush()
  assert.deepEqual(f.data.writes, [])
  assert.equal(f.data.audios.length, 0)
})

test('runtime falls back to global volume and stops before page playback claims audio', async (t) => {
  const f = fixture(t, [[570, { videoId: 'theme' }]])
  await f.clock.tick(500)
  assert.equal(f.data.audios[0].volume, 0.7)
  f.publicState.onAppPage = true
  f.updateState()
  assert.equal(f.data.audios[0].paused, true)
  assert.equal(f.data.audios[0].src, '')
  await f.clock.tick(1000)
  assert.equal(f.data.audios.length, 1)
})

test('game lifetime events stop active audio and cancel pending playback', async (t) => {
  const f = fixture(t)
  await f.clock.tick(500)
  f.publicState.gamesRunning = [570]
  f.updateState()
  assert.equal(f.data.audios[0].paused, true)
  f.publicState.gamesRunning = []
  f.updateState()
  await f.clock.tick(200)
  f.publicState.gamesRunning = [730]
  f.updateState()
  await f.clock.tick(1000)
  assert.equal(f.data.audios.length, 1)
})

test('route fallback stops audio when pushState emits no focus or mutation event', async (t) => {
  const f = fixture(t)
  await f.clock.tick(500)
  f.win.location.pathname = '/library/app/570'
  f.reconcile()
  assert.equal(f.data.audios[0].paused, true)
})

test('DOM class mutations detect gamepad-only focus changes', async (t) => {
  const f = fixture(t, [
    [570, { videoId: 'theme' }],
    [730, { videoId: 'next' }]
  ])
  await f.clock.tick(500)
  f.setFocusedId(730)
  f.data.observers[0].callback()
  await f.clock.tick(500)
  assert.equal(f.data.audios[1].src, 'http://localhost/audio/next')
})

test('a game already running when the plugin is loaded blocks previews', async (t) => {
  const f = fixture(t)
  f.data.runningApps = [{ appid: '570' }]
  f.reconcile()
  await f.clock.tick(1000)
  assert.deepEqual(f.data.resolved, [])
  assert.equal(f.data.audios.length, 0)
})

test('cleanup disconnects observers, clears the interval and ignores subsequent events', async (t) => {
  const f = fixture(t)
  await f.clock.tick(500)
  f.cleanup()
  assert.equal(f.data.observers[0].disconnected, true)
  assert.equal(f.cleared(), true)
  assert.equal(f.data.audios[0].paused, true)
  f.focus(730)
  f.updateState()
  await f.clock.tick(1000)
  await flush()
  assert.equal(f.data.audios.length, 1)
})

test('Home discovery saves the exact video reused by details without another search', async (t) => {
  const f = fixture(t, [])
  await f.clock.tick(500)
  const selected = f.data.cache.get(570).videoId
  const detail = await resolveGameTheme(570, 'Dota 2', {
    useYtDlp: true,
    defaultMuted: false,
    volume: 0.7
  })
  assert.equal(detail.videoId, selected)
  assert.equal(detail.audioUrl, 'http://localhost/audio/' + selected)
  assert.deepEqual(f.data.searched, ['Dota 2'])
  f.reconcile()
  await f.clock.tick(1000)
  assert.equal(
    f.data.audios.length,
    1,
    'saving a discovered theme must not restart its preview'
  )
})

test('a manually applied song is used by details and an already-focused Home card', async (t) => {
  const f = fixture(t)
  await f.clock.tick(500)
  f.data.cache.set(570, { videoId: 'manual-choice' })
  const detail = await resolveGameTheme(570, 'Dota 2', {
    useYtDlp: true,
    defaultMuted: false,
    volume: 0.7
  })
  f.reconcile()
  assert.equal(f.data.audios[0].paused, true)
  await f.clock.tick(500)
  assert.equal(f.data.audios[1].src, detail.audioUrl)
  assert.equal(detail.videoId, 'manual-choice')
  assert.deepEqual(f.data.searched, [])
})

test('No Music applied to a playing game silences both views without searching', async (t) => {
  const f = fixture(t)
  await f.clock.tick(500)
  f.data.cache.set(570, { videoId: '' })
  f.reconcile()
  assert.equal(f.data.audios[0].paused, true)
  await f.clock.tick(500)
  assert.equal(
    await resolveGameTheme(570, 'Dota 2', {
      useYtDlp: true,
      defaultMuted: false,
      volume: 0.7
    }),
    undefined
  )
  assert.equal(f.data.audios.length, 1)
  assert.deepEqual(f.data.searched, [])
})

test('details discovery cannot overwrite or play a manual choice made while searching', async (t) => {
  const f = fixture(t, [])
  let finish
  f.data.search = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  const pending = resolveGameTheme(570, 'Dota 2', {
    useYtDlp: true,
    defaultMuted: false,
    volume: 0.7
  })
  await flush()
  f.data.cache.set(570, { videoId: 'manual-choice', volume: 0.3 })
  finish({ videoId: 'late-automatic', audioUrl: 'wrong-song' })
  const detail = await pending
  assert.equal(detail.videoId, 'manual-choice')
  assert.equal(detail.audioUrl, 'http://localhost/audio/manual-choice')
  assert.equal(detail.volume, 0.3)
  assert.deepEqual(f.data.writes, [])
})

test('Home preview reaches playback when stale login focus precedes an index.html Home tree', async (t) => {
  const f = fixture(t)
  f.doc.querySelectorAll = () => []
  const shell = new EventTarget()
  shell.location = { pathname: '/index.html' }
  shell.getComputedStyle = () => ({})
  shell.document = { defaultView: shell }
  const login = {
    defaultView: {
      location: { pathname: '/login' },
      getComputedStyle: () => ({})
    }
  }
  const focused = { ...f.card, ownerDocument: shell.document }
  f.win.FocusNavController = {
    m_ActiveContext: {
      m_lastFocusNode: {
        m_element: { ownerDocument: login, getClientRects: () => [{}] }
      },
      m_LastActiveNavTree: {
        m_ID: 'GamepadUI_Full_Root',
        m_lastFocusNode: { m_element: focused }
      }
    }
  }
  f.reconcile()
  await f.clock.tick(500)
  assert.equal(f.data.audios[0].src, 'http://localhost/audio/cached-theme')
  assert.equal(f.data.diagnostics.lastAppId, 570)
  assert.equal(f.data.diagnostics.focus.focusDocumentRoute, '/index.html')
  assert.equal(f.data.diagnostics.focus.focusTreeId, 'GamepadUI_Full_Root')
  f.setFocusedId(730)
  f.reconcile()
  assert.equal(f.data.audios[0].paused, true)
  await f.clock.tick(500)
  assert.equal(f.data.audios[1].src, 'stream:Counter-Strike')
  f.win.location.pathname = '/library/app/730'
  f.reconcile()
  assert.equal(f.data.audios[1].paused, true)
})

test('opening an index.html QAM window stops Home and closing it starts a fresh debounce', async (t) => {
  const f = fixture(t)
  await f.clock.tick(500)
  const qam = { location: { pathname: '/index.html' }, document: {} }
  let focused = qam
  f.win.SteamUIStore = {
    GetFocusedWindowInstance: () => ({ BrowserWindow: focused })
  }
  f.reconcile()
  assert.equal(f.data.audios[0].paused, true)
  assert.equal(
    f.data.diagnostics.focus.reason,
    'Another Steam window owns input focus'
  )
  focused = f.win
  f.reconcile()
  await f.clock.tick(499)
  assert.equal(f.data.audios.length, 1)
  await f.clock.tick(1)
  assert.equal(f.data.audios.length, 2)
})
