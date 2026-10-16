/** Where Nexo's notices reach the player: push on this device and the linked Telegram chat. The
 * history keeps every notice either way. */
import { useEffect, useState } from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import { disablePush, enablePush, type PushState, pushState } from '../lib/push'
import type { Me } from '../lib/types'
import { Sk } from '../ui/skeleton'
import { toast } from '../ui/toast'
import { DemoNote } from './demo'
import './account.css'
import './notification-settings.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Notificações',
    lead: 'Escolha onde os avisos do Nexo chegam. Todos ficam no histórico, de qualquer jeito.',
    device: 'Neste aparelho',
    deviceHint: {
      on: 'Os avisos chegam como notificação, mesmo com o PlatJourney fechado.',
      off: 'Ligue para receber os avisos como notificação, mesmo com o PlatJourney fechado.',
      denied:
        'As notificações do PlatJourney estão bloqueadas neste navegador. Libere nas configurações do site e volte aqui.',
      install:
        'No iPhone, as notificações pedem o PlatJourney na tela de início: toque em Compartilhar, depois em "Adicionar à Tela de Início", e ligue aqui pelo ícone novo.',
      native: 'O app ainda não recebe notificações. Use o Telegram ou o PlatJourney no navegador.',
      unsupported: 'Este navegador não recebe notificações.',
    },
    test: 'Enviar um teste',
    testSent: 'Teste enviado. Deve chegar em alguns segundos.',
    testNone: 'Nenhum aparelho recebeu o teste. Desligue e ligue de novo.',
    telegram: 'No Telegram',
    telegramHint: 'Os avisos chegam na conversa com o Nexo.',
    telegramLinkFirst: 'Conecte o Telegram acima para receber por lá.',
    on: 'Notificações ligadas neste aparelho.',
    off: 'Notificações desligadas neste aparelho.',
    notAllowed:
      'O navegador não liberou as notificações. Permita para o PlatJourney no aviso do navegador ou nas configurações do site.',
    telegramOn: 'Os avisos voltam a chegar no Telegram.',
    telegramOff: 'Os avisos não vão mais para o Telegram.',
    failed: 'Não conseguimos mudar agora. Tente de novo.',
  },
  [Language.En]: {
    title: 'Notifications',
    lead: "Pick where Nexo's notices reach you. They all stay in the history either way.",
    device: 'On this device',
    deviceHint: {
      on: 'Notices arrive as notifications, even with PlatJourney closed.',
      off: 'Turn on to get notices as notifications, even with PlatJourney closed.',
      denied:
        "PlatJourney's notifications are blocked in this browser. Allow them in the site settings and come back.",
      install:
        'On iPhone, notifications need PlatJourney on the home screen: tap Share, then "Add to Home Screen", and turn them on here from the new icon.',
      native: "The app doesn't get notifications yet. Use Telegram or PlatJourney in the browser.",
      unsupported: "This browser doesn't get notifications.",
    },
    test: 'Send a test',
    testSent: 'Test sent. It should arrive in a few seconds.',
    testNone: 'No device got the test. Turn it off and on again.',
    telegram: 'On Telegram',
    telegramHint: 'Notices arrive in the chat with Nexo.',
    telegramLinkFirst: 'Link Telegram above to get them there.',
    on: 'Notifications on for this device.',
    off: 'Notifications off for this device.',
    notAllowed:
      "The browser didn't allow notifications. Allow them for PlatJourney in the browser's prompt or the site settings.",
    telegramOn: 'Notices go to Telegram again.',
    telegramOff: 'Notices no longer go to Telegram.',
    failed: "We couldn't change it now. Try again.",
  },
})

const handled = (e: unknown) => e instanceof ApiError && e.handled

interface ViewProps {
  push: PushState | 'loading'
  /** The instance sends push at all; without it the device row is left out. */
  pushAvailable: boolean
  telegramLinked: boolean
  notifyTelegram: boolean
  busy: boolean
  demo?: boolean
  onPush: (on: boolean) => void
  onTest: () => void
  onTelegram: (on: boolean) => void
}

