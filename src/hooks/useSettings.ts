import { call } from '@decky/api'
import { useEffect, useSyncExternalStore } from 'react'

export type Settings = {
  defaultMuted: boolean
  useYtDlp: boolean
  downloadAudio: boolean
  invidiousInstance: string
  volume: number
  homeScreenMusicPreview: boolean
}

export const defaultSettings: Settings = {
  defaultMuted: false,
  useYtDlp: false,
  downloadAudio: false,
  invidiousInstance: 'https://inv.tux.pizza',
  volume: 1,
  homeScreenMusicPreview: false
}

// All mounted players and the settings panel need the same live settings.
let snapshot = { settings: defaultSettings, isLoading: true }
let loading: Promise<void> | undefined
let saving: Promise<unknown> = Promise.resolve()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const getSnapshot = () => snapshot
const notify = () => listeners.forEach((listener) => listener())

function loadSettings() {
  loading ??= call<[string, Settings], Partial<Settings> | null>(
    'get_setting',
    'settings',
    defaultSettings
  )
    .then((saved) => {
      snapshot = {
        settings: { ...defaultSettings, ...saved },
        isLoading: false
      }
      notify()
    })
    .catch((error) => {
      console.error('[DeckTunes] Failed to load settings:', error)
      snapshot = { ...snapshot, isLoading: false }
      loading = undefined
      notify()
    })
}

export const useSettings = () => {
  const { settings, isLoading } = useSyncExternalStore(subscribe, getSnapshot)
  useEffect(() => {
    loadSettings()
  }, [])

  function updateSettings(
    key: keyof Settings,
    value: Settings[keyof Settings]
  ) {
    const newSettings = { ...snapshot.settings, [key]: value }
    snapshot = { settings: newSettings, isLoading: false }
    notify()
    // Preserve ordering when a slider or multiple toggles change quickly.
    saving = saving
      .then(() =>
        call<[string, Settings], Settings>(
          'set_setting',
          'settings',
          newSettings
        )
      )
      .catch(console.error)
  }

  function setDefaultMuted(value: Settings['defaultMuted']) {
    updateSettings('defaultMuted', value)
  }
  function setUseYtDlp(value: Settings['useYtDlp']) {
    updateSettings('useYtDlp', value)
    // Currently, downloads don't work with Invidious, so they can only be enabled iff yt-dlp is enabled.
    updateSettings('downloadAudio', value)
  }
  function setDownloadAudio(value: Settings['downloadAudio']) {
    updateSettings('downloadAudio', value)
  }
  function setInvidiousInstance(value: Settings['invidiousInstance']) {
    updateSettings('invidiousInstance', value)
  }
  function setVolume(value: Settings['volume']) {
    updateSettings('volume', value)
  }
  function setHomeScreenMusicPreview(value: boolean) {
    updateSettings('homeScreenMusicPreview', value)
  }

  return {
    settings,
    setDefaultMuted,
    setUseYtDlp,
    setDownloadAudio,
    setInvidiousInstance,
    setVolume,
    setHomeScreenMusicPreview,
    isLoading
  }
}
