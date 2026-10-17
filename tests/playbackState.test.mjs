import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs, moduleUrl, fakeClock } from './loadTs.mjs'

const { AudioLoaderCompatState } = await loadTs(
  '../src/state/AudioLoaderCompatState.tsx',
  {
    react: moduleUrl(`
    export const createContext = () => ({});
    export const useContext = () => {};
    export const useEffect = () => {};
    export const useState = () => {};
  `)
  }
)

function stateFixture(t) {
  const calls = []
  globalThis.window = {
    AUDIOLOADER_MENUMUSIC: {
      play: () => calls.push('play'),
      pause: () => calls.push('pause')
    }
  }
  t.after(() => delete globalThis.window)
  return { state: new AudioLoaderCompatState(), calls }
}

test('details and game launch publish playback inhibition synchronously', (t) => {
  fakeClock(t)
  const { state } = stateFixture(t)
  const events = []
  state.eventBus.addEventListener('stateUpdate', () =>
    events.push(state.getPublicState())
  )
  state.setOnThemePage(true)
  assert.equal(events[0].onAppPage, true)
  state.setGamesRunning([570])
  assert.deepEqual(events.at(-1).gamesRunning, [570])
})

test('same-tick navigation cannot let an older delayed page exit release a new player', async (t) => {
  const clock = fakeClock(t)
  const { state } = stateFixture(t)
  state.setOnThemePage(true)
  state.setOnThemePage(false)
  state.setOnThemePage(true)
  await clock.tick(1000)
  assert.equal(state.getPublicState().onAppPage, true)
})

test('leaving details immediately releases Home inhibition while AudioLoader keeps its transition delay', async (t) => {
  const clock = fakeClock(t)
  const { state, calls } = stateFixture(t)
  state.setOnThemePage(true)
  state.setOnThemePage(false)
  assert.equal(state.getPublicState().onAppPage, false)
  assert.equal(calls.at(-1), 'pause')
  await clock.tick(1000)
  assert.equal(calls.at(-1), 'play')
})

test('AudioLoader pauses during previews and resumes only if no page or game owns audio', (t) => {
  fakeClock(t)
  const { state, calls } = stateFixture(t)
  state.setHomePreviewActive(true)
  assert.equal(calls.at(-1), 'pause')
  state.setHomePreviewActive(false)
  assert.equal(calls.at(-1), 'play')
  state.setGamesRunning([570])
  state.setHomePreviewActive(true)
  state.setHomePreviewActive(false)
  assert.equal(calls.at(-1), 'pause')
})
