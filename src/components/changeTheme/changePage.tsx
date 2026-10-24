import {
  DialogButton,
  Focusable,
  ModalRoot,
  SteamSpinner,
  TextField,
  showModal,
  useParams
} from '@decky/ui'
import { useEffect, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import AudioPlayer from './audioPlayer'
import { getCache, updateCache } from '../../cache/musicCache'
import useTranslations from '../../hooks/useTranslations'
import { YouTubeVideoPreview } from '../../../types/YouTube'
import NoMusic from './noMusic'
import { getResolver } from '../../actions/audio'

export default function ChangePage({
  customSearch,
  currentSearch,
  setInitialSearch,
  handlePlay,
  loading,
  videos,
  searchError,
  retrySearch
}: {
  videos: (YouTubeVideoPreview & { isPlaying: boolean })[]
  loading: boolean
  handlePlay: (idx: number, startPlaying: boolean) => void
  customSearch: (term: string) => void
  setInitialSearch: () => string
  currentSearch: string
  searchError: string
  retrySearch: () => void
}) {
  const t = useTranslations()
  const { settings } = useSettings()
  const { appid } = useParams<{ appid: string }>()
  const [selected, setSelected] = useState<string | undefined>()
  const [searchTerm, setSearchTerm] = useState(currentSearch)

  useEffect(() => {
    async function getData() {
      const cache = await getCache(parseInt(appid))
      setSelected(cache?.videoId)
    }
    getData()
  }, [appid])

  async function selectNewAudio(audio: {
    title: string
    videoId: string
    audioUrl: string
  }) {
    if (settings.downloadAudio && audio.videoId) {
      const success = await getResolver(settings.useYtDlp).downloadAudio({
        id: audio.videoId,
        url: audio.audioUrl
      })
      if (!success) {
        showModal(
          <ModalRoot>{t('downloadFailedDetail')}</ModalRoot>,
          undefined,
          { strTitle: t('downloadFailed') }
        )
        return
      }
    }
    await updateCache(parseInt(appid), { videoId: audio.videoId })
    setSelected(audio.videoId)
  }

  return (
    <div
      style={{
        padding: '16px 24px 32px',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        maxWidth: '1088px',
        margin: '0 auto'
      }}
    >
      <label
        htmlFor={`decktunes-theme-search-${appid}`}
        style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '12px',
          fontWeight: 500,
          color: '#aab5c2'
        }}
      >
        {t('musicSearchPlaceholder')}
      </label>
      <Focusable
        flow-children="row"
        style={{
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: 'minmax(0, 1fr) 112px 96px',
          alignItems: 'center',
          marginBottom: '20px'
        }}
      >
        <form
          style={{ minWidth: 0, margin: 0 }}
          onSubmit={(event) => {
            event.preventDefault()
            customSearch(searchTerm)
          }}
        >
          <TextField
            id={`decktunes-theme-search-${appid}`}
            aria-label={t('musicSearchPlaceholder')}
            onChange={(event) => setSearchTerm(event.target.value)}
            value={searchTerm}
          />
        </form>
        <DialogButton
          disabled={!searchTerm.trim()}
          onClick={() => customSearch(searchTerm)}
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            boxSizing: 'border-box',
            height: '40px',
            minHeight: '40px',
            margin: 0
          }}
        >
          {t('search')}
        </DialogButton>
        <DialogButton
          onClick={() => setSearchTerm(setInitialSearch())}
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            boxSizing: 'border-box',
            height: '40px',
            minHeight: '40px',
            margin: 0
          }}
        >
          {t('reset')}
        </DialogButton>
      </Focusable>

      <NoMusic selected={selected === ''} selectNewAudio={selectNewAudio} />

      {searchError && (
        <div
          role="alert"
          style={{
            padding: '16px',
            margin: '16px 0',
            borderRadius: '8px',
            background: 'rgba(225, 106, 106, 0.08)',
            border: '1px solid rgba(225, 106, 106, 0.25)'
          }}
        >
          <strong>{t('musicSearchFailed')}</strong>
          <p
            style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              fontSize: '13px',
              maxHeight: '140px',
              overflowY: 'auto'
            }}
          >
            {searchError}
          </p>
          <DialogButton onClick={retrySearch} disabled={loading}>
            {t('retryMusicSearch')}
          </DialogButton>
        </div>
      )}

      <h3
        style={{
          margin: '24px 0 12px',
          fontSize: '16px',
          fontWeight: 500,
          color: '#c5d0dc'
        }}
      >
        {t('searchResults')}
      </h3>
      {loading && !videos.length ? (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '40px 16px'
          }}
        >
          <SteamSpinner style={{ width: '32px', height: '32px' }} />
          {t('searchingMusic')}
        </div>
      ) : (
        <Focusable
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px',
            alignItems: 'start'
          }}
        >
          {videos.map((video, index) => (
            <AudioPlayer
              key={video.id}
              video={video}
              volume={settings.volume}
              handlePlay={(status) => handlePlay(index, status)}
              selected={selected === video.id}
              selectNewAudio={selectNewAudio}
            />
          ))}
        </Focusable>
      )}
      {!loading && !videos.length && !searchError && (
        <p role="status" style={{ color: '#aab5c2', padding: '24px 0' }}>
          {t('noSearchResults')}
        </p>
      )}
    </div>
  )
}
