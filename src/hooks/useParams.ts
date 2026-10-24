import { ReactRouter, useParams as deckyUseParams } from '@decky/ui'

function getUrlParams<T>(): T {
  try {
    const path =
      typeof window !== 'undefined'
        ? (window.location?.pathname || '') + (window.location?.hash || '')
        : ''
    const match = path.match(/\/(?:gamethememusic|library\/app|app)\/(\d+)/)
    return (match ? { appid: match[1] } : {}) as T
  } catch {
    return {} as T
  }
}

function resolveHook(): <T>() => T {
  if (typeof deckyUseParams === 'function') {
    return deckyUseParams as <T>() => T
  }
  try {
    if (ReactRouter && typeof ReactRouter === 'object') {
      const found = Object.values(ReactRouter).find(
        (val) =>
          typeof val === 'function' &&
          /return (\w)\?\1\.params:{}/.test(`${val}`)
      )
      if (typeof found === 'function') {
        return found as <T>() => T
      }
    }
  } catch (err) {
    console.warn('[DeckTunes] Error finding ReactRouter useParams:', err)
  }
  return getUrlParams
}

const resolvedHook = resolveHook()

export const useParams = <T>(): T => {
  try {
    const res = resolvedHook<T>()
    if (res && Object.keys(res).length > 0) {
      return res
    }
  } catch {
    // fallback
  }
  return getUrlParams<T>()
}
