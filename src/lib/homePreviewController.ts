type PreviewAudio = Pick<
  HTMLAudioElement,
  | 'src'
  | 'loop'
  | 'volume'
  | 'play'
  | 'pause'
  | 'load'
  | 'removeAttribute'
  | 'onerror'
>

export interface HomePreviewDependencies {
  getFocusedAppId(): number | null
  resolve(
    appId: number,
    isCurrent: () => boolean
  ): Promise<{ audioUrl: string; volume: number } | undefined>
  createAudio(): PreviewAudio
  onPlaybackChange(active: boolean): void
  onError(error: unknown): void
  onStatus?(status: string, appId: number): void
}

// Owns only home audio. Page players retain their existing playback behavior.
export class HomePreviewController {
  private target: number | null = null
  private generation = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private audio: PreviewAudio | undefined
  private disposed = false

  constructor(private readonly deps: HomePreviewDependencies) {}

  update = () => {
    if (this.disposed) return
    const appId = this.deps.getFocusedAppId()
    if (appId === this.target) return

    this.target = appId
    const generation = ++this.generation
    clearTimeout(this.timer)
    this.stopAudio()
    if (appId === null) return
    this.deps.onStatus?.('Waiting for 500ms focus debounce', appId)

    this.timer = setTimeout(() => {
      void this.start(appId, generation)
    }, 500)
  }

  dispose() {
    this.disposed = true
    ++this.generation
    clearTimeout(this.timer)
    this.stopAudio()
  }

  private isCurrent(appId: number, generation: number) {
    return (
      !this.disposed &&
      generation === this.generation &&
      this.deps.getFocusedAppId() === appId
    )
  }

  private async start(appId: number, generation: number) {
    try {
      if (!this.isCurrent(appId, generation)) return
      this.deps.onStatus?.('Resolving theme', appId)
      const theme = await this.deps.resolve(appId, () =>
        this.isCurrent(appId, generation)
      )
      if (!theme?.audioUrl || !this.isCurrent(appId, generation)) return

      const audio = this.deps.createAudio()
      this.audio = audio
      audio.src = theme.audioUrl
      audio.loop = true
      audio.volume = Number.isFinite(theme.volume)
        ? Math.min(1, Math.max(0, theme.volume))
        : 1
      audio.onerror = () => {
        if (this.audio === audio) {
          this.stopAudio()
          this.deps.onError(new Error('Audio loading failed'))
        }
      }
      this.deps.onPlaybackChange(true)
      await audio.play()
      if (this.audio === audio && this.isCurrent(appId, generation)) {
        this.deps.onStatus?.('Playing', appId)
      }
    } catch (error) {
      // A cancelled play() may reject after the next track has already started.
      if (this.isCurrent(appId, generation)) {
        this.stopAudio()
        this.deps.onError(error)
      }
    }
  }

  private stopAudio() {
    const audio = this.audio
    this.audio = undefined
    if (!audio) return
    audio.onerror = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    this.deps.onPlaybackChange(false)
  }
}
