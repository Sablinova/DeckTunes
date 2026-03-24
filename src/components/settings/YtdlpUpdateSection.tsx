import { ButtonItem, Field, PanelSection, PanelSectionRow } from '@decky/ui'
import { call, toaster } from '@decky/api'
import { useState, useEffect } from 'react'
import { FaSync, FaDownload, FaCheck } from 'react-icons/fa'

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
  const [checking, setChecking] = useState(true) // Start true for initial load
  const [updating, setUpdating] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{
    current_version?: string
    latest_version?: string
    update_available?: boolean
  } | null>(null)

  // Check for updates on component mount
  useEffect(() => {
    checkForUpdates(true)
  }, [])

  async function checkForUpdates(silent = false) {
    setChecking(true)
    try {
      const result = await call<[], UpdateCheckResponse>('check_ytdlp_update')
      if (result.success) {
        setUpdateInfo(result)
        // Only show toasts for manual checks, not on load
        if (!silent) {
          if (result.update_available) {
            toaster.toast({
              title: 'yt-dlp Update Available',
              body: `Current: ${result.current_version} → Latest: ${result.latest_version}`,
              icon: <FaDownload />,
              duration: 3000
            })
          } else {
            toaster.toast({
              title: 'yt-dlp Up to Date',
              body: `Version ${result.current_version}`,
              icon: <FaCheck />,
              duration: 2000
            })
          }
        }
      } else if (!silent) {
        toaster.toast({
          title: 'Update Check Failed',
          body: result.error || 'Unknown error',
          icon: <FaSync />,
          duration: 3000
        })
      }
    } catch (e) {
      console.error('Update check error:', e)
      if (!silent) {
        toaster.toast({
          title: 'Update Check Failed',
          body: String(e),
          icon: <FaSync />,
          duration: 3000
        })
      }
    }
    setChecking(false)
  }

  async function performUpdate() {
    setUpdating(true)
    try {
      const result = await call<[], UpdatePerformResponse>('update_ytdlp')
      if (result.success) {
        toaster.toast({
          title: 'yt-dlp Updated Successfully',
          body: `${result.old_version || 'Old'} → ${result.new_version || result.version}`,
          icon: <FaCheck />,
          duration: 3000
        })
        // Refresh update info
        await checkForUpdates()
      } else {
        toaster.toast({
          title: 'Update Failed',
          body: result.error || 'Unknown error',
          icon: <FaSync />,
          duration: 4000
        })
      }
    } catch (e) {
      console.error('Update error:', e)
      toaster.toast({
        title: 'Update Failed',
        body: String(e),
        icon: <FaSync />,
        duration: 4000
      })
    }
    setUpdating(false)
  }

  return (
    <PanelSection title="yt-dlp">
      {checking && !updateInfo ? (
        <PanelSectionRow>
          <Field label="Checking for updates..." />
        </PanelSectionRow>
      ) : updateInfo ? (
        <>
          <PanelSectionRow>
            <Field
              label="Current Version"
              bottomSeparator="none"
            >
              {updateInfo.current_version || 'Unknown'}
            </Field>
          </PanelSectionRow>
          <PanelSectionRow>
            <Field
              label="Latest Version"
              bottomSeparator={updateInfo.update_available ? 'standard' : 'none'}
            >
              {updateInfo.latest_version || 'Unknown'}
            </Field>
          </PanelSectionRow>
          {updateInfo.update_available && (
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={performUpdate}
                disabled={updating || checking}
                bottomSeparator="none"
              >
                {updating ? 'Updating...' : 'Update yt-dlp'}
              </ButtonItem>
            </PanelSectionRow>
          )}
        </>
      ) : (
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => checkForUpdates(false)}
            disabled={checking}
            bottomSeparator="none"
          >
            Check for Updates
          </ButtonItem>
        </PanelSectionRow>
      )}
    </PanelSection>
  )
}
