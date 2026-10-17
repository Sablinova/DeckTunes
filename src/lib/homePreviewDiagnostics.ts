import { useSyncExternalStore } from 'react'
import type { HomeFocusInspection } from './homeFocus'

let snapshot = {
  build: 'home-preview-shared-theme-v5',
  runtime: 'Not started',
  playback: 'No preview attempt yet',
  lastResult: '',
  lastAppId: null as number | null,
  focus: null as HomeFocusInspection | null,
  recentFocus: [] as HomeFocusInspection[]
}
const listeners = new Set<() => void>()
export function updateHomePreviewDiagnostics(patch: Partial<typeof snapshot>) {
  const next = { ...snapshot, ...patch }
  if (
    patch.focus &&
    JSON.stringify(patch.focus) !== JSON.stringify(snapshot.focus)
  ) {
    next.recentFocus = [...snapshot.recentFocus.slice(-5), patch.focus]
  }
  if (JSON.stringify(next) === JSON.stringify(snapshot)) return
  snapshot = next
  listeners.forEach((listener) => listener())
}
export const useHomePreviewDiagnostics = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => snapshot
  )
