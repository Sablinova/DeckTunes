import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs, moduleUrl, flush } from './loadTs.mjs'

const { getResolver } = await loadTs('../src/actions/audio.ts', {
  '@decky/api': moduleUrl(
    'export const call = (...args) => globalThis.audioResolverTest.call(...args)'
  ),
  '../hooks/useSettings': moduleUrl('export const defaultSettings = {}')
})

function fixture(t) {
  let sequence = 0
  const terms = new Map(),
    requests = [],
    pending = new Map()
  const data = {
    failures: new Set(),
    blocked: new Set(),
    call: async (method, value) => {
      requests.push([method, value])
      if (data.failures.has(value)) throw new Error('YouTube challenge failed')
      if (method === 'search_yt') {
        terms.set(++sequence, value)
        return sequence
      }
      if (method === 'next_yt_result') return entry(terms.get(value))
      if (method === 'search_home_yt') {
        if (data.blocked.has(value))
          return new Promise((resolve) => pending.set(value, resolve))
        return entry(value)
      }
      throw new Error('Unexpected RPC: ' + method)
    }
  }
  const entry = (term) => ({
    id: term,
    url: 'stream:' + term,
    title: term,
    thumbnail: ''
  })
  globalThis.audioResolverTest = data
  t.after(() => delete globalThis.audioResolverTest)
  return { data, requests, finish: (term) => pending.get(term)(entry(term)) }
}

test('a stalled Home search cannot block manual/details music search', async (t) => {
  const f = fixture(t)
  f.data.blocked.add('Home Theme Music')
  const home = getResolver(true, true).getAudio('Home')
  await flush()
  const manual = await getResolver(true).getAudio('Details')
  assert.equal(manual.videoId, 'Details Theme Music')
  f.finish('Home Theme Music')
  assert.equal((await home).videoId, 'Home Theme Music')
  assert.deepEqual(
    f.requests.map(([method]) => method),
    ['search_home_yt', 'search_yt', 'next_yt_result']
  )
})

test('manual cursor reads use the generation returned by their own search', async (t) => {
  const f = fixture(t)
  const result = await getResolver(true).getAudio('Game')
  assert.equal(result.audioUrl, 'stream:Game Theme Music')
  assert.deepEqual(f.requests, [
    ['search_yt', 'Game Theme Music'],
    ['next_yt_result', 1]
  ])
})

test('only Home searches queue and obsolete queued Home requests skip the backend', async (t) => {
  const f = fixture(t)
  f.data.blocked.add('First Theme Music')
  const first = getResolver(true, true).getAudio('First')
  await flush()
  let current = true
  const obsolete = getResolver(true, true).getAudio('Obsolete', () => current)
  const last = getResolver(true, true).getAudio('Last')
  current = false
  f.finish('First Theme Music')
  await first
  assert.equal(await obsolete, undefined)
  assert.equal((await last).videoId, 'Last Theme Music')
  assert.deepEqual(
    f.requests.map(([, term]) => term),
    ['First Theme Music', 'Last Theme Music']
  )
})

test('manual search failures propagate instead of appearing as empty No Music results', async (t) => {
  const f = fixture(t)
  f.data.failures.add('Broken Theme Music')
  await assert.rejects(
    getResolver(true).getAudio('Broken'),
    /YouTube challenge failed/
  )
  assert.equal(
    (await getResolver(true).getAudio('Next')).videoId,
    'Next Theme Music'
  )
})

test('Home search failure cannot poison the manual cursor or future Home requests', async (t) => {
  const f = fixture(t)
  f.data.failures.add('Broken Theme Music')
  await assert.rejects(
    getResolver(true, true).getAudio('Broken'),
    /challenge failed/
  )
  assert.equal(
    (await getResolver(true).getAudio('Details')).videoId,
    'Details Theme Music'
  )
  assert.equal(
    (await getResolver(true, true).getAudio('Next')).videoId,
    'Next Theme Music'
  )
})

test('an unclosed manual result iterator no longer holds a global search lock', async (t) => {
  fixture(t)
  const manual = getResolver(true).getYouTubeSearchResults('Manual')
  try {
    assert.equal((await manual.next()).value.id, 'Manual')
    assert.equal(
      (await getResolver(true).getAudio('Next')).videoId,
      'Next Theme Music'
    )
  } finally {
    await manual.return()
  }
})

test('cancelled Home discovery never starts a search', async (t) => {
  const f = fixture(t)
  assert.equal(
    await getResolver(true, true).getAudio('Old', () => false),
    undefined
  )
  assert.deepEqual(f.requests, [])
})
