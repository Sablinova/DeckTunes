import {
  ButtonItem,
  ConfirmModal,
  DropdownItem,
  Menu,
  MenuItem,
  PanelSection,
  PanelSectionRow,
  ProgressBarWithInfo,
  showContextMenu,
  showModal,
  ShowModalResult,
  SingleDropdownOption,
  SliderField,
  ToggleField
} from '@decky/ui'
import { useMemo, useState } from 'react'
import { SiDiscord, SiGithub } from 'react-icons/si'
import { useSettings } from '../../hooks/useSettings'
import useTranslations from '../../hooks/useTranslations'
import {
  FaDownload,
  FaUndo,
  FaSave,
  FaVolumeUp,
  FaYoutube
} from 'react-icons/fa'
import {
  clearCache,
  clearDownloads,
  exportCache,
  getFullCache,
  importCache,
  listCacheBackups
} from '../../cache/musicCache'
import useInvidiousInstances from '../../hooks/useInvidiousInstances'
import { toaster } from '@decky/api'
import { getResolver } from '../../actions/audio'
import PanelSocialButton from './socialButton'
import YtdlpUpdateSection from './YtdlpUpdateSection'
import { useHomePreviewDiagnostics } from '../../lib/homePreviewDiagnostics'

export default function Index() {
  const {
    settings,
    isLoading: settingsIsLoading,
    setDefaultMuted,
    setUseYtDlp,
    setDownloadAudio,
    setInvidiousInstance,
    setVolume,
    setHomeScreenMusicPreview
  } = useSettings()

  const t = useTranslations()
  const homeDiagnostics = useHomePreviewDiagnostics()
  const [toolsOpen, setToolsOpen] = useState(false)

  const { instances, instancesLoading } = useInvidiousInstances()

  const instanceOptions = useMemo<SingleDropdownOption[]>(
    () =>
      instances.map((ins) => ({
        data: ins.url,
        label: ins.name
      })),
    [instances]
  )

  const confirmClearCache = () => {
    showModal(
      <ConfirmModal
        strTitle={t('deleteOverridesConfirm')}
        strDescription={t('deleteOverridesDescription')}
        onOK={() => clearCache()}
      />
    )
  }

  const confirmClearDownloads = () => {
    showModal(
      <ConfirmModal
        strTitle={t('deleteDownloadsConfirm')}
        onOK={clearDownloads}
      />
    )
  }

  const confirmRestoreDownloads = async () => {
    const num = Object.values(await getFullCache()).filter(
      (entry) => entry.videoId
    ).length
    const modal = showModal(
      <ConfirmModal
        strTitle={t('restoreDownloadsConfirm')}
        strDescription={t('restoreDownloadsConfirmDescription', {
          num: num.toString()
        })}
        onOK={() => restoreDownloads(modal)}
      />
    )
  }

  function restoreCache(backup: string) {
    showModal(
      <ConfirmModal
        strTitle={t('restoreOverridesConfirm')}
        strDescription={t('restoreOverridesConfirmDetails')}
        onOK={async () => {
          await importCache(backup)
          toaster.toast({
            title: t('restoreSuccessful'),
            body: t('restoreSuccessfulDetails'),
            icon: <FaUndo />,
            duration: 1500
          })
        }}
      />
    )
  }

  async function restoreDownloads(modal: ShowModalResult) {
    function getProgressModal(index: number, total: number) {
      const current = index + 1
      const progress = (current * 100) / total
      return (
        <ConfirmModal
          bHideCloseIcon={true}
          bOKDisabled={true}
          onCancel={modal.Close}
          strCancelButtonText={t('close')}
          strTitle={
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%'
              }}
            >
              {t('restoreDownloadsOperationTitle')}
              <div style={{ marginLeft: 'auto' }}>
                <ProgressBarWithInfo
                  nProgress={progress}
                  sOperationText={t('restoreDownloadsOperation', {
                    current: current.toString(),
                    total: total.toString()
                  })}
                />
              </div>
            </div>
          }
        ></ConfirmModal>
      )
    }

    const cached = Object.values(await getFullCache()).filter(
      (entry) => entry.videoId
    )
    const resolver = getResolver(settings.useYtDlp)

    for (let index = 0; index < cached.length; index++) {
      const element = cached[index]
      if (element.videoId !== undefined) {
        modal.Update(getProgressModal(index, cached.length))
        await resolver.downloadAudio({ id: element.videoId })
      }
    }
    modal.Close()
    toaster.toast({
      title: t('downloadRestoreSuccessful'),
      body: t('downloadRestoreSuccessfulDetails'),
      icon: <FaDownload />,
      duration: 1500
    })
  }

  return (
    <div>
      <PanelSection title={t('playbackSection')}>
        <PanelSectionRow>
          <SliderField
            label={t('volume')}
            value={settings.volume * 100}
            onChange={(value: number) => setVolume(value / 100)}
            disabled={settingsIsLoading}
            min={0}
            max={100}
            step={1}
            icon={<FaVolumeUp />}
            editableValue
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            checked={settings.defaultMuted}
            disabled={settingsIsLoading}
            label={t('defaultMuted')}
            description={t('defaultMutedDescription')}
            onChange={setDefaultMuted}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            checked={settings.homeScreenMusicPreview}
            disabled={settingsIsLoading}
            label={t('homeScreenMusicPreview')}
            description={t('homeScreenMusicPreviewDescription')}
            onChange={setHomeScreenMusicPreview}
            bottomSeparator="none"
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title={t('musicSourceSection')}>
        <PanelSectionRow>
          <ToggleField
            icon={<FaYoutube />}
            checked={settings.useYtDlp}
            disabled={settingsIsLoading}
            label={t('useYtDlp')}
            description={t('useYtDlpDescription')}
            onChange={setUseYtDlp}
          />
        </PanelSectionRow>
        {!settings.useYtDlp && (
          <PanelSectionRow>
            <DropdownItem
              disabled={
                instancesLoading || !instanceOptions.length || settingsIsLoading
              }
              label={t('invidiousInstance')}
              description={t('invidiousInstanceDescription')}
              menuLabel={t('invidiousInstance')}
              rgOptions={instanceOptions}
              selectedOption={settings.invidiousInstance}
              onChange={(option) => setInvidiousInstance(option.data)}
            />
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ToggleField
            checked={settings.downloadAudio}
            disabled={settingsIsLoading || !settings.useYtDlp}
            label={t('downloadAudio')}
            description={
              settings.useYtDlp
                ? t('downloadAudioDescription')
                : t('downloadsRequireYtdlp')
            }
            onChange={setDownloadAudio}
            bottomSeparator="none"
          />
        </PanelSectionRow>
      </PanelSection>

      {settings.useYtDlp && <YtdlpUpdateSection />}

      <PanelSection title={t('toolsSection')}>
        <PanelSectionRow>
          <ButtonItem
            description={t('toolsDescription')}
            layout="below"
            bottomSeparator="none"
            onClick={() => setToolsOpen((open) => !open)}
          >
            {toolsOpen ? t('hideTools') : t('showTools')}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {toolsOpen && (
        <>
          <PanelSection title={t('savedThemesSection')}>
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={async () => {
                  await exportCache()
                  toaster.toast({
                    title: t('backupSuccessful'),
                    body: t('backupSuccessfulDetails'),
                    icon: <FaSave />,
                    duration: 1500
                  })
                }}
              >
                {t('backupOverrides')}
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={async () => {
                  const backups = await listCacheBackups()
                  if (!backups.length) {
                    toaster.toast({
                      title: t('restoreOverridesLabel'),
                      body: t('noBackupsFound'),
                      duration: 2500
                    })
                    return
                  }
                  showContextMenu(
                    <Menu label={t('restoreOverridesLabel')}>
                      {backups.map((backup) => (
                        <MenuItem
                          onClick={() => restoreCache(backup)}
                          key={backup}
                        >
                          {backup}
                        </MenuItem>
                      ))}
                    </Menu>
                  )
                }}
              >
                {t('restoreOverridesLabel')}
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                description={t('deleteOverridesDescription')}
                bottomSeparator="none"
                onClick={confirmClearCache}
              >
                {t('deleteOverrides')}
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>
          <PanelSection title={t('downloadsSection')}>
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                description={t('restoreDownloadsDescription')}
                disabled={!settings.useYtDlp}
                onClick={confirmRestoreDownloads}
              >
                {t('restoreDownloadsLabel')}
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                description={t('deleteDownloadsDescription')}
                bottomSeparator="none"
                onClick={confirmClearDownloads}
              >
                {t('deleteDownloads')}
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>
          {settings.homeScreenMusicPreview && (
            <PanelSection title={t('diagnosticsSection')}>
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  bottomSeparator="none"
                  onClick={() =>
                    showModal(
                      <ConfirmModal
                        bAlertDialog
                        strTitle={t('homePreviewDiagnostics')}
                        strDescription={
                          <pre
                            style={{
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere',
                              maxHeight: '45vh',
                              overflowY: 'auto',
                              fontSize: '13px'
                            }}
                          >
                            {JSON.stringify(homeDiagnostics, null, 2)}
                          </pre>
                        }
                        strOKButtonText={t('close')}
                      />
                    )
                  }
                >
                  {t('homePreviewDiagnostics')}
                </ButtonItem>
              </PanelSectionRow>
            </PanelSection>
          )}
          <PanelSection title={t('supportSection')}>
            <PanelSocialButton
              icon={<SiDiscord fill="#5865F2" />}
              url="https://deckbrew.xyz/discord"
            >
              Discord
            </PanelSocialButton>
            <PanelSocialButton
              icon={<SiGithub fill="#f5f5f5" />}
              url="https://github.com/Sablinova/DeckTunes"
            >
              GitHub
            </PanelSocialButton>
          </PanelSection>
        </>
      )}
    </div>
  )
}
