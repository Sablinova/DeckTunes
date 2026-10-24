import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs, moduleUrl } from './loadTs.mjs'

const { default: patchContextMenu, getLibraryContextMenu } = await loadTs(
  '../src/lib/patchContextMenu.tsx',
  {
    '@decky/ui': moduleUrl(`
      export const afterPatch = (obj, method, fn) => ({ unpatch: () => {} })
      export const fakeRenderComponent = (comp) => ({ type: { prototype: { render: () => {} } } })
      export const findInReactTree = (tree, fn) => {
        if (!tree) return null
        if (fn(tree)) return tree
        const children = Array.isArray(tree) ? tree : [tree]
        for (const child of children) {
          if (!child) continue
          if (fn(child)) return child
          if (child.props?.children) {
            const found = findInReactTree(child.props.children, fn)
            if (found) return found
          }
          if (Array.isArray(child)) {
            const found = findInReactTree(child, fn)
            if (found) return found
          }
        }
        return null
      }
      export const findInTree = (tree, fn, opts) => {
        if (!tree) return null
        if (fn(tree)) return tree
        const children = tree?.props?.children || tree
        if (Array.isArray(children)) {
          for (const c of children) {
            if (fn(c)) return c
          }
        }
        return null
      }
      export const findModuleByExport = () => null
      export const MenuItem = () => null
      export const Navigation = { Navigate: () => {} }
    `),
    '../hooks/useTranslations': moduleUrl(`
      export default () => (key) => key
    `)
  }
)

test('getLibraryContextMenu returns null gracefully when exports are unavailable', () => {
  const result = getLibraryContextMenu()
  assert.equal(result, null)
})

test('contextMenuPatch handles null or invalid LibraryContextMenu without throwing', () => {
  const patch = patchContextMenu(null)
  assert.equal(typeof patch.unpatch, 'function')
  assert.doesNotThrow(() => patch.unpatch())
})
