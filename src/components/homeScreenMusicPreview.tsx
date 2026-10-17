import { useEffect } from 'react'
import { useSettings } from '../hooks/useSettings'
import { installHomeScreenMusicPreview } from '../lib/homeScreenMusicPreview'
import { AudioLoaderCompatState } from '../state/AudioLoaderCompatState'

export default function HomeScreenMusicPreview({
  state
}: {
  state: AudioLoaderCompatState
}) {
  const { settings, isLoading } = useSettings()
  useEffect(() => {
    if (isLoading || !settings.homeScreenMusicPreview) return
    return installHomeScreenMusicPreview(state, settings)
  }, [state, settings, isLoading])
  return null
}
