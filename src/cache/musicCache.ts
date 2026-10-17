import { call } from '@decky/api'
import localforage from 'localforage'

const STORAGE_KEY = 'game-theme-music-cache'

localforage.config({
  name: STORAGE_KEY
})

type GameThemeMusicCache = {
  videoId?: string | undefined
  volume?: number
}

type GameThemeMusicCacheMapping = { [key: string]: GameThemeMusicCache }

const cacheUpdates = new Map<number, Promise<GameThemeMusicCache | null>>()
const themeRevisions = new Map<number, number>()
let allThemesRevision = 0
const themeListeners = new Set<(appId?: number) => void>()

export function subscribeThemeChanges(listener: (appId?: number) => void) {
  themeListeners.add(listener)
  return () => {
    themeListeners.delete(listener)
  }
}

export function getThemeRevision(appId: number) {
  return `${allThemesRevision}:${themeRevisions.get(appId) ?? 0}`
}

function notifyThemeChange(appId?: number) {
  if (appId === undefined) ++allThemesRevision
  else themeRevisions.set(appId, (themeRevisions.get(appId) ?? 0) + 1)
  for (const listener of themeListeners) listener(appId)
}

export async function updateCache(
  appId: number,
  newData: GameThemeMusicCache,
  shouldUpdate: (current: GameThemeMusicCache | null) => boolean = () => true
) {
  // Serialize read/merge/write per game. A manual choice made during automatic
  // discovery must not be lost to a stale read, nor may volume updates be lost.
  const previous = cacheUpdates.get(appId) ?? Promise.resolve()
  const pending = previous
    .catch(() => {})
    .then(async () => {
      const oldCache = await getCache(appId)
      if (!shouldUpdate(oldCache)) return oldCache
      const saved = await localforage.setItem(appId.toString(), {
        ...(oldCache || {}),
        ...newData
      })
      if (saved.videoId !== oldCache?.videoId) notifyThemeChange(appId)
      return saved
    })
  cacheUpdates.set(appId, pending)
  try {
    return await pending
  } finally {
    if (cacheUpdates.get(appId) === pending) cacheUpdates.delete(appId)
  }
}

export async function getFullCache(): Promise<GameThemeMusicCacheMapping> {
  const fullCache: GameThemeMusicCacheMapping = {}
  await localforage.iterate((value: GameThemeMusicCache, key) => {
    fullCache[key] = value
  })
  return fullCache
}

export async function exportCache() {
  await call<[GameThemeMusicCacheMapping]>('export_cache', await getFullCache())
}

export async function importCache(name: string) {
  const newCache = await call<[string], GameThemeMusicCacheMapping>(
    'import_cache',
    name
  )
  await localforage.clear()
  for (const [key, value] of Object.entries(newCache)) {
    await localforage.setItem(key, value)
  }
  notifyThemeChange()
}

export async function listCacheBackups(): Promise<string[]> {
  return await call<[], string[]>('list_cache_backups')
}

export async function clearCache(appId?: number) {
  if (appId?.toString().length) {
    await localforage.removeItem(appId.toString())
    notifyThemeChange(appId)
  } else {
    await localforage.clear()
    notifyThemeChange()
    await call<[]>('clear_cache')
  }
}

export async function getCache(
  appId: number
): Promise<GameThemeMusicCache | null> {
  const cache = await localforage.getItem<GameThemeMusicCache>(appId.toString())
  return cache
}

export async function clearDownloads() {
  await call<[]>('clear_downloads')
}
