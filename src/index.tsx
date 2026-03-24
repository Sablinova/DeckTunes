import { definePlugin, staticClasses } from '@decky/ui'
import { routerHook, call, toaster } from '@decky/api'

import { GiMusicalNotes } from 'react-icons/gi'
import { FaDownload } from 'react-icons/fa'

import Settings from './components/settings'
import patchLibraryApp from './lib/patchLibraryApp'
import patchContextMenu, { LibraryContextMenu } from './lib/patchContextMenu'
import ChangeTheme from './components/changeTheme'
import {
  AudioLoaderCompatState,
  AudioLoaderCompatStateContextProvider
} from './state/AudioLoaderCompatState'

import { name } from '@decky/manifest'

type UpdateCheckResponse = {
  success: boolean
  current_version?: string
  latest_version?: string
  update_available?: boolean
  error?: string
}

// Check for yt-dlp updates on plugin load
async function checkYtdlpUpdateOnLoad() {
  try {
    const result = await call<[], UpdateCheckResponse>('check_ytdlp_update')
    if (result.success && result.update_available) {
      toaster.toast({
        title: 'DeckTunes: yt-dlp Update Available',
        body: `${result.current_version} → ${result.latest_version}. Update in plugin settings.`,
        icon: <FaDownload />,
        duration: 5000
      })
    }
  } catch (e) {
    console.error('[DeckTunes] Failed to check yt-dlp update on load:', e)
  }
}

export default definePlugin(() => {
  const state: AudioLoaderCompatState = new AudioLoaderCompatState()
  const libraryPatch = patchLibraryApp(state)

  // Check for yt-dlp updates after a short delay (let plugin fully initialize)
  setTimeout(() => {
    checkYtdlpUpdateOnLoad()
  }, 3000)

  routerHook.addRoute(
    '/gamethememusic/:appid',
    () => (
      <AudioLoaderCompatStateContextProvider
        AudioLoaderCompatStateClass={state}
      >
        <ChangeTheme />
      </AudioLoaderCompatStateContextProvider>
    ),
    {
      exact: true
    }
  )

  const patchedMenu = patchContextMenu(LibraryContextMenu)

  const AppStateRegistrar =
    SteamClient.GameSessions.RegisterForAppLifetimeNotifications(
      (update: AppState) => {
        const { gamesRunning } = state.getPublicState()
        const setGamesRunning = state.setGamesRunning.bind(state)

        if (update.bRunning) {
          setGamesRunning([...gamesRunning, update.unAppID])
        } else {
          const filteredGames = gamesRunning.filter(
            (e: number) => e !== update.unAppID
          )
          setGamesRunning(filteredGames)
        }
      }
    )

  return {
    title: <div className={staticClasses.Title}>{name}</div>,
    icon: <GiMusicalNotes />,
    content: <Settings />,
    onDismount() {
      AppStateRegistrar.unregister()
      routerHook.removePatch('/library/app/:appid', libraryPatch)
      routerHook.removeRoute('/gamethememusic/:appid')
      patchedMenu?.unpatch()
    }
  }
})