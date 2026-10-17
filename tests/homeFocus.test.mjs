import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './loadTs.mjs'

const { getFocusedHomeAppId, inspectHomeFocus } = await loadTs(
  '../src/lib/homeFocus.ts'
)

function focusedNode(values = {}) {
  return { closest: () => null, getClientRects: () => [{}], ...values }
}

function card(id, visible = true) {
  return {
    closest(selector) {
      assert.equal(selector, '[data-appid]')
      return this
    },
    getAttribute(name) {
      assert.equal(name, 'data-appid')
      return id
    },
    getClientRects() {
      return visible ? [{}] : []
    }
  }
}
function document(focused, pathname = '/library/home') {
  return {
    hidden: false,
    defaultView: { location: { pathname }, getComputedStyle: () => ({}) },
    activeElement: null,
    querySelectorAll(selector) {
      assert.equal(selector, '.gpfocus')
      return focused
    }
  }
}

test('reads Steam gamepad focus with no DOM focus event', () => {
  assert.equal(getFocusedHomeAppId(document([card('570')])), 570)
})

test('handles hash-based Home routing without accepting detail-page hashes', () => {
  const doc = document([card('570')], '/index.html')
  doc.defaultView.location.hash = '#/library/home?tab=recent'
  assert.equal(getFocusedHomeAppId(doc), 570)
  doc.defaultView.location.hash = '#/library/app/570'
  assert.equal(getFocusedHomeAppId(doc), null)
})

test('reads focus on a child of a card, including non-Steam uint32 IDs', () => {
  const parent = card('4000000000')
  assert.equal(
    getFocusedHomeAppId(document([focusedNode({ closest: () => parent })])),
    4000000000
  )
})

test('rejects stale home cards on details, library, store and hidden documents', () => {
  for (const path of [
    '/library/app/570',
    '/library',
    '/store',
    '/library/home/other'
  ]) {
    assert.equal(getFocusedHomeAppId(document([card('570')], path)), null)
  }
  const doc = document([card('570')])
  doc.hidden = true
  assert.equal(getFocusedHomeAppId(doc), null)
})

test('rejects invisible cards and malformed AppIDs', () => {
  assert.equal(getFocusedHomeAppId(document([card('570', false)])), null)
  for (const id of ['', '0', '-1', '12x', '1.5', '1e3', '4294967296']) {
    assert.equal(getFocusedHomeAppId(document([card(id)])), null)
  }
})

test('uses browser focus only when Steam gamepad focus is absent', () => {
  const doc = document([])
  doc.activeElement = card('570')
  assert.equal(getFocusedHomeAppId(doc), 570)
  doc.querySelectorAll = () => [focusedNode()]
  assert.equal(getFocusedHomeAppId(doc), null)
})

test('recognizes current Steam /routes/library/home paths and hash routes', () => {
  const doc = document([card('570')], '/routes/library/home')
  assert.equal(getFocusedHomeAppId(doc), 570)
  doc.defaultView.location.pathname = '/index.html'
  doc.defaultView.location.hash = '#/routes/library/home'
  assert.equal(getFocusedHomeAppId(doc), 570)
  doc.defaultView.location.hash = '#/routes/library/app/570'
  assert.equal(getFocusedHomeAppId(doc), null)
})

test('reads Steam navigation focus without gpfocus or DOM focus', () => {
  const focused = card('730')
  const doc = document([])
  doc.defaultView.FocusNavController = {
    m_ActiveContext: { m_lastFocusNode: { m_element: focused } }
  }
  const result = inspectHomeFocus(doc)
  assert.equal(result.appId, 730)
  assert.equal(result.focusSource, 'Steam navigation tree')
})

test('modern navigation trees work when the active context is initially empty', () => {
  const doc = document([])
  doc.defaultView.GamepadNavTree = {
    m_context: {
      m_controller: {
        m_ActiveContext: {},
        m_LastActiveContext: {
          m_rgGamepadNavigationTrees: [
            {
              m_ID: 'GamepadUI_Full_Root',
              m_lastFocusNode: { Element: card('570') }
            }
          ]
        }
      }
    }
  }
  assert.equal(getFocusedHomeAppId(doc), 570)
})

