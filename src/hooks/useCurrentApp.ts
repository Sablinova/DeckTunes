import { useEffect, useState } from 'react'

export type CurrentAppInfo = {
  appId: number
  appName: string
  source: 'running' | 'page'
}

function detectCurrentApp(): CurrentAppInfo | null {
  try {
    // 1. Check currently running app
    const runningApp = (window as any).Router?.MainRunningApp
    if (runningApp?.appid) {
      const id = Number(runningApp.appid)
      const name =
        runningApp.display_name ||
        (window as any).appStore?.GetAppOverviewByGameID(id)?.display_name ||
        `App ${id}`
      return { appId: id, appName: name, source: 'running' }
    }

    // 2. Check current page pathname / hash for /library/app/:appid or /app/:appid
    const path =
      typeof window !== 'undefined'
        ? (window.location?.pathname || '') + (window.location?.hash || '')
        : ''
    const match = path.match(/\/(?:library\/app|app)\/(\d+)/)
    if (match) {
      const id = parseInt(match[1], 10)
      if (!isNaN(id) && id > 0) {
        const overview = (window as any).appStore?.GetAppOverviewByGameID(id)
        const name = overview?.display_name || `App ${id}`
        return { appId: id, appName: name, source: 'page' }
      }
    }
  } catch (err) {
    console.warn('[DeckTunes] Error detecting current app:', err)
  }

  return null
}

export function useCurrentApp(): CurrentAppInfo | null {
  const [currentApp, setCurrentApp] = useState<CurrentAppInfo | null>(() =>
    detectCurrentApp()
  )

  useEffect(() => {
    function update() {
      const app = detectCurrentApp()
      setCurrentApp((prev) => {
        if (!prev && !app) return null
        if (prev && app && prev.appId === app.appId && prev.source === app.source) {
          return prev
        }
        return app
      })
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  return currentApp
}

export default useCurrentApp
