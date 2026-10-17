import { call } from '@decky/api'
import {
  YouTubeVideo,
  YouTubeInitialData,
  Audio,
  YouTubeVideoPreview
} from '../../types/YouTube'
import { Settings, defaultSettings } from '../hooks/useSettings'

abstract class AudioResolver {
  abstract getYouTubeSearchResults(
    searchTerm: string,
    isCurrent?: () => boolean
  ): AsyncIterable<YouTubeVideoPreview>
  abstract getAudioUrlFromVideo(
    video: YouTubeVideo
  ): Promise<string | undefined>
  abstract downloadAudio(video: YouTubeVideo): Promise<boolean>

  async getAudio(
    appName: string,
    isCurrent: () => boolean = () => true
  ): Promise<{ videoId: string; audioUrl: string } | undefined> {
    if (!isCurrent()) return undefined
    const videos = this.getYouTubeSearchResults(
      appName + ' Theme Music',
      isCurrent
    )
    for await (const video of videos) {
      if (!isCurrent()) return undefined
      const audioUrl = await this.getAudioUrlFromVideo(video)
      if (!isCurrent()) return undefined
      if (audioUrl?.length) {
        return { audioUrl, videoId: video.id }
      }
    }
    return undefined
  }
}

class InvidiousAudioResolver extends AudioResolver {
  async getEndpoint() {
    const savedSettings = await call<[string, Settings], Settings>(
      'get_setting',
      'settings',
      defaultSettings
    )
    return savedSettings.invidiousInstance
  }

  async *getYouTubeSearchResults(
    searchTerm: string
  ): AsyncIterable<YouTubeVideoPreview> {
    try {
      const encodedSearchTerm = `${encodeURIComponent(searchTerm)}`
      const endpoint = await this.getEndpoint()
      const res = await fetch(
        `${endpoint}/api/v1/search?type=video&page=1&q=${encodedSearchTerm}`
      )
      if (res.status === 200) {
        const results: YouTubeInitialData = await res.json()
        if (results.length) {
          yield* results
            .map((res) => ({
              title: res.title,
              id: res.videoId,
              thumbnail:
                res.videoThumbnails?.[0].url || 'https://i.ytimg.com/vi/0.jpg'
            }))
            .filter((res) => res.id.length)
        }
      }
    } catch (err) {
      console.debug(err)
    }
    return
  }

  async getAudioUrlFromVideo(video: YouTubeVideo): Promise<string | undefined> {
    try {
      const endpoint = await this.getEndpoint()
      const res = await fetch(
        `${endpoint}/api/v1/videos/${encodeURIComponent(video.id)}?fields=adaptiveFormats`
      )
      if (res.status === 200) {
        const result = await res.json()
        const audioFormats: { adaptiveFormats: Audio[] } = result

        const audios = audioFormats.adaptiveFormats.filter((aud) =>
          aud.type?.includes('audio/webm')
        )
        const audio = audios.reduce((prev, current) => {
          return prev.audioSampleRate > current.audioSampleRate ? prev : current
        }, audios[0])

        return audio?.url
      }
    } catch (err) {
      console.log(err)
    }
    return undefined
  }

  async downloadAudio(video: YouTubeVideo): Promise<boolean> {
    if (!video.url) {
      video.url = await this.getAudioUrlFromVideo(video)
      if (!video.url) {
        return false
      }
    }
    try {
      await call<[string, string]>('download_url', video.url, video.id)
      return true
    } catch (e) {
      console.error(e)
      return false
    }
  }
}

// search_yt / next_yt_result share one backend cursor. Keep each iterator's
// reads together so Home, details, and manual searches cannot mix results.
let ytSearchQueue = Promise.resolve()

