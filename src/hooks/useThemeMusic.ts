import { useEffect, useState, useSyncExternalStore } from 'react'
import { getThemeRevision, subscribeThemeChanges } from '../cache/musicCache'
import { resolveGameTheme } from '../lib/gameTheme'
import { useSettings } from './useSettings'

const useThemeMusic = (appId: number) => {
  const { settings, isLoading: settingsLoading } = useSettings()
  const [audio, setAudio] = useState({ videoId: '', audioUrl: '' })
  const [isLoading, setIsLoading] = useState(true)
  const appName = appStore.GetAppOverviewByGameID(appId)?.display_name
  const revision = useSyncExternalStore(
    (listener) =>
      subscribeThemeChanges((changed) => {
        if (changed === undefined || changed === appId) listener()
      }),
    () => getThemeRevision(appId)
  )

  useEffect(() => {
    let ignore = false
    setAudio({ videoId: '', audioUrl: '' })
    setIsLoading(true)
    if (!settingsLoading) {
      resolveGameTheme(appId, appName, settings, () => !ignore)
        .then((theme) => {
          if (!ignore) setAudio(theme ?? { videoId: '', audioUrl: '' })
        })
        .catch((error) => {
          if (!ignore)
            console.error('[DeckTunes] Theme resolution failed:', error)
        })
        .finally(() => {
          if (!ignore) setIsLoading(false)
        })
    }
    return () => {
      ignore = true
    }
  }, [
    appId,
    appName,
    settingsLoading,
    settings.useYtDlp,
    settings.defaultMuted,
    revision
  ])

  return { audio, isLoading }
}

export default useThemeMusic
