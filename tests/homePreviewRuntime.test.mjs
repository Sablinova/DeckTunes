import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs, tsModuleUrl, moduleUrl, fakeClock, flush } from './loadTs.mjs'

const { installHomeScreenMusicPreview } = await loadTs(
  '../src/lib/homeScreenMusicPreview.ts',
  {
    '@decky/ui': moduleUrl(`
    export const Router = { get RunningApps() { return globalThis.homeRuntimeTest.runningApps ?? [] } };
    export const findSP = () => globalThis.homeRuntimeTest.win;
  `),
    '../cache/musicCache': moduleUrl(
      'export const getCache = (id) => globalThis.homeRuntimeTest.cache.get(id)'
    ),
    '../actions/audio': moduleUrl(`
    export const getResolver = (useYtDlp) => {
      globalThis.homeRuntimeTest.backends.push(useYtDlp);
      return { getAudioUrlFromVideo: async ({id}) => {
        globalThis.homeRuntimeTest.resolved.push(id);
        return 'http://localhost/audio/' + id;
      } };
    };
  `),
    './homeFocus': tsModuleUrl('../src/lib/homeFocus.ts'),
    './homePreviewController': tsModuleUrl(
      '../src/lib/homePreviewController.ts'
    )
  }
)

function fixture(t, entries = [[570, { videoId: 'cached-theme', volume: 0 }]]) {
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
    audios: [],
    observers: []
  }
  globalThis.homeRuntimeTest = data
  const originals = {
    Audio: globalThis.Audio,
    MutationObserver: globalThis.MutationObserver,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval
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
    volume: 0.7
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

test('runtime never invokes a resolver for uncached, volume-only or No Music entries', async (t) => {
  const f = fixture(t, [
    [570, { videoId: '' }],
    [730, { volume: 0.5 }]
  ])
  await f.clock.tick(500)
  f.focus(730)
  await f.clock.tick(500)
  f.focus(440)
  await f.clock.tick(500)
  assert.deepEqual(f.data.resolved, [])
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
