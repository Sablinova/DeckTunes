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
  const searches = []
  let term, finishFirst, blockedTerm, failTerm
  const entry = (name) => ({
    id: name,
    url: 'stream:' + name,
    title: name,
    thumbnail: ''
  })
  globalThis.audioResolverTest = {
    call: async (method, value) => {
      if (method === 'search_yt') {
        searches.push(value)
        term = value
        if (term === failTerm) throw new Error('search failed')
        return
      }
      assert.equal(method, 'next_yt_result')
      if (term === blockedTerm)
        return new Promise((resolve) => {
          finishFirst = resolve
        })
      return entry(term)
    }
  }
  t.after(() => delete globalThis.audioResolverTest)
  return {
    searches,
    block(name) {
      blockedTerm = name
    },
    fail(name) {
      failTerm = name
    },
    finish(name) {
      finishFirst(entry(name))
    }
  }
}

test('automatic searches keep shared yt-dlp results associated with the correct game', async (t) => {
  const f = fixture(t)
  f.block('First Theme Music')
  const first = getResolver(true).getAudio('First')
  await flush()
  const second = getResolver(true).getAudio('Second')
  await flush()
  assert.deepEqual(f.searches, ['First Theme Music'])
  f.finish('First Theme Music')
  assert.deepEqual(await first, {
    videoId: 'First Theme Music',
    audioUrl: 'stream:First Theme Music'
  })
  assert.deepEqual(await second, {
    videoId: 'Second Theme Music',
    audioUrl: 'stream:Second Theme Music'
  })
  assert.deepEqual(f.searches, ['First Theme Music', 'Second Theme Music'])
})

test('a queued obsolete focus search is skipped before calling the backend', async (t) => {
  const f = fixture(t)
  f.block('First Theme Music')
  const first = getResolver(true).getAudio('First')
  await flush()
  let current = true
  const obsolete = getResolver(true).getAudio('Obsolete', () => current)
  const last = getResolver(true).getAudio('Last')
  current = false
  f.finish('First Theme Music')
  await first
  assert.equal(await obsolete, undefined)
  assert.equal((await last).videoId, 'Last Theme Music')
  assert.deepEqual(f.searches, ['First Theme Music', 'Last Theme Music'])
})

test('focus loss during a backend read ignores its result and releases the queue', async (t) => {
  const f = fixture(t)
  f.block('Old Theme Music')
  let current = true
  const old = getResolver(true).getAudio('Old', () => current)
  await flush()
  current = false
  const next = getResolver(true).getAudio('Next')
  f.finish('Old Theme Music')
  assert.equal(await old, undefined)
  assert.equal((await next).videoId, 'Next Theme Music')
})

test('manual theme searches release their cursor when the iterator is closed', async (t) => {
  const f = fixture(t)
  const manual = getResolver(true).getYouTubeSearchResults('Manual search')
  try {
    assert.equal((await manual.next()).value.id, 'Manual search')
    const automatic = getResolver(true).getAudio('Home')
    await flush()
    assert.deepEqual(f.searches, ['Manual search'])
    await manual.return()
    assert.equal((await automatic).videoId, 'Home Theme Music')
  } finally {
    await manual.return()
  }
})

test('a failed backend search does not block later searches', async (t) => {
  const f = fixture(t)
  f.fail('Broken Theme Music')
  const broken = getResolver(true).getAudio('Broken')
  const next = getResolver(true).getAudio('Next')
  assert.equal(await broken, undefined)
  assert.equal((await next).videoId, 'Next Theme Music')
})

test('already cancelled discovery never starts a backend search', async (t) => {
  const f = fixture(t)
  assert.equal(await getResolver(true).getAudio('Old', () => false), undefined)
  assert.deepEqual(f.searches, [])
})
