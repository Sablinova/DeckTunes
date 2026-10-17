import { useEffect } from 'react'
import { useWindowRef } from '@decky/ui'
import { useSettings } from '../hooks/useSettings'
import { installHomeScreenMusicPreview } from '../lib/homeScreenMusicPreview'
import { AudioLoaderCompatState } from '../state/AudioLoaderCompatState'

export default function HomeScreenMusicPreview({
  state
}: {
  state: AudioLoaderCompatState
}) {
  const { settings, isLoading } = useSettings()
  const [ref, hostWindow] = useWindowRef<HTMLSpanElement>()
  useEffect(() => {
    if (isLoading || !settings.homeScreenMusicPreview) return
    return installHomeScreenMusicPreview(
      state,
      settings,
      hostWindow ?? undefined
    )
  }, [state, settings, isLoading, hostWindow])
  return <span ref={ref} style={{ display: 'none' }} />
}
