import {
  DialogButton,
  Focusable,
  SliderField,
  PanelSection,
  PanelSectionRow
} from '@decky/ui'
import { useEffect, useState } from 'react'
import { useParams } from '../../hooks/useParams'
import { getCache, updateCache } from '../../cache/musicCache'

import useThemeMusic from '../../hooks/useThemeMusic'
import useTranslations from '../../hooks/useTranslations'
import { useSettings } from '../../hooks/useSettings'
import { FaVolumeUp } from 'react-icons/fa'
import Spinner from '../spinner'
import useAudioPlayer from '../../hooks/useAudioPlayer'

export default function GameSettings() {
  const t = useTranslations()
  const { settings, isLoading: settingsIsLoading } = useSettings()
  const { appid } = useParams<{ appid: string }>()

  const { audio, isLoading: themeLoading } = useThemeMusic(parseInt(appid))
  const [themeVolume, setThemeVolume] = useState(settings.volume)
  const [loading, setLoading] = useState(true)

  const audioPlayer = useAudioPlayer(audio.audioUrl)

  useEffect(() => {
    async function getData() {
      setLoading(true)
      try {
        const cache = await getCache(parseInt(appid))
        if (typeof cache?.volume === 'number' && isFinite(cache.volume)) {
          setThemeVolume(cache.volume)
        } else {
          setThemeVolume(settings.volume)
        }
      } catch (e) {
        console.error('Error loading game audio:', e)
      }
      setLoading(false)
    }
    if (!settingsIsLoading) {
      getData()
    }
  }, [appid, settingsIsLoading])

  function updateThemeVolume(newVol: number, reset?: boolean) {
    setThemeVolume(newVol)
    audioPlayer.setVolume(newVol)
    updateCache(parseInt(appid), { volume: reset ? undefined : newVol })
  }

  useEffect(() => {
    if (audioPlayer.isReady) audioPlayer.setVolume(themeVolume)
  }, [audioPlayer.isReady, themeVolume])

  return (
    <div
      style={{
        padding: '16px 24px 32px',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        maxWidth: '728px',
        margin: '0 auto'
      }}
    >
      <PanelSection title={t('gameSettings')}>
        <PanelSectionRow>
          <SliderField
            layout="below"
            bottomSeparator="none"
            label={t('volume')}
            description={t('gameVolumeDescription')}
            value={themeVolume * 100}
            onChange={(value) => updateThemeVolume(value / 100)}
            disabled={loading}
            min={0}
            max={100}
            step={1}
            icon={<FaVolumeUp />}
            editableValue
          />
        </PanelSectionRow>
      </PanelSection>
      <Focusable
        flow-children="row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '12px',
          marginTop: '16px'
        }}
      >
        <DialogButton
          onClick={audioPlayer.togglePlay}
          disabled={
            loading || themeLoading || !audio.audioUrl || !audioPlayer.isReady
          }
          style={{
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          {loading || themeLoading ? (
            <Spinner />
          ) : audioPlayer.isPlaying ? (
            t('stop')
          ) : (
            t('previewMusic')
          )}
        </DialogButton>
        <DialogButton
          onClick={() => updateThemeVolume(settings.volume, true)}
          disabled={loading}
          style={{
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          {t('resetVolume')}
        </DialogButton>
      </Focusable>
    </div>
  )
}
