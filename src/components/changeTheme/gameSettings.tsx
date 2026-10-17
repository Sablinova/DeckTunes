import {
  DialogButton,
  Focusable,
  SliderField,
  PanelSectionRow,
  useParams
} from '@decky/ui'
import { useEffect, useState } from 'react'
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
  const appDetails = appStore.GetAppOverviewByGameID(parseInt(appid))
  const appName = appDetails?.display_name

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

  return (
    <div>
      <h2 style={{ margin: '20px 0' }}>{appName}</h2>

      <Focusable
        style={{
          background: 'var(--main-editor-bg-color)',
          borderRadius: '6px',
          display: 'grid',
          gridGap: '16px',
          gridTemplateColumns: '2fr max-content max-content',
          height: 'max-content',
          padding: '10px 10px 10px 16px',
          alignItems: 'center'
        }}
      >
        <div style={{ padding: '0 10px' }}>
          <PanelSectionRow>
            <SliderField
              layout="below"
              bottomSeparator="none"
              label={t('volume')}
              description={t('gameVolumeDescription')}
              value={themeVolume * 100}
              onChange={(newVal) => updateThemeVolume(newVal / 100)}
              min={0}
              max={100}
              step={1}
              icon={<FaVolumeUp />}
              editableValue
            />
          </PanelSectionRow>
        </div>
        <DialogButton
          onClick={audioPlayer.togglePlay}
          disabled={loading || themeLoading}
          focusable={!loading && !themeLoading}
          style={{ height: 'max-content' }}
        >
          {loading || themeLoading ? (
            <Spinner />
          ) : audioPlayer.isPlaying ? (
            t('stop')
          ) : (
            t('play')
          )}
        </DialogButton>
        <DialogButton
          onClick={() => updateThemeVolume(settings.volume, true)}
          style={{ height: 'max-content' }}
        >
          {t('resetVolume')}
        </DialogButton>
      </Focusable>
    </div>
  )
}
