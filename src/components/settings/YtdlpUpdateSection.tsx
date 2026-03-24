import { ButtonItem, PanelSection, PanelSectionRow } from '@decky/ui'
import { call, toaster } from '@decky/api'
import { useState } from 'react'
import { FaSync, FaDownload, FaCheck } from 'react-icons/fa'

export default function YtdlpUpdateSection() {
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{
    current_version?: string
    latest_version?: string
    update_available?: boolean
  } | null>(null)

  async function checkForUpdates() {
    setChecking(true)
    try {
      const result = await call<[], any>('check_ytdlp_update')
      if (result.success) {
        setUpdateInfo(result)
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
      } else {
        toaster.toast({
          title: 'Update Check Failed',
          body: result.error || 'Unknown error',
          icon: <FaSync />,
          duration: 3000
        })
      }
    } catch (e) {
      console.error('Update check error:', e)
      toaster.toast({
        title: 'Update Check Failed',
        body: String(e),
        icon: <FaSync />,
        duration: 3000
      })
    }
    setChecking(false)
  }

  async function performUpdate() {
    setUpdating(true)
    try {
      const result = await call<[], any>('update_ytdlp')
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
    <PanelSection title="yt-dlp Updates">
      <PanelSectionRow>
        <ButtonItem
          label={
            updateInfo
              ? `Current: ${updateInfo.current_version || 'Unknown'}`
              : 'Check for yt-dlp updates'
          }
          description={
            updateInfo && updateInfo.update_available
              ? `Update available: ${updateInfo.latest_version}`
              : updateInfo
                ? 'yt-dlp is up to date'
                : 'Manually check for the latest yt-dlp version'
          }
          layout="below"
          onClick={checkForUpdates}
          disabled={checking || updating}
        >
          {checking ? 'Checking...' : 'Check for Updates'}
        </ButtonItem>
      </PanelSectionRow>
      {updateInfo && updateInfo.update_available && (
        <PanelSectionRow>
          <ButtonItem
            label={`Update to ${updateInfo.latest_version}`}
            description="Download and install the latest version"
            layout="below"
            onClick={performUpdate}
            disabled={updating || checking}
            bottomSeparator="none"
          >
            {updating ? 'Updating...' : 'Update Now'}
          </ButtonItem>
        </PanelSectionRow>
      )}
    </PanelSection>
  )
}
