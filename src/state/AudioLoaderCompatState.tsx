/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, FC, useContext, useEffect, useState } from 'react'

interface PublicAudioLoaderCompatState {
  gamesRunning: number[]
  onAppPage: boolean
}

// The localThemeEntry interface refers to the theme data as given by the python function, the Theme class refers to a theme after it has been formatted and the generate function has been added

interface PublicAudioLoaderCompatStateContext
  extends PublicAudioLoaderCompatState {
  setGamesRunning(gamesRunning: number[]): void
  setOnThemePage(onAppPage: boolean): void
}

// This class creates the getter and setter functions for all of the global state data.
export class AudioLoaderCompatState {
  private delayMs = 1000
  private gamesRunning: number[] = []
  private onThemePage: boolean = false
  private pageAudioActive = false
  private homePreviewActive = false
  private themePageVersion = 0

  // You can listen to this eventBus' 'stateUpdate' event and use that to trigger a useState or other function that causes a re-render
  public eventBus = new EventTarget()

  getPublicState() {
    return {
      gamesRunning: this.gamesRunning,
      onAppPage: this.pageAudioActive
    }
  }

  setGamesRunning(gamesRunning: number[]) {
    const oldGamesRunning = this.gamesRunning
    const noGamesRunning = gamesRunning.length === 0
    const incrMs = 10

    this.gamesRunning = gamesRunning

    // AudioLoader will automatically start playing music when it detects that no games are running,
    // so we need to force it to stop so we can control whether it plays or not
    if (noGamesRunning && oldGamesRunning.length > 0) {
      for (let i = 0; i < this.delayMs; i += incrMs) {
        setTimeout(() => {
          this.setAudioLoaderEnabled(false)
        }, i)
      }
    }
    if (noGamesRunning) {
      setTimeout(() => this.forceUpdate(), this.delayMs)
    } else {
      this.forceUpdate()
    }
  }

  setOnThemePage(onAppPage: boolean) {
    const version = ++this.themePageVersion
    this.pageAudioActive = onAppPage

    // Claim page playback synchronously, before its audio starts. This stops
    // Home previews even if their resolver is still in flight during navigation.
    if (onAppPage) {
      this.setOnThemePageInternal(true, version)
      return
    }

    // We need to delay the setting of onThemePage if false to
    // prevent AudioLoader music from playing during page transitions
    setTimeout(
      () => {
        this.setOnThemePageInternal(onAppPage, version)
      },
      onAppPage ? 0 : this.delayMs
    )
    // Home can start its own 500ms debounce immediately after the page exits;
    // retain the delayed AudioLoader release separately for page transitions.
    this.forceUpdate()
  }

  setHomePreviewActive(active: boolean) {
    if (active === this.homePreviewActive) return
    this.homePreviewActive = active
    this.forceUpdate()
  }

  private setAudioLoaderEnabled(enabled: boolean) {
    const audioLoader = (window as any).AUDIOLOADER_MENUMUSIC
    if (audioLoader) {
      if (enabled) audioLoader.play()
      else audioLoader.pause()
    }
  }

  private setOnThemePageInternal(onAppPage: boolean, version: number) {
    if (version !== this.themePageVersion) {
      return
    }
    this.onThemePage = onAppPage
    this.forceUpdate()
  }

  private forceUpdate() {
    if (this.onThemePage || this.homePreviewActive) {
      this.setAudioLoaderEnabled(false)
    } else {
      this.setAudioLoaderEnabled(this.gamesRunning.length === 0)
    }

    this.eventBus.dispatchEvent(new Event('stateUpdate'))
  }
}

const AudioLoaderCompatStateContext =
  createContext<PublicAudioLoaderCompatStateContext>(null as any)
export const useAudioLoaderCompatState = () =>
  useContext(AudioLoaderCompatStateContext)

interface ProviderProps {
  AudioLoaderCompatStateClass: AudioLoaderCompatState
  children?: React.ReactNode
}

// This is a React Component that you can wrap multiple separate things in, as long as they both have used the same instance of the CssLoaderState class, they will have synced state
export const AudioLoaderCompatStateContextProvider: FC<ProviderProps> = ({
  children,
  AudioLoaderCompatStateClass
}) => {
  const [publicState, setPublicState] = useState<PublicAudioLoaderCompatState>({
    ...AudioLoaderCompatStateClass.getPublicState()
  })

  useEffect(() => {
    function onUpdate() {
      setPublicState({ ...AudioLoaderCompatStateClass.getPublicState() })
    }

    AudioLoaderCompatStateClass.eventBus.addEventListener(
      'stateUpdate',
      onUpdate
    )

    return () =>
      AudioLoaderCompatStateClass.eventBus.removeEventListener(
        'stateUpdate',
        onUpdate
      )
  }, [])

  const setGamesRunning = (gamesRunning: number[]) =>
    AudioLoaderCompatStateClass.setGamesRunning(gamesRunning)
  const setOnThemePage = (onAppPage: boolean) =>
    AudioLoaderCompatStateClass.setOnThemePage(onAppPage)

  return (
    <AudioLoaderCompatStateContext.Provider
      value={{
        ...publicState,
        setGamesRunning,
        setOnThemePage
      }}
    >
      {children}
    </AudioLoaderCompatStateContext.Provider>
  )
}
