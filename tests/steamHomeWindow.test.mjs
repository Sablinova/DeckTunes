import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs, tsModuleUrl } from './loadTs.mjs'

const { findSteamHomeWindow } = await loadTs('../src/lib/steamHomeWindow.ts', {
  './homeFocus': tsModuleUrl('../src/lib/homeFocus.ts')
})
function window(pathname = '/about:blank', title = '') {
  const win = { location: { pathname }, document: { title } }
  win.document.defaultView = win
  return win
}

test('uses the actual rendered Steam host when legacy findSP cannot find root_1_', () => {
  const current = window()
  const host = window('/routes/library/home', 'SP')
  assert.equal(
    findSteamHomeWindow(current, host, undefined, () => undefined).doc,
    host.document
  )
})

test('discovers modern GamepadUI_Full_Root ownerDocument through the nav tree', () => {
  const current = window()
  const steam = window('/routes/library/home', 'SP')
  current.FocusNavController = {
    m_ActiveContext: {
      m_rgGamepadNavigationTrees: [
        {
          m_ID: 'GamepadUI_Full_Root',
          m_Root: { m_element: { ownerDocument: steam.document } }
        }
      ]
    }
  }
  assert.equal(findSteamHomeWindow(current).doc, steam.document)
})

test('finds the real main window in the shared SteamUIStore', () => {
  const current = window()
  const steam = window('/library/home')
  current.SteamUIStore = {
    WindowStore: { GamepadUIMainWindowInstance: { BrowserWindow: steam } }
  }
  assert.equal(findSteamHomeWindow(current).doc, steam.document)
})

test('keeps non-Home main routes authoritative over a stale Home window', () => {
  const current = window()
  const stale = window('/library/home')
  const main = window('/library/app/570')
  assert.equal(findSteamHomeWindow(current, stale, main).doc, main.document)
})

test('a failing legacy window lookup cannot crash the preview runtime', () => {
  const current = window()
  const host = window('/library/home')
  assert.equal(
    findSteamHomeWindow(current, host, undefined, () => {
      throw new Error('old API')
    }).doc,
    host.document
  )
})
