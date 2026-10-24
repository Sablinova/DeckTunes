/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  afterPatch,
  fakeRenderComponent,
  findInReactTree,
  findInTree,
  findModuleByExport,
  Export,
  MenuItem,
  Navigation,
  Patch
} from '@decky/ui'
import { FC } from 'react'
import useTranslations from '../hooks/useTranslations'

function ChangeMusicButton({ appId }: { appId: number }) {
  const t = useTranslations()
  return (
    <MenuItem
      key="game-theme-music-change-music"
      onSelected={() => {
        Navigation.Navigate(`/gamethememusic/${appId}`)
      }}
    >
      {t('changeThemeMusic')}...
    </MenuItem>
  )
}

// Safely add button before "Properties..." or append to menu
const spliceChangeMusic = (children: any, appid: number) => {
  if (!Array.isArray(children) || !appid) return

  // Prevent duplicate items
  const existingIdx = children.findIndex(
    (x: any) =>
      x?.key === 'game-theme-music-change-music' ||
      x?.props?.id === 'game-theme-music-change-music'
  )
  if (existingIdx !== -1) return

  const propertiesMenuItemIdx = children.findIndex((item) =>
    findInReactTree(
      item,
      (x) =>
        x?.key === 'properties' ||
        (x?.onSelected &&
          (x.onSelected.toString().includes('AppProperties') ||
            x.onSelected.toString().includes('properties')))
    )
  )

  const newButton = (
    <ChangeMusicButton key="game-theme-music-change-music" appId={appid} />
  )

  if (propertiesMenuItemIdx !== -1) {
    children.splice(propertiesMenuItemIdx, 0, newButton)
  } else {
    children.push(newButton)
  }
}

// Broad detection for game context menus (handles legacy, modern Steam Deck and desktop UI)
const isOpeningAppContextMenu = (items: any) => {
  if (!items) return false
  const list = Array.isArray(items) ? items : [items]
  if (!list.length) return false

  return !!findInReactTree(list, (x: any) => {
    if (!x) return false
    if (
      x.key === 'properties' ||
      x.key === 'uninstall' ||
      x.key === 'manage' ||
      x.key === 'game-theme-music-change-music'
    ) {
      return true
    }
    if (x.props?.overview?.appid || x?.app?.appid || x?.overview?.appid) {
      return true
    }
    const onSelectedStr =
      x?.props?.onSelected?.toString?.() || x?.onSelected?.toString?.() || ''
    return (
      onSelectedStr.includes('launchSource') ||
      onSelectedStr.includes('AppProperties') ||
      onSelectedStr.includes('LaunchApp') ||
      onSelectedStr.includes('properties') ||
      onSelectedStr.includes('bIsNonSteamApp') ||
      onSelectedStr.includes('Uninstall')
    )
  })
}

const handleItemDupes = (items: any) => {
  if (!Array.isArray(items)) return
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]?.key === 'game-theme-music-change-music') {
      items.splice(i, 1)
    }
  }
}

const extractAppId = (tree: any): number => {
  if (!tree) return 0
  if (tree._owner?.pendingProps?.overview?.appid) {
    return Number(tree._owner.pendingProps.overview.appid)
  }
  if (tree._owner?.memoizedProps?.overview?.appid) {
    return Number(tree._owner.memoizedProps.overview.appid)
  }
  const foundApp = findInTree(
    tree,
    (x) => x?.app?.appid || x?.overview?.appid,
    {
      walkable: ['props', 'children', '_owner', 'pendingProps', 'memoizedProps']
    }
  )
  if (foundApp?.app?.appid) return Number(foundApp.app.appid)
  if (foundApp?.overview?.appid) return Number(foundApp.overview.appid)
  return 0
}

const patchMenuItems = (menuItems: any[], appid: number) => {
  if (!Array.isArray(menuItems)) return
  let updatedAppid: number = appid

  const detected = extractAppId(menuItems)
  if (detected && detected !== appid) {
    updatedAppid = detected
  }

  spliceChangeMusic(menuItems, updatedAppid)
}

