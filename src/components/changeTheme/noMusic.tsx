import { DialogButton, Focusable } from '@decky/ui'
import { useState } from 'react'
import useTranslations from '../../hooks/useTranslations'
import { FaCheck, FaVolumeMute } from 'react-icons/fa'

export default function NoMusic({
  selected,
  selectNewAudio
}: {
  selected: boolean
  selectNewAudio: (audio: {
    title: string
    videoId: string
    audioUrl: string
  }) => Promise<void>
}) {
  const t = useTranslations()
  const [applying, setApplying] = useState(false)
  async function apply() {
    setApplying(true)
    try {
      await selectNewAudio({ title: '', videoId: '', audioUrl: '' })
    } finally {
      setApplying(false)
    }
  }
  return (
    <Focusable
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '14px 16px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <FaVolumeMute style={{ color: '#aab5c2', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: '14px', fontWeight: 500 }}>
          {t('noMusicLabel')}
        </strong>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#aab5c2' }}>
          {t('noMusicDescription')}
        </p>
      </div>
      <DialogButton
        disabled={selected || applying}
        onClick={apply}
        style={{ minWidth: '96px' }}
      >
        {selected ? (
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FaCheck />
            {t('selected')}
          </span>
        ) : applying ? (
          t('applyingTheme')
        ) : (
          t('applyTheme')
        )}
      </DialogButton>
    </Focusable>
  )
}
