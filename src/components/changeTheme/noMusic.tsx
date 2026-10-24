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
      flow-children="row"
      style={{
        display: 'grid',
        gridTemplateColumns: '20px minmax(0, 1fr) 144px',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: '14px 16px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <FaVolumeMute style={{ color: '#aab5c2', width: '18px' }} />
      <div style={{ minWidth: 0 }}>
        <strong
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: '20px'
          }}
        >
          {t('noMusicLabel')}
        </strong>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: '13px',
            lineHeight: '18px',
            color: '#aab5c2',
            whiteSpace: 'normal',
            wordBreak: 'normal'
          }}
        >
          {t('noMusicDescription')}
        </p>
      </div>
      <DialogButton
        disabled={selected || applying}
        onClick={apply}
        style={{
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '10px 12px',
          fontSize: '14px'
        }}
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
