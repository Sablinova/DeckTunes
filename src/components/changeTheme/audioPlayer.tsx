import { DialogButton, Focusable } from '@decky/ui'
import { useEffect, useState } from 'react'
import useTranslations from '../../hooks/useTranslations'
import { getResolver } from '../../actions/audio'
import { YouTubeVideoPreview } from '../../../types/YouTube'
import { FaCheck } from 'react-icons/fa'
import Spinner from '../spinner'
import useAudioPlayer from '../../hooks/useAudioPlayer'
import { useSettings } from '../../hooks/useSettings'

export default function AudioPlayer({
  handlePlay,
  selected,
  selectNewAudio,
  video,
  volume
}: {
  video: YouTubeVideoPreview & { isPlaying: boolean }
  volume: number
  handlePlay: (startPlaying: boolean) => void
  selected: boolean
  selectNewAudio: (audio: {
    title: string
    videoId: string
    audioUrl: string
  }) => Promise<void>
}) {
  const t = useTranslations()
  // If the URL is defined already, we don't need to load anything here.
  const [loading, setLoading] = useState(video.url === undefined)
  const [downloading, setDownloading] = useState(false)
  const [audioUrl, setAudio] = useState<string | undefined>()
  const { settings, isLoading: settingsLoading } = useSettings()

  const audioPlayer = useAudioPlayer(audioUrl)

  useEffect(() => {
    async function getData() {
      const resolver = getResolver(settings.useYtDlp)
      setLoading(true)
      const res = await resolver.getAudioUrlFromVideo(video)
      setAudio(res)
      setLoading(false)
    }
    if (video.id.length && !settingsLoading) {
      getData()
    }
  }, [video.id, settingsLoading])

  useEffect(() => {
    if (audioPlayer.isReady) {
      audioPlayer.setVolume(volume)
    }
  }, [audioPlayer.isReady, volume])

  useEffect(() => {
    if (audioPlayer.isReady) {
      if (video.isPlaying) audioPlayer.play()
      else audioPlayer.stop()
    }
  }, [video.isPlaying])

  function togglePlay() {
    handlePlay(!video.isPlaying)
  }

  async function selectAudio() {
    if (audioUrl?.length && video.id.length) {
      setDownloading(true)
      try {
        await selectNewAudio({
          title: video.title,
          videoId: video.id,
          audioUrl: audioUrl
        })
      } finally {
        setDownloading(false)
      }
    }
  }

  if (!loading && !audioUrl) return <></>
  return (
    <Focusable
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: selected
          ? '1px solid #67c1f5'
          : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '12px',
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    >
      <img
        src={video.thumbnail}
        alt=""
        style={{
          display: 'block',
          width: '100%',
          aspectRatio: '16 / 9',
          objectFit: 'cover',
          borderRadius: '4px',
          background: '#171d25'
        }}
      />
      <p
        style={{
          margin: '12px 0',
          fontSize: '14px',
          lineHeight: '20px',
          height: '40px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}
      >
        {video.title}
      </p>
      {loading || downloading ? (
        <div
          role="status"
          style={{
            height: '40px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px'
          }}
        >
          <Spinner />
          {downloading ? t('applyingTheme') : t('loadingAudio')}
        </div>
      ) : (
        <Focusable style={{ display: 'flex', gap: '8px' }}>
          <DialogButton
            onClick={togglePlay}
            disabled={!audioPlayer.isReady}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 6px',
              fontSize: '14px'
            }}
          >
            {video.isPlaying ? t('stop') : t('previewMusic')}
          </DialogButton>
          <DialogButton
            disabled={selected}
            onClick={selectAudio}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 6px',
              fontSize: '14px'
            }}
          >
            {selected ? (
              <span
                style={{
                  display: 'inline-flex',
                  gap: '6px',
                  alignItems: 'center'
                }}
              >
                <FaCheck />
                {t('selected')}
              </span>
            ) : (
              t('applyTheme')
            )}
          </DialogButton>
        </Focusable>
      )}
    </Focusable>
  )
}
