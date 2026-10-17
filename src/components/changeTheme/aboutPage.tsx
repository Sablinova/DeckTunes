import { PanelSection } from '@decky/ui'
import useTranslations from '../../hooks/useTranslations'
import PanelSocialButton from '../settings/socialButton'
import { SiDiscord, SiGithub } from 'react-icons/si'

export default function AboutPage() {
  const t = useTranslations()
  return (
    <div
      style={{
        padding: '0 24px 24px',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        maxWidth: '728px',
        margin: '0 auto'
      }}
    >
      <h1 style={{ margin: '0 0 12px' }}>{t('aboutLabel')}</h1>
      <p style={{ margin: '0 0 10px' }}>{t('aboutDescription')}</p>
      <p style={{ fontSize: '0.85em', opacity: 0.8, margin: '0 0 16px' }}>
        DeckTunes is a fork of SDH-GameThemeMusic by moraroy & OMGDuke.
      </p>
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
    </div>
  )
}