class YtDlpAudioResolver extends AudioResolver {
  async *getYouTubeSearchResults(
    searchTerm: string,
    isCurrent: () => boolean = () => true
  ): AsyncIterable<YouTubeVideoPreview> {
    const previousSearch = ytSearchQueue
    let release!: () => void
    ytSearchQueue = new Promise<void>((resolve) => {
      release = resolve
    })
    await previousSearch
    try {
      // Focus may have changed while this search waited for the backend.
      if (!isCurrent()) return
      await call<[string]>('search_yt', searchTerm)
      if (!isCurrent()) return
      let result = await call<[], YouTubeVideoPreview | null>('next_yt_result')
      while (result) {
        if (!isCurrent()) return
        yield result
        if (!isCurrent()) return
        result = await call<[], YouTubeVideoPreview | null>('next_yt_result')
      }
      return
    } catch (err) {
      console.error(err)
    } finally {
      release()
    }
    return
  }

  async getAudioUrlFromVideo(video: YouTubeVideo): Promise<string | undefined> {
    if (video.url) {
      return video.url
    } else {
      // We need to retrieve the audio URL first.
      // This may return a local HTTP URL if the file has been downloaded before,
      // or a direct streaming URL from YouTube.
      // The backend returns either a dict {success, url, ...} or a string (for backwards compat)
      const result = await call<
        [string],
        { success: boolean; url?: string; error?: string } | string | null
      >('single_yt_url', video.id)
      if (result) {
        // Handle both dict response (new) and string response (old format)
        if (typeof result === 'string') {
          return result
        } else if (result.success && result.url) {
          return result.url
        }
      }
      return undefined
    }
  }

  async downloadAudio(video: YouTubeVideo): Promise<boolean> {
    try {
      await call<[string]>('download_yt_audio', video.id)
      return true
    } catch (e) {
      console.error(e)
      return false
    }
  }
}

export function getResolver(useYtDlp: boolean): AudioResolver {
  if (useYtDlp) {
    return new YtDlpAudioResolver()
  } else {
    return new InvidiousAudioResolver()
  }
}

type InvidiousInstance = {
  flag: string
  region: string
  stats: {
    version: string
    software: {
      name: string
      version: string
      branch: string
    }
    openRegistrations: boolean
    usage: {
      users: {
        total: number
        activeHalfyear: number
        activeMonth: number
      }
    }
    metadata: {
      updatedAt: number
      lastChannelRefreshedAt: number
    }
    playback?: {
      totalRequests?: number
      successfulRequests?: number
      ratio?: number
    }
  } | null
  cors: boolean | null
  api: boolean | null
  type: string
  uri: string
  monitor: {
    token: string
    url: string
    alias: string
    last_status: number
    uptime: number
    down: boolean
    down_since: string | null
    up_since: string | null
    error: string | null
    period: number
    apdex_t: number
    string_match: string
    enabled: boolean
    published: boolean
    disabled_locations: string[]
    recipients: string[]
    last_check_at: string
    next_check_at: string
    created_at: string
    mute_until: string | null
    favicon_url: string
    custom_headers: Record<string, string>
    http_verb: string
    http_body: string
    ssl: {
      tested_at: string
      expires_at: string
      valid: boolean
      error: string | null
    }
  }
}

type InvidiousInstances = InvidiousInstance[]

export async function getInvidiousInstances(): Promise<
  { name: string; url: string }[]
> {
  try {
    const res = await fetch(
      'https://api.invidious.io/instances.json?&sort_by=users,health'
    )
    if (res.status === 200) {
      const instances: InvidiousInstances = (await res.json()).map(
        ([, instance]: [string, InvidiousInstance]) => instance
      )
      if (instances?.length) {
        return instances
          .filter((ins) => ins.type === 'https')
          .map((ins) => ({
            name: `${ins.flag} ${ins.monitor?.alias ?? ins.uri} | ${ins.stats?.usage.users.total} Users${
              ins.monitor?.uptime
                ? ` | Uptime: ${(ins.monitor.uptime / 100).toLocaleString(
                    'en',
                    {
                      style: 'percent'
                    }
                  )}`
                : ''
            }`,
            url: ins.uri
          }))
      }
    }
  } catch (err) {
    console.debug(err)
  }
  return []
}
