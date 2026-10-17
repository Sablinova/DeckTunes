import { findSP, Router } from '@decky/ui'
import { getCache } from '../cache/musicCache'
import { getResolver } from '../actions/audio'
import { Settings } from '../hooks/useSettings'
import { AudioLoaderCompatState } from '../state/AudioLoaderCompatState'
import { getFocusedHomeAppId } from './homeFocus'
import { HomePreviewController } from './homePreviewController'

export function installHomeScreenMusicPreview(
  state: AudioLoaderCompatState,
  settings: Settings
) {
  let doc: Document | undefined
  let detachDocument: (() => void) | undefined
  const controller = new HomePreviewController({
    getFocusedAppId: () => {
      const { gamesRunning, onAppPage } = state.getPublicState()
      if (onAppPage || gamesRunning.length || Router?.RunningApps?.length) {
        return null
      }
      return doc ? getFocusedHomeAppId(doc) : null
    },
    resolve: async (appId) => {
      const cache = await getCache(appId)
      // Never search for a new theme or change the cache while browsing Home.
      // An empty videoId is the existing per-game "No Music" override.
      if (!cache?.videoId) return undefined
      const audioUrl = await getResolver(
        settings.useYtDlp
      ).getAudioUrlFromVideo({
        id: cache.videoId
      })
      if (!audioUrl) return undefined
      return {
        audioUrl,
        volume:
          typeof cache.volume === 'number' && Number.isFinite(cache.volume)
            ? cache.volume
            : settings.volume
      }
    },
    createAudio: () => new Audio(),
    onPlaybackChange: (active) => state.setHomePreviewActive(active),
    onError: (error) => console.debug('[DeckTunes] Home preview failed:', error)
  })

  const reconcile = () => {
    // Steam can replace the SP document when reloading Gaming Mode.
    const nextDocument = (
      Router?.WindowStore?.GamepadUIMainWindowInstance?.BrowserWindow ??
      findSP()
    )?.document
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
  }
}
