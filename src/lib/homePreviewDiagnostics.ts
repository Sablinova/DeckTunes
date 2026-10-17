import { useSyncExternalStore } from 'react'
import type { HomeFocusInspection } from './homeFocus'

let snapshot = {
  build: 'home-preview-focus-v2',
  runtime: 'Not started',
  playback: 'No preview attempt yet',
  lastResult: '',
  lastAppId: null as number | null,
  focus: null as HomeFocusInspection | null
}
const listeners = new Set<() => void>()
export function updateHomePreviewDiagnostics(patch: Partial<typeof snapshot>) {
  const next = { ...snapshot, ...patch }
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
