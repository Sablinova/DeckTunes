import { getResolver } from '../actions/audio'
import { getCache, updateCache } from '../cache/musicCache'
import type { Settings } from '../hooks/useSettings'

// Home, game details and game settings all resolve the same AppID selection.
// Background discovery uses a separate process from the manual search results.
export async function resolveGameTheme(
  appId: number,
  appName: string | undefined,
  settings: Pick<Settings, 'useYtDlp' | 'defaultMuted' | 'volume'>,
  isCurrent: () => boolean = () => true,
  report: (reason: string) => void = () => {}
): Promise<{ videoId: string; audioUrl: string; volume: number } | undefined> {
  const resolver = getResolver(settings.useYtDlp, true)
  while (isCurrent()) {
    const cache = await getCache(appId)
    if (!isCurrent()) return undefined
    if (cache?.videoId === '') {
      report(`App ${appId}: No Music is selected`)
      return undefined
    }
    let videoId = cache?.videoId
    let audioUrl: string | undefined
    if (videoId) {
      report(`App ${appId}: resolving saved theme`)
      audioUrl = await resolver.getAudioUrlFromVideo({ id: videoId })
    } else {
      if (settings.defaultMuted) {
        report(`App ${appId}: Default Muted prevents theme search`)
        return undefined
      }
      const name = appName?.replace(/(™|®|©)/g, '').trim()
      if (!name) {
        report(`App ${appId}: game name is unavailable`)
        return undefined
      }
      report(`Searching: ${name}`)
      const found = await resolver.getAudio(name, isCurrent)
      if (!isCurrent()) return undefined
      if (!found?.videoId || !found.audioUrl) {
        report(`App ${appId}: search returned no playable theme`)
        return undefined
      }
      const saved = await updateCache(
        appId,
        { videoId: found.videoId },
        (current) => isCurrent() && current?.videoId === undefined
      )
      if (!isCurrent()) return undefined
      // Resolve the winning shared choice if another view or the user selected
      // a theme while discovery was in flight. Never play the losing result.
      if (saved?.videoId !== found.videoId) continue
      videoId = found.videoId
      audioUrl = found.audioUrl
    }
    if (!isCurrent()) return undefined
    const latest = await getCache(appId)
    if (!isCurrent()) return undefined
    if (latest?.videoId !== videoId) continue
    if (!audioUrl) {
      report(`App ${appId}: saved theme has no playable audio URL`)
      return undefined
    }
    return {
      videoId,
      audioUrl,
      volume:
        typeof latest?.volume === 'number' && Number.isFinite(latest.volume)
          ? latest.volume
          : settings.volume
    }
  }
  return undefined
}
