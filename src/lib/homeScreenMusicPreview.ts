import { findSP, Router } from '@decky/ui'
import { getCache, updateCache } from '../cache/musicCache'
import { getResolver } from '../actions/audio'
import { Settings } from '../hooks/useSettings'
import { AudioLoaderCompatState } from '../state/AudioLoaderCompatState'
import { inspectHomeFocus } from './homeFocus'
import { HomePreviewController } from './homePreviewController'
import { findSteamHomeWindow } from './steamHomeWindow'
import { updateHomePreviewDiagnostics as report } from './homePreviewDiagnostics'

export function installHomeScreenMusicPreview(
  state: AudioLoaderCompatState,
  settings: Settings,
  preferredWindow?: Window
) {
  let doc: Document | undefined
  let hosts: Window[] = []
  let detachDocument: (() => void) | undefined
  report({ runtime: 'Starting' })
  const controller = new HomePreviewController({
    getFocusedAppId: () => {
      const focus = doc ? inspectHomeFocus(doc, hosts) : null
      report({ focus })
      const { gamesRunning, onAppPage } = state.getPublicState()
      if (onAppPage || gamesRunning.length || Router?.RunningApps?.length) {
        report({
          runtime: onAppPage
            ? 'Game-details player owns audio'
            : 'A game is running'
        })
        return null
      }
      report({ runtime: doc ? 'Running' : 'Steam UI window not found' })
      return focus?.appId ?? null
    },
    resolve: async (appId, isCurrent) => {
      const cache = await getCache(appId)
      // An empty videoId is the existing per-game "No Music" override.
      if (!isCurrent()) return undefined
      if (cache?.videoId === '') {
        report({ lastResult: `App ${appId}: No Music is selected` })
        return undefined
      }
      const resolver = getResolver(settings.useYtDlp)
      let audioUrl: string | undefined
      let volume = cache?.volume
      if (cache?.videoId) {
        report({ lastResult: `App ${appId}: resolving saved theme` })
        audioUrl = await resolver.getAudioUrlFromVideo({ id: cache.videoId })
      } else {
        // Match game-details behavior: Default Muted permits saved themes but
        // prevents discovering new themes until the user selects one manually.
        if (settings.defaultMuted) {
          report({
            lastResult: `App ${appId}: Default Muted prevents theme search`
          })
          return undefined
        }
        const appName = appStore
          .GetAppOverviewByGameID(appId)
          ?.display_name?.replace(/(™|®|©)/g, '')
          .trim()
        if (!appName) {
          report({ lastResult: `App ${appId}: game name is unavailable` })
          return undefined
        }
        report({ lastResult: `Searching: ${appName}` })
        const theme = await resolver.getAudio(appName, isCurrent)
        if (!isCurrent()) return undefined
        if (!theme?.videoId || !theme.audioUrl) {
          report({
            lastResult: `App ${appId}: search returned no playable theme`
          })
          return undefined
        }

        // A manual selection or No Music override made during a slow search
        // takes precedence over its automatic result.
        const saved = await updateCache(
          appId,
          { videoId: theme.videoId },
          (current) => isCurrent() && current?.videoId === undefined
        )
        if (!isCurrent() || saved?.videoId !== theme.videoId) return undefined
        volume = saved.volume
        audioUrl = theme.audioUrl
      }
      if (!audioUrl) {
        if (isCurrent())
          report({
            lastResult: `App ${appId}: saved theme has no playable audio URL`
          })
        return undefined
      }
      return {
        audioUrl,
        volume:
          typeof volume === 'number' && Number.isFinite(volume)
            ? volume
            : settings.volume
      }
    },
    createAudio: () => {
      const AudioConstructor = doc?.defaultView?.Audio ?? Audio
      return new AudioConstructor()
    },
    onPlaybackChange: (active) => state.setHomePreviewActive(active),
    onError: (error) => {
      console.debug('[DeckTunes] Home preview failed:', error)
      report({
        lastResult: `Playback failed: ${error instanceof Error ? error.message : String(error)}`
      })
    },
    onStatus: (playback, appId) => {
      report({
        playback,
        lastAppId: appId,
        ...(playback === 'Playing'
          ? { lastResult: `Playing App ${appId}` }
          : {})
      })
    }
  })

  const reconcile = () => {
    // Steam can replace the SP document when reloading Gaming Mode.
    const located = findSteamHomeWindow(
      window,
      preferredWindow,
      Router?.WindowStore?.GamepadUIMainWindowInstance?.BrowserWindow,
      findSP
    )
    hosts = located.hosts
    const nextDocument = located.doc
    if (nextDocument !== doc) {
      detachDocument?.()
      doc = nextDocument
      if (doc) {
        const observedDocument = doc
        const win = doc.defaultView
        const observer = new MutationObserver(controller.update)
        observer.observe(doc, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['class', 'data-appid', 'hidden', 'style']
        })
        doc.addEventListener('focusin', controller.update, true)
        doc.addEventListener('focusout', controller.update, true)
        doc.addEventListener('visibilitychange', controller.update)
        win?.addEventListener('popstate', controller.update)
        detachDocument = () => {
          observer.disconnect()
          observedDocument.removeEventListener(
            'focusin',
            controller.update,
            true
          )
          observedDocument.removeEventListener(
            'focusout',
            controller.update,
            true
          )
          observedDocument.removeEventListener(
            'visibilitychange',
            controller.update
          )
          win?.removeEventListener('popstate', controller.update)
        }
      }
    }
    controller.update()
  }

  state.eventBus.addEventListener('stateUpdate', controller.update)
  // pushState does not emit popstate. Also covers late SP creation and running
  // apps already present when the plugin loads. Installed only while enabled.
  const interval = setInterval(reconcile, 100)
  reconcile()
  return () => {
    clearInterval(interval)
    state.eventBus.removeEventListener('stateUpdate', controller.update)
    detachDocument?.()
    controller.dispose()
    report({ runtime: 'Stopped' })
  }
}
