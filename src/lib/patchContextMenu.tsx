/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  afterPatch,
  fakeRenderComponent,
  findInReactTree,
  findModuleChild,
  MenuItem,
  Navigation,
  Patch
} from '@decky/ui'
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

// Always add before "Properties..."
const spliceChangeMusic = (children: any[], appid: number) => {
  children.find((x: any) => x?.key === 'properties')
  const propertiesMenuItemIdx = children.findIndex((item) =>
    findInReactTree(
      item,
      (x) => x?.onSelected && x.onSelected.toString().includes('AppProperties')
    )
  )
  children.splice(
    propertiesMenuItemIdx,
    0,
    <ChangeMusicButton key="game-theme-music-change-music" appId={appid} />
  )
}

/**
 * Safely extract appid from a React component tree.
 * Uses findInReactTree to avoid hardcoded paths like _owner.pendingProps
 * which break when Valve updates the Steam UI structure.
 */
const extractAppId = (component: any): number | null => {
  // Try multiple methods to find the appid
  
  // Method 1: Look for appid in the component's props
  const fromProps = findInReactTree(component, (node: any) => {
    return node?.props?.overview?.appid || node?.overview?.appid
  })
  if (fromProps?.props?.overview?.appid) return fromProps.props.overview.appid
  if (fromProps?.overview?.appid) return fromProps.overview.appid
  
  // Method 2: Search for appid directly in the tree
  const withAppId = findInReactTree(component, (node: any) => {
    return typeof node?.appid === 'number'
  })
  if (withAppId?.appid) return withAppId.appid
  
  // Method 3: Look for overview object anywhere in the tree
  const withOverview = findInReactTree(component, (node: any) => {
    return node?.overview && typeof node.overview.appid === 'number'
  })
  if (withOverview?.overview?.appid) return withOverview.overview.appid
  
  // Method 4: Legacy fallback - try the old path but with safety checks
  try {
    if (component?._owner?.pendingProps?.overview?.appid) {
      return component._owner.pendingProps.overview.appid
    }
    if (component?._owner?.memoizedProps?.overview?.appid) {
      return component._owner.memoizedProps.overview.appid
    }
  } catch {
    // Ignore errors from legacy path
  }
  
  return null
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
    unpatch: () => {
      return null
    }
  }
  patches.outer = afterPatch(
    LibraryContextMenu.prototype,
    'render',
    (_: Record<string, unknown>[], component: any) => {
      const appid = extractAppId(component)
      
      // If we can't find an appid, don't crash - just skip adding the menu item
      if (appid === null) {
        console.warn('[DeckTunes] Could not extract appid from context menu component')
        return component
      }

      if (!patches.inner) {
        patches.inner = afterPatch(
          component.type.prototype,
          'shouldComponentUpdate',
          ([nextProps]: any, shouldUpdate: any) => {
            try {
              const gtmIdx = nextProps.children.findIndex(
                (x: any) => x?.key === 'game-theme-music-change-music'
              )
              if (gtmIdx != -1) nextProps.children.splice(gtmIdx, 1)
            } catch {
              return component
            }

            if (shouldUpdate === true) {
              let updatedAppid: number = appid
              
              // Try to find updated appid from children using safe extraction
              for (const child of nextProps.children || []) {
                const childAppId = extractAppId(child)
                if (childAppId !== null && childAppId !== appid) {
                  updatedAppid = childAppId
                  break
                }
              }
              
              spliceChangeMusic(nextProps.children, updatedAppid)
            }

            return shouldUpdate
          }
        )
      } else {
        spliceChangeMusic(component.props.children, appid)
      }

      return component
    }
  )
  patches.unpatch = () => {
    patches.outer?.unpatch()
    patches.inner?.unpatch()
  }
  return patches
}

/**
 * Game context menu component.
 */
export const LibraryContextMenu = fakeRenderComponent(
  findModuleChild((m) => {
    if (typeof m !== 'object') return
    for (const prop in m) {
      if (
        m[prop]?.toString() &&
        m[prop].toString().includes('().LibraryContextMenu')
      ) {
        return Object.values(m).find(
          (sibling) =>
            sibling?.toString().includes('createElement') &&
            sibling?.toString().includes('navigator:')
        )
      }
    }
    return
  })
).type

export default contextMenuPatch
