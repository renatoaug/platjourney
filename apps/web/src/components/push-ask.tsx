/** In the native app, the first time a player uses it on a device: a screen asking to turn on Nexo's
 * notices, before the system's own dialog. iOS asks only once, so the app asks when the player has
 * just arrived and can see why. Shown once per device, after the introduction when there is one;
 * whatever the answer, the Home card and the bell's line stay as the way back. */
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { isNativePush, nativePushAvailable } from '../lib/native-push'
import { enablePush, pushState, reportPushInvite } from '../lib/push'
import { Icon } from '../ui/icon'
import { toast } from '../ui/toast'
import './onboarding.css'
import './push-ask.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'Avisos do Nexo',
    eyebrow: 'AVISOS NO CELULAR',
    title: 'O Nexo te avisa de cada troféu',
    body: 'Caiu um troféu, você recebe na hora o próximo passo da platina, sem precisar abrir o app.',
    perks: {
      trophy: 'O troféu que acabou de cair',
      next: 'O próximo troféu e como pegar',
      missable: 'Os perdíveis antes de passar deles',
    },
    off: 'Dá para desligar quando quiser em Ajustes.',
    enable: 'Ativar avisos',
    later: 'Agora não',
    on: 'Pronto: os avisos do Nexo chegam neste aparelho.',
    notAllowed: 'As notificações não foram permitidas.',
    failed: 'Não deu para ativar agora. Dá para tentar de novo pelo sino.',
  },
  [Language.En]: {
    label: "Nexo's notices",
    eyebrow: 'NOTICES ON YOUR PHONE',
    title: 'Nexo tells you about every trophy',
    body: "A trophy pops and the platinum's next step arrives right away, without opening the app.",
    perks: {
      trophy: 'The trophy that just popped',
      next: 'The next trophy and how to get it',
      missable: 'Missables before you pass them',
    },
    off: 'You can turn them off any time in Settings.',
    enable: 'Turn on notices',
    later: 'Not now',
    on: "Done: Nexo's notices arrive on this device.",
    notAllowed: 'Notifications were not allowed.',
    failed: 'Could not turn them on now. You can try again from the bell.',
  },
})

const SEEN = 'platjourney:push-ask-seen'

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN) === '1'
  } catch {
    return true
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN, '1')
  } catch {}
}

/** Mounted in the shell: decides whether this device still has to be asked. */
export function PushAsk() {
  const { me, data } = useApp()
  const t = useMessages(messages)
  // After the account's first data, so native push has its session, and after the introduction.
  const due =
    !!data &&
    !me.demo &&
    !me.visitor &&
    me.onboarded === true &&
    isNativePush() &&
    nativePushAvailable(me) &&
    !seen()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!due) return
    let live = true
    // Only a device that was never answered: on is done, and blocked can no longer be asked.
    pushState()
      .then((state) => {
        if (live && state === 'off') setOpen(true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [due])
  if (!open) return null
  const close = () => {
    markSeen()
    setOpen(false)
  }
  const enable = async () => {
    setBusy(true)
    try {
      const next = await enablePush(me.pushKey ?? '')
      reportPushInvite('ask', next)
      toast(next === 'on' ? t('on') : t('notAllowed'), next === 'on' ? 'success' : 'info')
    } catch {
      reportPushInvite('ask', 'failed')
      toast(t('failed'))
    }
    setBusy(false)
    close()
  }
  const later = () => {
    reportPushInvite('ask', 'later')
    close()
  }
  return <PushAskView busy={busy} onEnable={enable} onLater={later} />
}

export function PushAskView({
  busy = false,
  onEnable,
  onLater,
}: {
  busy?: boolean
  onEnable: () => void
  onLater: () => void
}) {
  const t = useMessages(messages)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
  }, [])
  const perks = [
    { icon: 'trophy', text: t('perks.trophy') },
    { icon: 'compass', text: t('perks.next') },
    { icon: 'warning', text: t('perks.missable') },
  ]
  return (
    <dialog
      ref={ref}
      className="onb push-ask"
      aria-label={t('label')}
      onCancel={(e) => {
        e.preventDefault()
        onLater()
      }}
    >
      <div className="onb-grid" aria-hidden="true" />
      <div className="onb-card">
        <div className="onb-body">
          <div className="onb-copy">
            <span className="push-ask-icon" aria-hidden="true">
              <Icon name="bell" />
            </span>
            <span className="eyebrow">{t('eyebrow')}</span>
            <h2>{t('title')}</h2>
            <p>{t('body')}</p>
            <ul className="push-ask-perks">
              {perks.map((p) => (
                <li key={p.icon}>
                  <Icon name={p.icon} />
                  {p.text}
                </li>
              ))}
            </ul>
            <small className="push-ask-off">{t('off')}</small>
          </div>
        </div>
        <footer className="onb-controls">
          <button type="button" className="ghost sm" disabled={busy} onClick={onLater}>
            {t('later')}
          </button>
          <button type="button" className="button" disabled={busy} onClick={onEnable}>
            <Icon name="bell" /> {t('enable')}
          </button>
        </footer>
      </div>
    </dialog>
  )
}
