import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './loadTs.mjs'

const { getFocusedHomeAppId } = await loadTs('../src/lib/homeFocus.ts')

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
    getFocusedHomeAppId(document([{ closest: () => parent }])),
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
  doc.querySelectorAll = () => [{ closest: () => null }]
  assert.equal(getFocusedHomeAppId(doc), null)
})
