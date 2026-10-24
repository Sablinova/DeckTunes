import { useEffect, useMemo, useRef, useState } from 'react'
import { useAudioLoaderCompatState } from '../state/AudioLoaderCompatState'

const useAudioPlayer = (
  audioUrl: string | undefined
): {
  play: () => void
  pause: () => void
  stop: (immediate?: boolean) => void
  setVolume: (volume: number) => void
  togglePlay: () => void
  isPlaying: boolean
  isReady: boolean
} => {
  const context = useAudioLoaderCompatState()
  // Defensive: context may be null if rendered outside AudioLoaderCompatStateContextProvider
  const setOnThemePage = context?.setOnThemePage ?? (() => {})
  const gamesRunning = context?.gamesRunning ?? []

  const targetVolumeRef = useRef<number>(1)
  const fadeIntervalRef = useRef<number | null>(null)

  const clearFade = () => {
    if (fadeIntervalRef.current !== null) {
      clearInterval(fadeIntervalRef.current)
      fadeIntervalRef.current = null
    }
  }

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
    stop(true)
    setIsReady(false)
    if (audioUrl?.length) {
      audioPlayer.src = audioUrl
      audioPlayer.loop = true
    } else {
      audioPlayer.removeAttribute('src')
      audioPlayer.load()
    }
  }, [audioUrl])

  useEffect(() => {
    setOnThemePage(true)
    return () => {
      clearFade()
      unload()
    }
  }, [])

  useEffect(() => {
    if (gamesRunning.length) stop(true)
  }, [gamesRunning.length])

  function fadeIn(durationMs = 400) {
    clearFade()
    const targetVol = targetVolumeRef.current
    if (targetVol <= 0) return
    audioPlayer.volume = 0
    const steps = 10
    const stepDuration = durationMs / steps
    const stepIncrement = targetVol / steps
    let currentVol = 0

    fadeIntervalRef.current = window.setInterval(() => {
      currentVol = Math.min(targetVol, currentVol + stepIncrement)
      audioPlayer.volume = currentVol
      if (currentVol >= targetVol) {
        clearFade()
      }
    }, stepDuration)
  }

  function fadeOut(onComplete: () => void, durationMs = 250) {
    clearFade()
    const startVol = audioPlayer.volume
    if (startVol <= 0) {
      onComplete()
      return
    }
    const steps = 10
    const stepDuration = durationMs / steps
    const stepDecrement = startVol / steps
    let currentVol = startVol

    fadeIntervalRef.current = window.setInterval(() => {
      currentVol = Math.max(0, currentVol - stepDecrement)
      audioPlayer.volume = currentVol
      if (currentVol <= 0) {
        clearFade()
        onComplete()
      }
    }, stepDuration)
  }

  function play() {
    if (
      !gamesRunning.length &&
      audioPlayer.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA
    ) {
      // Stop the Home owner before asking this page's audio element to play.
      setOnThemePage(true)
      audioPlayer.volume = 0
      audioPlayer
        .play()
        .then(() => {
          setIsPlaying(true)
          fadeIn(350)
        })
        .catch(console.debug)
    }
  }

  function pause() {
    clearFade()
    if (!audioPlayer.paused && !audioPlayer.ended) {
      audioPlayer.pause()
      setIsPlaying(false)
    }
  }

  function stop(immediate = false) {
    clearFade()
    if (immediate || audioPlayer.paused || gamesRunning.length > 0) {
      if (!audioPlayer.paused || audioPlayer.currentTime > 0) {
        audioPlayer.pause()
        audioPlayer.currentTime = 0
        audioPlayer.volume = targetVolumeRef.current
        setIsPlaying(false)
      }
      return
    }

    fadeOut(() => {
      audioPlayer.pause()
      audioPlayer.currentTime = 0
      audioPlayer.volume = targetVolumeRef.current
      setIsPlaying(false)
    }, 250)
  }

  function togglePlay() {
    if (isPlaying) stop()
    else play()
  }

  function setVolume(newVolume: number) {
    targetVolumeRef.current = newVolume
    if (fadeIntervalRef.current === null) {
      audioPlayer.volume = newVolume
    }
  }

  function unload() {
    clearFade()
    audioPlayer.oncanplaythrough = null
    stop(true)
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
