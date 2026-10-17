import { ButtonItem, Field, PanelSection, PanelSectionRow } from '@decky/ui'
import { call, toaster } from '@decky/api'
import { useState, useEffect } from 'react'
import { FaSync, FaDownload, FaCheck } from 'react-icons/fa'
import useTranslations from '../../hooks/useTranslations'

type UpdateCheckResponse = {
  success: boolean
  current_version?: string
  latest_version?: string
  update_available?: boolean
  error?: string
}

type UpdatePerformResponse = {
  success: boolean
  old_version?: string
  new_version?: string
  version?: string
  error?: string
}

export default function YtdlpUpdateSection() {
  const t = useTranslations()
  const [checking, setChecking] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null)

  useEffect(() => {
    void checkForUpdates(true)
  }, [])

  async function checkForUpdates(silent = false) {
    setChecking(true)
    setError('')
    try {
      const result = await call<[], UpdateCheckResponse>('check_ytdlp_update')
      if (!result.success) throw new Error(result.error || t('unknownError'))
      setUpdateInfo(result)
      if (!silent) {
        toaster.toast({
          title: result.update_available
            ? t('ytdlpUpdateAvailable')
            : t('ytdlpUpToDate'),
          body: result.update_available
            ? `${result.current_version} → ${result.latest_version}`
            : (result.current_version ?? ''),
          icon: result.update_available ? <FaDownload /> : <FaCheck />,
          duration: 2500
        })
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      if (!silent)
        toaster.toast({
          title: t('ytdlpCheckFailed'),
          body: message,
          icon: <FaSync />,
          duration: 3000
        })
    } finally {
      setChecking(false)
    }
  }

  async function performUpdate() {
    setUpdating(true)
    setError('')
    try {
      const result = await call<[], UpdatePerformResponse>('update_ytdlp')
      if (!result.success) throw new Error(result.error || t('unknownError'))
      toaster.toast({
        title: t('ytdlpUpdateSuccess'),
        body: result.new_version || result.version || '',
        icon: <FaCheck />,
        duration: 3000
      })
      await checkForUpdates(true)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      toaster.toast({
        title: t('ytdlpUpdateFailed'),
        body: message,
        icon: <FaSync />,
        duration: 4000
      })
    } finally {
      setUpdating(false)
    }
  }

  const status = error
    ? t('ytdlpCheckFailed')
    : checking
      ? t('ytdlpChecking')
      : updateInfo?.update_available
        ? t('ytdlpAvailableVersion', {
            version: updateInfo.latest_version ?? ''
          })
        : t('ytdlpUpToDate')

  return (
    <PanelSection title={t('updatesSection')}>
      <PanelSectionRow>
        <Field
          label={t('ytdlpVersion')}
          description={status}
          bottomSeparator="none"
        >
          <span
            style={{ fontVariantNumeric: 'tabular-nums', fontSize: '13px' }}
          >
            {updateInfo?.current_version || '—'}
          </span>
        </Field>
      </PanelSectionRow>
      {error && (
        <PanelSectionRow>
          <p
            role="alert"
            style={{
              margin: '0 0 8px',
              fontSize: '12px',
              overflowWrap: 'anywhere'
            }}
          >
            {error}
          </p>
        </PanelSectionRow>
      )}
      {updateInfo?.update_available && (
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={performUpdate}
            disabled={updating || checking}
          >
            {updating ? t('ytdlpUpdating') : t('ytdlpUpdate')}
          </ButtonItem>
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => checkForUpdates()}
          disabled={checking || updating}
          bottomSeparator="none"
        >
          {checking ? t('ytdlpChecking') : t('ytdlpCheck')}
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  )
}
