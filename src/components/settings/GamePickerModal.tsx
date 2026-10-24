import {
  DialogButton,
  DialogHeader,
  Focusable,
  ModalRoot,
  Navigation,
  TextField
} from '@decky/ui'
import { FC, useMemo, useState } from 'react'
import useTranslations from '../../hooks/useTranslations'

type GameApp = {
  appid: number
  display_name: string
}

type GamePickerModalProps = {
  closeModal?: () => void
}

export const GamePickerModal: FC<GamePickerModalProps> = ({ closeModal }) => {
  const t = useTranslations()
  const [filter, setFilter] = useState('')

  const allApps: GameApp[] = useMemo(() => {
    try {
      const store = (window as any).appStore
      const list: any[] = store?.allApps || []
      return list
        .filter((a) => a && a.appid && a.display_name)
        .map((a) => ({
          appid: Number(a.appid),
          display_name: String(a.display_name).replace(/(™|®|©)/g, '')
        }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name))
    } catch {
      return []
    }
  }, [])

  const filteredApps = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return allApps.slice(0, 30)
    return allApps.filter((a) => a.display_name.toLowerCase().includes(q)).slice(0, 30)
  }, [allApps, filter])

  const handleSelect = (appid: number) => {
    closeModal?.()
    Navigation.Navigate(`/gamethememusic/${appid}`)
  }

  return (
    <ModalRoot onCancel={closeModal}>
      <DialogHeader>{t('chooseGame') || 'Choose Game'}</DialogHeader>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <TextField
          label={t('searchGames') || 'Search games...'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          bShowClearAction
        />
        <div
          style={{
            maxHeight: '50vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          {filteredApps.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', opacity: 0.6 }}>
              {t('noGamesFound') || 'No games found.'}
            </div>
          ) : (
            filteredApps.map((app) => (
              <Focusable
                key={app.appid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px'
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '320px'
                  }}
                >
                  {app.display_name}
                </span>
                <DialogButton
                  style={{ minWidth: '80px', height: '32px', padding: '0 12px' }}
                  onClick={() => handleSelect(app.appid)}
                >
                  {t('select') || 'Select'}
                </DialogButton>
              </Focusable>
            ))
          )}
        </div>
      </div>
    </ModalRoot>
  )
}

export default GamePickerModal
