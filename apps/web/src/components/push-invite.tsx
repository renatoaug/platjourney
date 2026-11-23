/** The invitation to receive Nexo's notices on this device, where a player meets them: a card on
 * Home and a line at the top of the bell's list. The system's permission dialog only comes after the
 * tap on "Turn on", as Apple and the browsers ask. Blocked earlier, the system will not ask again,
 * so the line explains where to allow it instead. The card hides once dismissed (remembered on this
 * device); the bell's line stays until notices are on. Nothing shows while push is on, unsupported
 * here, or the player is in the demo. */
import { useEffect, useState } from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { isNativePush, nativePlatform, nativePushAvailable } from '../lib/native-push'
import { enablePush, type PushState, pushState, reportPushInvite } from '../lib/push'
import { Icon } from '../ui/icon'
import { toast } from '../ui/toast'
import { usePushAsking } from './push-ask'
import './push-invite.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Quer que o Nexo te avise de cada troféu?',
    body: 'O troféu que acabou de cair, o próximo passo e a hora de jogar, direto neste aparelho.',
    row: 'Receba estes avisos neste aparelho',
    enable: 'Ativar',
    dismiss: 'Dispensar',
    blocked: 'As notificações estão bloqueadas neste aparelho',
    blockedIos: 'Para liberar: Ajustes do iPhone → PlatJourney → Notificações.',
    blockedAndroid: 'Para liberar: Configurações do Android → Apps → PlatJourney → Notificações.',
    blockedWeb: 'Para liberar: nas permissões deste site, no navegador, permita notificações.',
    on: 'Pronto: os avisos do Nexo chegam neste aparelho.',
    notAllowed: 'As notificações não foram permitidas.',
    failed: 'Não deu para ativar agora. Tente de novo.',
  },
  [Language.En]: {
    title: 'Want Nexo to tell you about every trophy?',
    body: 'The trophy that just popped, the next step and when to play, right on this device.',
    row: 'Get these notices on this device',
    enable: 'Turn on',
    dismiss: 'Dismiss',
    blocked: 'Notifications are blocked on this device',
    blockedIos: 'To allow them: iPhone Settings → PlatJourney → Notifications.',
    blockedAndroid: 'To allow them: Android Settings → Apps → PlatJourney → Notifications.',
    blockedWeb: "To allow them: in this site's permissions in the browser, allow notifications.",
    on: "Done: Nexo's notices arrive on this device.",
    notAllowed: 'Notifications were not allowed.',
    failed: 'Could not turn them on now. Try again.',
  },
})

const DISMISSED = 'pj.push-invite.done'

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === '1'
  } catch {
    return false
  }
}

/** Where push stands on this device, and the tap that turns it on. */
function usePush(variant: 'card' | 'row') {
  const { me } = useApp()
  const t = useMessages(messages)
  const available = !me.demo && (isNativePush() ? nativePushAvailable(me) : !!me.pushKey)
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!available) return
    let live = true
    pushState()
      .then((s) => live && setState(s))
      .catch(() => live && setState('unsupported'))
    return () => {
      live = false
    }
  }, [available])
  const enable = async () => {
    setBusy(true)
    try {
      const next = await enablePush(me.pushKey ?? '')
      reportPushInvite(variant, next)
      setState(next)
      toast(next === 'on' ? t('on') : t('notAllowed'), next === 'on' ? 'success' : 'info')
    } catch {
      reportPushInvite(variant, 'failed')
      toast(t('failed'))
    }
    setBusy(false)
  }
  return { state: available ? state : 'unsupported', busy, enable }
}

export function PushInvite({ variant }: { variant: 'card' | 'row' }) {
  const { state, busy, enable } = usePush(variant)
  const [hidden, setHidden] = useState(dismissed)
  // The notices bar is asking the same thing right now: one question at a time.
  const asking = usePushAsking()
  if (state !== 'off' && state !== 'denied') return null
  if (variant === 'card' && (hidden || asking || state === 'denied')) return null
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {}
    reportPushInvite('card', 'later')
    setHidden(true)
  }
  return (
    <PushInviteView
      variant={variant}
      blocked={state === 'denied'}
      device={nativePlatform() ?? 'web'}
      busy={busy}
      onEnable={enable}
      onDismiss={dismiss}
    />
  )
}

export function PushInviteView({
  variant,
  blocked = false,
  device = 'web',
  busy = false,
  onEnable,
  onDismiss,
}: {
  variant: 'card' | 'row'
  blocked?: boolean
  /** Where the notices would arrive, for where to allow them once blocked. */
  device?: 'ios' | 'android' | 'web'
  busy?: boolean
  onEnable: () => void
  onDismiss?: () => void
}) {
  const t = useMessages(messages)
  if (variant === 'row')
    return (
      <div className={`push-invite-row${blocked ? ' is-blocked' : ''}`}>
        <Icon name="bell" />
        <span>
          <b>{blocked ? t('blocked') : t('row')}</b>
          {blocked && (
            <small>
              {t(
                device === 'ios'
                  ? 'blockedIos'
                  : device === 'android'
                    ? 'blockedAndroid'
                    : 'blockedWeb',
              )}
            </small>
          )}
        </span>
        {!blocked && (
          <button type="button" className="button sm" disabled={busy} onClick={onEnable}>
            {t('enable')}
          </button>
        )}
      </div>
    )
  return (
    <section className="card push-invite" aria-labelledby="push-invite-title">
      <span className="push-invite-icon" aria-hidden="true">
        <Icon name="bell" />
      </span>
      <div className="push-invite-copy">
        <h2 id="push-invite-title">{t('title')}</h2>
        <p>{t('body')}</p>
      </div>
      <button type="button" className="button sm" disabled={busy} onClick={onEnable}>
        {t('enable')}
      </button>
      {onDismiss && (
        <button
          type="button"
          className="ghost sm push-invite-close"
          aria-label={t('dismiss')}
          onClick={onDismiss}
        >
          <Icon name="close" />
        </button>
      )}
    </section>
  )
}
