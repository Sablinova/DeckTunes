import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs, moduleUrl, flush } from './loadTs.mjs'

test('old settings opt out by default; mounted consumers share live updates and ordered saves', async (t) => {
  const writes = []
  const old = { defaultMuted: true, volume: 0.3, useYtDlp: true }
  globalThis.settingsTestCall = async (method, _key, value) => {
    if (method === 'get_setting') return old
    writes.push(value)
  }
  t.after(() => delete globalThis.settingsTestCall)
  const { useSettings } = await loadTs('../src/hooks/useSettings.ts', {
    '@decky/api': moduleUrl(
      'export const call = (...args) => globalThis.settingsTestCall(...args)'
    ),
    react: moduleUrl(`
      export const useEffect = (effect) => effect();
      export const useSyncExternalStore = (_subscribe, getSnapshot) => getSnapshot();
    `)
  })
  assert.equal(useSettings().isLoading, true)
  await flush()
  const panel = useSettings()
  assert.equal(panel.settings.homeScreenMusicPreview, false)
  assert.equal(panel.settings.defaultMuted, true)
  assert.equal(panel.settings.volume, 0.3)
  panel.setHomeScreenMusicPreview(true)
  assert.equal(useSettings().settings.homeScreenMusicPreview, true)
  panel.setVolume(0.6)
  panel.setUseYtDlp(false)
  await flush()
  assert.equal(writes.at(-1).homeScreenMusicPreview, true)
  assert.equal(writes.at(-1).volume, 0.6)
  assert.equal(writes.at(-1).downloadAudio, false)
  assert.equal(writes.at(-1).useYtDlp, false)
})
