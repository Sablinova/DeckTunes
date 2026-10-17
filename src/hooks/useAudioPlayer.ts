import { useEffect, useMemo, useState } from 'react'
import { useAudioLoaderCompatState } from '../state/AudioLoaderCompatState'

const useAudioPlayer = (
  audioUrl: string | undefined
): {
  play: () => void
  pause: () => void
  stop: () => void
  setVolume: (volume: number) => void
  togglePlay: () => void
  isPlaying: boolean
  isReady: boolean
} => {
  const context = useAudioLoaderCompatState()
  // Defensive: context may be null if rendered outside AudioLoaderCompatStateContextProvider
  const setOnThemePage = context?.setOnThemePage ?? (() => {})
  const gamesRunning = context?.gamesRunning ?? []

  const audioPlayer: HTMLAudioElement = useMemo(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    return audio
  }, [])

  audioPlayer.oncanplaythrough = () => {
    setIsReady(true)
    setOnThemePage(true)
  }

  const [isPlaying, setIsPlaying] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (audioUrl?.length) {
      audioPlayer.src = audioUrl
      audioPlayer.loop = true
    }
  }, [audioUrl])

  useEffect(() => {
    setOnThemePage(true)
    return () => {
      unload()
    }
  }, [])

  useEffect(() => {
    if (gamesRunning.length) stop()
  }, [gamesRunning.length])

  function play() {
    if (
      !gamesRunning.length &&
      audioPlayer.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA
    ) {
      // Stop the Home owner before asking this page's audio element to play.
      setOnThemePage(true)
      audioPlayer
        .play()
        .then(() => setIsPlaying(true))
        .catch(console.debug)
    }
  }

  function pause() {
    if (!audioPlayer.paused && !audioPlayer.ended) {
      audioPlayer.pause()
      setIsPlaying(false)
    }
  }

  function stop() {
    if (!audioPlayer.paused || audioPlayer.currentTime > 0) {
      audioPlayer.pause()
      audioPlayer.currentTime = 0
      setIsPlaying(false)
    }
  }

  function togglePlay() {
    if (isPlaying) stop()
    else play()
  }

  function setVolume(newVolume: number) {
    audioPlayer.volume = newVolume
  }

  function unload() {
    audioPlayer.oncanplaythrough = null
    stop()
    audioPlayer.src = ''
    setIsPlaying(false)
    setIsReady(false)
    setOnThemePage(false)
  }

  return {
    play,
    pause,
    stop,
    setVolume,
    togglePlay,
    isPlaying,
    isReady
  }
}

export default useAudioPlayer