test('active QAM navigation suppresses stale remembered Home focus', () => {
  const doc = document([card('570')])
  doc.defaultView.FocusNavController = {
    m_ActiveContext: { m_lastFocusNode: { m_element: focusedNode() } },
    m_LastActiveContext: { m_lastFocusNode: { m_element: card('570') } }
  }
  assert.equal(getFocusedHomeAppId(doc), null)
})

test('native Steam cards expose their AppID through React overview fibers', () => {
  const focused = focusedNode({
    __reactFiber$test: {
      memoizedProps: { className: 'native-card' },
      return: { memoizedProps: { overview: { appid: '570' } } }
    }
  })
  const result = inspectHomeFocus(document([focused]))
  assert.equal(result.appId, 570)
  assert.equal(result.appIdSource, 'React overview')
})

test('native direct React props support high uint32 shortcut AppIDs', () => {
  const focused = focusedNode({ __reactProps$test: { appId: 4000000000 } })
  assert.equal(getFocusedHomeAppId(document([focused])), 4000000000)
})

test('React fallback never searches unrelated child or sibling game data', () => {
  const focused = focusedNode({
    __reactFiber$test: {
      memoizedProps: { children: [{ props: { appid: 570 } }] },
      sibling: { memoizedProps: { overview: { appid: 730 } } }
    }
  })
  assert.equal(getFocusedHomeAppId(document([focused])), null)
})

test('a single native capsule can identify the focused game without React props', () => {
  for (const src of [
    'https://steamloopback.host/assets/570/library_600x900.jpg',
    'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/570/library_600x900.jpg'
  ]) {
    const focused = focusedNode({
      querySelectorAll: () => [{ getAttribute: () => src }]
    })
    assert.equal(getFocusedHomeAppId(document([focused])), 570)
  }
  const multiple = focusedNode({ querySelectorAll: () => [{}, {}] })
  assert.equal(getFocusedHomeAppId(document([multiple])), null)
})

test('bounded React fiber inspection handles cyclic/private fibers safely', () => {
  const fiber = { memoizedProps: {} }
  fiber.return = fiber
  const focused = focusedNode({ __reactFiber$test: fiber })
  assert.equal(getFocusedHomeAppId(document([focused])), null)
})

test('an invisible remembered navigation node cannot hide current gamepad card focus', () => {
  const doc = document([card('730')])
  doc.defaultView.FocusNavController = {
    m_ActiveContext: { m_lastFocusNode: { m_element: card('570', false) } }
  }
  const result = inspectHomeFocus(doc)
  assert.equal(result.appId, 730)
  assert.equal(result.focusSource, 'gpfocus')
  assert.match(result.ignoredNavigationNodes[0], /Hidden or empty-layout/)
})

test('a disconnected context focus falls through to a live tree node', () => {
  const doc = document([])
  doc.defaultView.FocusNavController = {
    m_ActiveContext: {
      m_lastFocusNode: { m_element: { ...card('570'), isConnected: false } },
      m_rgGamepadNavigationTrees: [
        { m_lastFocusNode: { m_Element: card('730') } }
      ]
    }
  }
  assert.equal(getFocusedHomeAppId(doc), 730)
})

test('current ActiveElementNavNode takes priority over the remembered node', () => {
  const doc = document([])
  doc.defaultView.FocusNavController = {
    m_ActiveContext: {
      m_lastFocusNode: { m_element: card('570') },
      ActiveElementNavNode: { m_element: card('730') }
    }
  }
  assert.equal(getFocusedHomeAppId(doc), 730)
})

test('foreign navigation-document failures report the exact reason and owner route', () => {
  const doc = document([])
  const other = document([], '/quickaccess')
  const focused = { ...card('570'), ownerDocument: other }
  doc.defaultView.FocusNavController = {
    m_ActiveContext: { m_lastFocusNode: { m_element: focused } }
  }
  const result = inspectHomeFocus(doc)
  assert.equal(result.appId, null)
  assert.match(result.reason, /different Steam document/)
  assert.equal(result.focusDocumentRoute, '/quickaccess')
})

test('live navigation focus remains usable during a Home document handoff before the next poll', () => {
  const stale = document([])
  const live = document([])
  const focused = { ...card('730'), ownerDocument: live }
  stale.defaultView.FocusNavController = {
    m_ActiveContext: { m_lastFocusNode: { m_element: focused } }
  }
  assert.equal(getFocusedHomeAppId(stale), 730)
})