/**
 * Patches the game context menu.
 * @param LibraryContextMenu The game context menu.
 * @returns A patch to remove when the plugin dismounts.
 */
const contextMenuPatch = (LibraryContextMenu: any) => {
  const patches: {
    outer?: Patch
    inner?: Patch
    unpatch: () => void
  } = {
    unpatch: () => {}
  }

  if (!LibraryContextMenu || !LibraryContextMenu.prototype) {
    console.warn('[DeckTunes] LibraryContextMenu not found or invalid, skipping menu patch')
    return patches
  }

  try {
    patches.outer = afterPatch(
      LibraryContextMenu.prototype,
      'render',
      (_: Record<string, unknown>[], component: any) => {
        let appid: number = extractAppId(component)

        if (appid === 0) {
          const running = (window as any).Router?.MainRunningApp?.appid
          if (running) {
            appid = Number(running)
          }
        }

        if (appid === 0) {
          return component
        }

        if (!patches.inner) {
          patches.inner = afterPatch(component, 'type', (_: any, ret: any) => {
            if (!ret?.type?.prototype) return ret

            // initial render
            afterPatch(ret.type.prototype, 'render', (_: any, ret2: any) => {
              if (!ret2?.props) return ret2
              const children = ret2.props.children
              const menuItems = Array.isArray(children?.[0])
                ? children[0]
                : Array.isArray(children)
                  ? children
                  : null

              if (!menuItems || !isOpeningAppContextMenu(menuItems)) return ret2
              try {
                handleItemDupes(menuItems)
              } catch {
                return ret2
              }
              patchMenuItems(menuItems, appid)
              return ret2
            })

            // when steam decides to refresh app overview
            afterPatch(
              ret.type.prototype,
              'shouldComponentUpdate',
              ([nextProps]: any, shouldUpdate: any) => {
                if (!nextProps) return shouldUpdate
                const children = nextProps.children
                const menuItems = Array.isArray(children?.[0])
                  ? children[0]
                  : Array.isArray(children)
                    ? children
                    : null

                if (!menuItems || !isOpeningAppContextMenu(menuItems)) {
                  return shouldUpdate
                }

                try {
                  handleItemDupes(menuItems)
                } catch {
                  return shouldUpdate
                }

                if (shouldUpdate === true) {
                  patchMenuItems(menuItems, appid)
                }

                return shouldUpdate
              }
            )
            return ret
          })
        } else {
          const children = component?.props?.children
          const menuItems = Array.isArray(children?.[0])
            ? children[0]
            : Array.isArray(children)
              ? children
              : null
          if (menuItems && isOpeningAppContextMenu(menuItems)) {
            handleItemDupes(menuItems)
            spliceChangeMusic(menuItems, appid)
          }
        }

        return component
      }
    )
  } catch (err) {
    console.error('[DeckTunes] Error patching LibraryContextMenu:', err)
  }

  patches.unpatch = () => {
    patches.outer?.unpatch()
    patches.inner?.unpatch()
  }
  return patches
}

/**
 * Safely resolves the game context menu component.
 */
export const getLibraryContextMenu = () => {
  try {
    const mod = findModuleByExport((e: Export) =>
      Boolean(e?.toString && e.toString().includes('().LibraryContextMenu'))
    )
    if (mod && typeof mod === 'object') {
      const sibling = Object.values(mod).find((val) =>
        Boolean(
          (val as FC)?.toString && (val as FC).toString().includes('navigator:')
        )
      )
      if (sibling) {
        return fakeRenderComponent(sibling as FC)?.type ?? null
      }
    }
  } catch (error) {
    console.warn('[DeckTunes] Error finding LibraryContextMenu export:', error)
  }
  return null
}

export const LibraryContextMenu = getLibraryContextMenu()

export default contextMenuPatch
