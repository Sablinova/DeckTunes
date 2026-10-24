import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs, fakeClock, flush } from './loadTs.mjs'

const { HomePreviewController } = await loadTs(
  '../src/lib/homePreviewController.ts'
)

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function fixture(
  t,
  resolve = async (id) => ({ audioUrl: `theme:${id}`, volume: 0.4 }),
  play = () => Promise.resolve()
) {
  const clock = fakeClock(t)
  let focused = 10
  const audios = [],
    resolutions = [],
    activity = [],
    errors = []
  const controller = new HomePreviewController({
    getFocusedAppId: () => focused,
    resolve: (id) => {
      resolutions.push(id)
      return resolve(id)
    },
    createAudio: () => {
      const audio = {
        src: '',
        plays: 0,
        pauses: 0,
        loads: 0,
        play() {
          this.plays++
          return play(audios.length)
        },
        pause() {
          this.pauses++
        },
        load() {
          this.loads++
        },
        removeAttribute(name) {
          assert.equal(name, 'src')
          this.src = ''
        }
      }
      audios.push(audio)
      return audio
    },
    onPlaybackChange: (value) => activity.push(value),
    onError: (error) => errors.push(error)
  })
  t.after(() => controller.dispose())
  return {
    controller,
    clock,
    audios,
    resolutions,
    activity,
    errors,
    focus(id) {
      focused = id
      controller.update()
    },
    setLiveFocus(id) {
      focused = id
    }
  }
}

test('waits 500ms, loops once, and ignores repeat focus updates', async (t) => {
  const f = fixture(t)
  f.focus(10)
  await f.clock.tick(499)
  assert.deepEqual(f.resolutions, [])
  f.controller.update()
  await f.clock.tick(1)
  assert.deepEqual(f.resolutions, [10])
  assert.equal(f.audios[0].plays, 1)
  assert.equal(f.audios[0].loop, true)
  assert.equal(f.audios[0].volume, 0.4)
  f.controller.update()
  await f.clock.tick(1000)
  assert.equal(f.audios.length, 1)
})

test('rapid scrolling resolves only the final card after its own debounce', async (t) => {
  const f = fixture(t)
  f.focus(10)
  await f.clock.tick(400)
  f.focus(20)
  await f.clock.tick(400)
  f.focus(30)
  await f.clock.tick(499)
  assert.deepEqual(f.resolutions, [])
  await f.clock.tick(1)
  assert.deepEqual(f.resolutions, [30])
})

test('switching cards immediately unloads old audio before the next debounce', async (t) => {
  const f = fixture(t)
  f.focus(10)
  await f.clock.tick(500)
  f.focus(20)
  assert.equal(f.audios[0].pauses, 1)
  assert.equal(f.audios[0].src, '')
  assert.equal(f.audios[0].loads, 1)
  assert.deepEqual(f.activity, [true, false])
  await f.clock.tick(500)
  assert.equal(f.audios[1].src, 'theme:20')
})

test('focus loss cancels a pending debounce', async (t) => {
  const f = fixture(t)
  f.focus(10)
  await f.clock.tick(300)
  f.focus(null)
  await f.clock.tick(1000)
  assert.deepEqual(f.resolutions, [])
})

test('late resolver cannot play after navigating to details or launching a game', async (t) => {
  const result = deferred()
  const f = fixture(t, () => result.promise)
  f.focus(10)
  await f.clock.tick(500)
  f.focus(null)
  result.resolve({ audioUrl: 'old', volume: 1 })
  await flush()
  assert.equal(f.audios.length, 0)
})

test('live eligibility is rechecked even before a route/focus notification arrives', async (t) => {
  const result = deferred()
  const f = fixture(t, () => result.promise)
  f.focus(10)
  await f.clock.tick(500)
  f.setLiveFocus(null)
  result.resolve({ audioUrl: 'stale', volume: 1 })
  await flush()
  assert.equal(f.audios.length, 0)
})

test('A → B → A rejects the first A resolution', async (t) => {
  const old = deferred()
  let calls = 0
  const f = fixture(t, async () =>
    ++calls === 1 ? old.promise : { audioUrl: 'new', volume: 1 }
  )
  f.focus(10)
  await f.clock.tick(500)
  f.focus(20)
  f.focus(10)
  await f.clock.tick(500)
  old.resolve({ audioUrl: 'old', volume: 1 })
  await flush()
  assert.equal(f.audios.length, 1)
  assert.equal(f.audios[0].src, 'new')
})

test('missing/muted themes remain silent without repeated resolution', async (t) => {
  const f = fixture(t, async () => undefined)
  f.focus(10)
  await f.clock.tick(500)
  f.controller.update()
  await f.clock.tick(1000)
  assert.equal(f.audios.length, 0)
  assert.deepEqual(f.resolutions, [10])
})

test('disabling/unloading disposes audio and prevents late playback', async (t) => {
  const result = deferred()
  const f = fixture(t, async (id) =>
    id === 10 ? { audioUrl: 'ten', volume: 1 } : result.promise
  )
  f.focus(10)
  await f.clock.tick(500)
  f.focus(20)
  await f.clock.tick(500)
  f.controller.dispose()
  result.resolve({ audioUrl: 'twenty', volume: 1 })
  f.controller.update()
  await f.clock.tick(1000)
  assert.equal(f.audios.length, 1)
  assert.equal(f.audios[0].src, '')
})

test('resolver failure releases playback and permits the next card', async (t) => {
  const f = fixture(t, async (id) => {
    if (id === 10) throw new Error('offline')
    return { audioUrl: 'next', volume: 1 }
  })
  f.focus(10)
  await f.clock.tick(500)
  assert.equal(f.errors.length, 1)
  f.focus(20)
  await f.clock.tick(500)
  assert.equal(f.audios[0].src, 'next')
})

test('media errors stop playback and release AudioLoader ownership', async (t) => {
  const f = fixture(t)
  f.focus(10)
  await f.clock.tick(500)
  f.audios[0].onerror()
  assert.deepEqual(f.activity, [true, false])
  assert.equal(f.audios[0].src, '')
})

test('a cancelled play rejection cannot stop a newer track', async (t) => {
  const pending = deferred()
  const f = fixture(t, undefined, (index) =>
    index === 1 ? pending.promise : Promise.resolve()
  )
  f.focus(10)
  await f.clock.tick(500)
  f.focus(20)
  await f.clock.tick(500)
  pending.reject(new Error('interrupted'))
  await flush()
  assert.equal(f.audios[1].src, 'theme:20')
  assert.equal(f.audios[1].pauses, 0)
  assert.deepEqual(f.errors, [])
})