/** The card itself, from plain props, so its stories need no browser push or network. */
export function NotificationSettingsView({
  push,
  pushAvailable,
  telegramLinked,
  notifyTelegram,
  busy,
  demo,
  onPush,
  onTest,
  onTelegram,
}: ViewProps) {
  const t = useMessages(messages)
  const switchable = push === 'on' || push === 'off'
  return (
    <div className="card" id="notifications-card">
      <h2>{t('title')}</h2>
      <p className="muted">{t('lead')}</p>
      {pushAvailable && (
        <label className="setting-row">
          <span className="setting-text">
            <b>{t('device')}</b>
            {push !== 'loading' && <small>{t(`deviceHint.${push}`)}</small>}
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            id="pref-push"
            checked={push === 'on'}
            aria-checked={push === 'on'}
            disabled={busy || demo || !switchable}
            onChange={(e) => onPush(e.target.checked)}
          />
        </label>
      )}
      {/* Outside the row's label: a button inside it would take the label's clicks from the switch. */}
      {pushAvailable && push === 'on' && (
        <p className="push-test">
          <button
            type="button"
            className="text-link"
            id="push-test"
            disabled={busy}
            onClick={onTest}
          >
            {t('test')}
          </button>
        </p>
      )}
      <label className="setting-row">
        <span className="setting-text">
          <b>{t('telegram')}</b>
          <small>{telegramLinked ? t('telegramHint') : t('telegramLinkFirst')}</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          id="pref-telegram"
          checked={telegramLinked && notifyTelegram}
          aria-checked={telegramLinked && notifyTelegram}
          disabled={busy || demo || !telegramLinked}
          onChange={(e) => onTelegram(e.target.checked)}
        />
      </label>
      {demo && <DemoNote />}
    </div>
  )
}

/** The card while the account loads: the lead and the two switches. */
export function NotificationSettingsSkeleton() {
  const t = useMessages(messages)
  return (
    <div className="card">
      <h2>{t('title')}</h2>
      <Sk w="90%" h={12} />
      {[0, 1].map((i) => (
        <div className="setting-row static" key={i}>
          <span className="setting-text grow">
            <Sk w="40%" h={13} />
            <Sk w="80%" h={10} />
          </span>
          <Sk w="40px" h={22} style={{ borderRadius: 'var(--radius-pill)' }} />
        </div>
      ))}
    </div>
  )
}

export function NotificationSettings({ user }: { user: Me }) {
  const t = useMessages(messages)
  const { setMe } = useApp()
  const [push, setPush] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const pushAvailable = !!user.pushKey
  useEffect(() => {
    if (!pushAvailable) return
    let live = true
    pushState()
      .then((state) => live && setPush(state))
      .catch(() => live && setPush('unsupported'))
    return () => {
      live = false
    }
  }, [pushAvailable])

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } catch (e) {
      if (!handled(e)) toast(t('failed'))
    }
    setBusy(false)
  }
  const changePush = (on: boolean) =>
    run(async () => {
      const state = on ? await enablePush(user.pushKey ?? '') : await disablePush()
      setPush(state)
      // Turning on can end without a subscription: the browser blocked or the player dismissed it.
      if (!on) toast(t('off'), 'success')
      else if (state === 'on') toast(t('on'), 'success')
      else toast(t('notAllowed'), 'info')
    })
  const test = () =>
    run(async () => {
      const { sent } = await api<{ sent: number }>('/api/push/test', {})
      toast(sent ? t('testSent') : t('testNone'), sent ? 'success' : 'info')
    })
  const changeTelegram = (on: boolean) =>
    run(async () => {
      const saved = await api<{ user: Me }>('/api/account/preferences', { notifyTelegram: on })
      setMe(saved.user)
      toast(on ? t('telegramOn') : t('telegramOff'), 'success')
    })

  return (
    <NotificationSettingsView
      push={push}
      pushAvailable={pushAvailable}
      telegramLinked={user.telegramLinked}
      notifyTelegram={user.notifyTelegram !== false}
      busy={busy}
      demo={user.demo}
      onPush={changePush}
      onTest={test}
      onTelegram={changeTelegram}
    />
  )
}
