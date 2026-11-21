/** In the native app: a bar over the bottom of the screen asking to turn on Nexo's notices, before
 * the system's own dialog; the screen stays usable under it. iOS asks only once, so the app asks
 * when the player can see why. The first time the app is used on a
 * device, after the introduction; after a "not now", at most twice more, a week apart at least, and
 * only when a trophy notice came in that the player has not read: the moment the notices would have
 * helped. Whatever the answer, the Home card and the bell's line stay as the way back. */
import { useEffect, useState } from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { fmtAgo } from '../lib/format'
import { isNativePush, nativePushAvailable } from '../lib/native-push'
import { enablePush, type PushInviteWhere, pushState, reportPushInvite } from '../lib/push'
import type { AppStateData, Tip } from '../lib/types'
import { Icon } from '../ui/icon'
import { toast } from '../ui/toast'
import { TrophyMedal } from '../ui/trophy-medal'
import './push-ask.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'Avisos do Nexo',
    title: 'Quer aviso sobre os próximos troféus?',
    body: 'Te avisamos dos perdíveis no caminho e do próximo passo.',
    missedTitle: 'Caiu troféu no {game} {ago}',
    missedTitleNoGame: 'Caiu troféu {ago}',
    missedBody: 'Quer saber na hora da próxima vez?',
    enable: 'Ativar',
    later: 'Agora não',
    on: 'Pronto: os avisos do Nexo chegam neste aparelho.',
    notAllowed: 'As notificações não foram permitidas.',
    failed: 'Não deu para ativar agora. Dá para tentar de novo pelo sino.',
  },
  [Language.En]: {
    label: "Nexo's notices",
    title: 'Want a heads-up on your next trophies?',
    body: "We'll warn you about missables on the way and the next step.",
    missedTitle: 'A {game} trophy popped {ago}',
    missedTitleNoGame: 'A trophy popped {ago}',
    missedBody: 'Want to know right away next time?',
    enable: 'Turn on',
    later: 'Not now',
    on: "Done: Nexo's notices arrive on this device.",
    notAllowed: 'Notifications were not allowed.',
    failed: 'Could not turn them on now. You can try again from the bell.',
  },
})

/** How many times this device was asked and when last, kept on the device. */
export interface Asked {
  count: number
  at: number
}

const ASKED = 'platjourney:push-ask'
// The first version kept only that the device had been asked.
const ASKED_BEFORE = 'platjourney:push-ask-seen'
export const MAX_ASKS = 3
export const ASK_AGAIN_MS = 7 * 86_400_000

function readAsked(): Asked {
  try {
    const raw = localStorage.getItem(ASKED)
    if (raw) {
      const value = JSON.parse(raw) as Partial<Asked>
      if (typeof value.count === 'number' && typeof value.at === 'number')
        return { count: value.count, at: value.at }
    }
    return localStorage.getItem(ASKED_BEFORE) === '1' ? { count: 1, at: 0 } : { count: 0, at: 0 }
  } catch {
    // Without storage the device cannot remember an answer: never ask rather than ask every time.
    return { count: MAX_ASKS, at: 0 }
  }
}

function rememberAsked(asked: Asked) {
  try {
    localStorage.setItem(ASKED, JSON.stringify(asked))
  } catch {}
}

const TROPHY_KINDS = new Set(['unlock', 'platinum'])

/** Whether to ask now, and why: the first time, or a trophy notice the player missed. Null when not. */
export function askReason(
  asked: Asked,
  data: Pick<AppStateData, 'tips' | 'unread'>,
  now = Date.now(),
): { missed?: Tip } | null {
  if (asked.count === 0) return {}
  if (asked.count >= MAX_ASKS || now - asked.at < ASK_AGAIN_MS || !data.unread) return null
  // The newest trophy notice, come in since the last time this device was asked.
  const missed = data.tips.find((tip) => TROPHY_KINDS.has(tip.kind))
  if (!missed || new Date(missed.created_at).getTime() <= asked.at) return null
  return { missed }
}

/** Mounted in the shell: decides whether this device has to be asked now. */
export function PushAsk() {
  const { me, data } = useApp()
  const t = useMessages(messages)
  // After the account's first data, so native push has its session, and after the introduction.
  const ready =
    !!data &&
    !me.demo &&
    !me.visitor &&
    me.onboarded === true &&
    isNativePush() &&
    nativePushAvailable(me)
  const reason = ready && data ? askReason(readAsked(), data) : null
  const due = reason !== null
  const [open, setOpen] = useState<{ missed?: Tip } | null>(null)
  const [busy, setBusy] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the reason is read once, when it becomes due
  useEffect(() => {
    if (!due) return
    let live = true
    // Only a device that was never answered: on is done, and blocked can no longer be asked.
    pushState()
      .then((state) => {
        if (live && state === 'off') setOpen(reason)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [due])
  if (!open) return null
  const where: PushInviteWhere = open.missed ? 'again' : 'ask'
  const close = () => {
    const asked = readAsked()
    rememberAsked({ count: asked.count + 1, at: Date.now() })
    setOpen(null)
  }
  const enable = async () => {
    setBusy(true)
    try {
      const next = await enablePush(me.pushKey ?? '')
      reportPushInvite(where, next)
      toast(next === 'on' ? t('on') : t('notAllowed'), next === 'on' ? 'success' : 'info')
    } catch {
      reportPushInvite(where, 'failed')
      toast(t('failed'))
    }
    setBusy(false)
    close()
  }
  const later = () => {
    reportPushInvite(where, 'later')
    close()
  }
  const missed = open.missed
    ? { game: open.missed.game?.name ?? null, ago: fmtAgo(open.missed.created_at) }
    : undefined
  return <PushAskView missed={missed} busy={busy} onEnable={enable} onLater={later} />
}

export function PushAskView({
  missed,
  busy = false,
  onEnable,
  onLater,
}: {
  /** Asked again over a trophy notice the player missed: its game and how long ago it came. */
  missed?: { game: string | null; ago: string }
  busy?: boolean
  onEnable: () => void
  onLater: () => void
}) {
  const t = useMessages(messages)
  const title = missed
    ? missed.game
      ? t('missedTitle', { game: missed.game, ago: missed.ago })
      : t('missedTitleNoGame', { ago: missed.ago })
    : t('title')
  return (
    <section className="push-ask" aria-label={t('label')}>
      <button
        type="button"
        className="push-ask-close"
        aria-label={t('later')}
        disabled={busy}
        onClick={onLater}
      >
        <Icon name="close" />
      </button>
      <TrophyMedal type="platinum" className="push-ask-trophy" />
      <span className="push-ask-copy">
        <b>{title}</b>
        <small>{missed ? t('missedBody') : t('body')}</small>
      </span>
      <button
        type="button"
        className="button sm push-ask-enable"
        disabled={busy}
        onClick={onEnable}
      >
        {t('enable')}
      </button>
    </section>
  )
}
