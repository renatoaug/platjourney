/** The read-only demo: the banner every screen shows while in it, the note beside what it cannot do, and leaving it to connect an account. */
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { Icon } from '../ui/icon'
import './demo.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'DEMONSTRAÇÃO',
    lead: 'Você está vendo o PlatJourney com um perfil de exemplo. Explore à vontade: nada aqui é salvo.',
    connect: 'Conectar minha conta',
    unavailable: 'Indisponível na demonstração. Conecte sua conta da PSN para usar.',
    locked: 'Travado na demonstração.',
  },
  [Language.En]: {
    eyebrow: 'DEMO',
    lead: 'You are looking at PlatJourney with a sample player. Explore freely: nothing here is saved.',
    connect: 'Connect my account',
    unavailable: 'Not available in the demo. Connect your PSN account to use it.',
    locked: 'Locked in the demo.',
  },
})

/** True while the signed-in player is the shared demo one. */
export const useDemo = (): boolean => useApp().me.demo === true

/** Leaves the demo for the sign-in screen. */
export async function connectAccount(): Promise<void> {
  await api('/api/auth/logout', {}).catch(() => {})
  document.dispatchEvent(new Event('api:unauthorized'))
}

/** Shown above every screen while in the demo. */
export function DemoBanner({ onConnect = connectAccount }: { onConnect?: () => void }) {
  const t = useMessages(messages)
  return (
    <aside className="demo-banner" id="demo-banner" aria-label={t('eyebrow')}>
      <span className="demo-banner-icon">
        <Icon name="play" />
      </span>
      <p>
        <span className="eyebrow">{t('eyebrow')}</span>
        <span>{t('lead')}</span>
      </p>
      <DemoConnectButton onConnect={onConnect} id="demo-connect" />
    </aside>
  )
}

/** Signs out of the demo and goes to the sign-in screen. */
export function DemoConnectButton({
  onConnect = connectAccount,
  id,
}: {
  onConnect?: () => void
  id?: string
}) {
  const t = useMessages(messages)
  return (
    <button type="button" className="sm" id={id} onClick={() => onConnect()}>
      {t('connect')}
    </button>
  )
}

/** The note under a setting the demo cannot change (`on` is whether this is the demo), so each
 * locked setting says so itself instead of one line after a group of them. */
export function useDemoLock(on: boolean | undefined): string | null {
  const t = useMessages(messages)
  return on ? t('locked') : null
}

/** Beside an action the demo cannot take. */
export function DemoNote({ className = '' }: { className?: string }) {
  const t = useMessages(messages)
  return <p className={`demo-note ${className}`.trim()}>{t('unavailable')}</p>
}
