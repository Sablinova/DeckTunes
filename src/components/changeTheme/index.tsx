import { Tabs, useParams } from '@decky/ui'
import { useEffect, useState } from 'react'

import useTranslations from '../../hooks/useTranslations'
import ChangePage from './changePage'
import AboutPage from './aboutPage'
import { getResolver } from '../../actions/audio'
import { YouTubeVideoPreview } from '../../../types/YouTube'
import GameSettings from './gameSettings'
import { useSettings } from '../../hooks/useSettings'

export default function ChangeTheme() {
  const [currentTab, setCurrentTab] = useState<string>('change-music-tab')
  const t = useTranslations()
  const { settings, isLoading: settingsLoading } = useSettings()
  const { appid } = useParams<{ appid: string }>()
  const appDetails = appStore.GetAppOverviewByGameID(parseInt(appid))
  const appName = appDetails?.display_name?.replace(/(™|®|©)/g, '')

  const [videos, setVideos] = useState<
    (YouTubeVideoPreview & { isPlaying: boolean })[]
  >([])
  const [loadingNum, setLoadingNum] = useState(0)
  const [searchError, setSearchError] = useState('')
  const [searchAttempt, setSearchAttempt] = useState(0)
  const initialSearch = appName?.concat(' Theme Music') ?? ''
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  useEffect(() => {
    let ignore = false
    async function getData() {
      setLoadingNum((x) => x + 1)
      setVideos([])
      setSearchError('')
      try {
        const resolver = getResolver(settings.useYtDlp)
        const res = resolver.getYouTubeSearchResults(searchTerm, () => !ignore)
        for await (const video of res) {
          if (ignore) {
            break
          }
          setVideos((oldVideos) => [
            ...oldVideos,
            { isPlaying: false, ...video }
          ])
        }
      } catch (e) {
        console.error('Error fetching YouTube results:', e)
        if (!ignore) setSearchError(e instanceof Error ? e.message : String(e))
      }
      setLoadingNum((x) => x - 1)
    }
    if (searchTerm.length > 0 && !settingsLoading) {
      getData()
    }
    return () => {
      ignore = true
    }
  }, [searchTerm, settingsLoading, searchAttempt, settings.useYtDlp])

  function handlePlay(index: number, startPlay: boolean) {
    setVideos((oldVideos) => {
      const newVideos = oldVideos.map((v, vIndex) => ({
        ...v,
        isPlaying: vIndex === index ? startPlay : false
      }))
      return newVideos
    })
  }

  function setInitialSearch() {
    setSearchTerm(initialSearch)
    return initialSearch
  }

  return (
    <div
      style={{
        marginTop: '40px',
        height: 'calc(100% - 40px)',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        overflowX: 'clip'
      }}
    >
      <header
        style={{
          padding: '16px 24px 8px',
          maxWidth: '1088px',
          width: '100%',
          boxSizing: 'border-box',
          flexShrink: 0,
          margin: '0 auto'
        }}
      >
        <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 600 }}>
          {appName}
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#aab5c2' }}>
          {t('sharedThemeDescription')}
        </p>
      </header>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: '100%',
          overflowX: 'clip'
        }}
      >
        <Tabs
          // Enter content with D-pad Down, rather than focusing a panel while
          // Steam is still switching it into view and scrolling the route sideways.
          autoFocusContents={false}
          activeTab={currentTab}
          onShowTab={setCurrentTab}
          tabs={[
            {
              title: t('changeThemeMusic'),
              content: (
                <ChangePage
                  videos={videos}
                  loading={loadingNum > 0}
                  searchError={searchError}
                  retrySearch={() => setSearchAttempt((attempt) => attempt + 1)}
                  handlePlay={handlePlay}
                  customSearch={setSearchTerm}
                  currentSearch={searchTerm}
                  setInitialSearch={setInitialSearch}
                />
              ),
              id: 'change-music-tab'
            },
            {
              title: t('gameSettings'),
              content: <GameSettings />,
              id: 'game-settings-tab'
            },
            { title: t('about'), content: <AboutPage />, id: 'about-tab' }
          ]}
        />
      </div>
    </div>
  )
}
