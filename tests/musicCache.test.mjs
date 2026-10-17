import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs, moduleUrl, flush } from './loadTs.mjs'

const { updateCache } = await loadTs('../src/cache/musicCache.ts', {
  '@decky/api': moduleUrl('export const call = () => {}'),
  localforage: moduleUrl(`export default {
    config() {},
    getItem: (id) => globalThis.musicCacheTest.get(id),
    setItem: (id, value) => globalThis.musicCacheTest.set(id, value)
  }`)
})

function fixture(t) {
  const cache = new Map()
  const data = {
    get: async (id) => cache.get(id) ?? null,
    set: async (id, value) => {
      cache.set(id, value)
      return value
    }
  }
  globalThis.musicCacheTest = data
  t.after(() => delete globalThis.musicCacheTest)
  return { cache, data }
}

test('automatic discovery cannot overwrite a manual selection already queued for the game', async (t) => {
  const { cache } = fixture(t)
  const manual = updateCache(570, { videoId: '' })
  const automatic = updateCache(
    570,
    { videoId: 'automatic' },
    (current) => current?.videoId === undefined
  )
  await Promise.all([manual, automatic])
  assert.equal(cache.get('570').videoId, '')
})

test('a manual selection made during an automatic write wins and concurrent volume changes survive', async (t) => {
  const { cache, data } = fixture(t)
  let finish
  data.get = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  const automatic = updateCache(
    570,
    { videoId: 'automatic' },
    (current) => current?.videoId === undefined
  )
  await flush()
  data.get = async (id) => cache.get(id) ?? null
  const manual = updateCache(570, { videoId: '' })
  const volume = updateCache(570, { volume: 0 })
  finish(null)
  await Promise.all([automatic, manual, volume])
  assert.deepEqual(cache.get('570'), { videoId: '', volume: 0 })
})

test('focus cancellation is checked after the asynchronous cache read and before writing', async (t) => {
  const { cache, data } = fixture(t)
  let current = true,
    finish
  data.get = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  const automatic = updateCache(570, { videoId: 'obsolete' }, () => current)
  await flush()
  current = false
  finish(null)
  assert.equal(await automatic, null)
  assert.equal(cache.size, 0)
})
