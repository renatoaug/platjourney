/** The consent page an assistant (Claude, ChatGPT…) sends the player to when connecting through
 * MCP: which assistant asks, what it may read, and Allow or Cancel. It opens on its own, one card with
 * the logo outside the app's frame, after the sign-in when nobody is signed in yet; the answer sends
 * the browser back to the assistant. */
import { useEffect, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import type { Me } from '../lib/types'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import '../components/auth/auth-layout.css'
import './connect.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'CONECTAR ASSISTENTE',
    title: '{name} quer usar a sua conta do PlatJourney',
    as: 'Você está entrando como {id}.',
    can: 'Poderá ler',
    reads: {
      profile: 'Seu perfil, seus jogos e seus troféus',
      current: 'O jogo que você está jogando',
      interests: 'Seus interesses, a meta do ano e as recomendações',
      guides: 'Os guias de platina',
    },
    canChange: 'Poderá mudar, quando você pedir',
    changes: {
      interests: 'Seus interesses e a meta do ano',
      recommendations: 'As recomendações que você dispensar',
    },
    cannot: 'Não vê a sua senha e não muda mais nada na sua conta.',
    revoke: 'Dá para desconectar quando quiser, em Configurações.',
    returns: 'Depois você volta para {host}.',
    allow: 'Permitir',
    cancel: 'Cancelar',
    invalid: 'Este link de conexão não vale mais. Comece de novo pelo assistente.',
    failed: 'Não deu para concluir agora. Tente de novo.',
  },
  [Language.En]: {
    eyebrow: 'CONNECT AN ASSISTANT',
    title: '{name} wants to use your PlatJourney account',
    as: 'You are signed in as {id}.',
    can: 'It will be able to read',
    reads: {
      profile: 'Your profile, your games and your trophies',
      current: 'The game you are playing',
      interests: 'Your interests, the yearly goal and the recommendations',
      guides: 'The platinum guides',
    },
    canChange: 'It will be able to change, when you ask',
    changes: {
      interests: 'Your interests and the yearly goal',
      recommendations: 'The recommendations you dismiss',
    },
    cannot: 'It does not see your password and changes nothing else in your account.',
    revoke: 'You can disconnect it at any time, in Settings.',
    returns: 'You then go back to {host}.',
    allow: 'Allow',
    cancel: 'Cancel',
    invalid: 'This connection link is no longer valid. Start again from the assistant.',
    failed: "Couldn't finish right now. Try again.",
  },
})

const READS = ['profile', 'current', 'interests', 'guides'] as const
const CHANGES = ['interests', 'recommendations'] as const

/** True when the address is the consent page's, so the app opens it instead of its own frame. */
export const isConnectPage = (hash = window.location.hash) => hash.startsWith('#/connect')

function askFrom(hash: string) {
  const p = new URLSearchParams(hash.split('?')[1] ?? '')
  return {
    clientId: p.get('client_id') ?? '',
    redirectUri: p.get('redirect_uri') ?? '',
    challenge: p.get('code_challenge') ?? '',
    state: p.get('state'),
  }
}

export type ConsentLoad =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'ready'; name: string; host: string }

export function Connect({
  me,
  go = (url) => window.location.assign(url),
}: {
  me: Me
  go?: (url: string) => void
}) {
  const [ask] = useState(() => askFrom(window.location.hash))
  const [load, setLoad] = useState<ConsentLoad>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const q = new URLSearchParams({ client_id: ask.clientId, redirect_uri: ask.redirectUri })
    api<{ name: string; redirectHost: string }>(`/api/oauth/client?${q}`)
      .then((c) => setLoad({ kind: 'ready', name: c.name, host: c.redirectHost }))
      .catch(() => setLoad({ kind: 'invalid' }))
  }, [ask])
  const answer = async (allow: boolean) => {
    setBusy(true)
    setFailed(false)
    try {
      const { redirect } = await api<{ redirect: string }>('/api/oauth/authorize', {
        ...ask,
        allow,
      })
      go(redirect)
    } catch {
      setBusy(false)
      setFailed(true)
    }
  }
  return <ConnectView me={me} load={load} busy={busy} failed={failed} onAnswer={answer} />
}

/** The page from its state, so its stories need no network. */
export function ConnectView({
  me,
  load,
  busy = false,
  failed = false,
  onAnswer,
}: {
  me: Me
  load: ConsentLoad
  busy?: boolean
  failed?: boolean
  onAnswer: (allow: boolean) => void
}) {
  const t = useMessages(messages)
  return (
    <div className="auth connect-screen">
      <section className="connect" id="connect-page">
        <div className="logo connect-logo">
          <img className="brand-mark" src="/logo.svg" alt="" width="40" height="40" />
          <span className="brand-name">
            plat<span className="brand-accent">journey</span>
          </span>
        </div>
        <span className="eyebrow">{t('eyebrow')}</span>
        {load.kind === 'loading' && (
          <>
            <Sk w="85%" h={22} />
            <Sk w="60%" h={14} style={{ marginTop: 12 }} />
          </>
        )}
        {load.kind === 'invalid' && <p className="connect-invalid">{t('invalid')}</p>}
        {load.kind === 'ready' && (
          <>
            <h1>{t('title', { name: load.name })}</h1>
            <p className="connect-as">{t('as', { id: me.onlineId })}</p>
            <h2>{t('can')}</h2>
            <ul className="connect-reads">
              {READS.map((r) => (
                <li key={r}>
                  <Icon name="check" /> {t(`reads.${r}`)}
                </li>
              ))}
            </ul>
            <h2>{t('canChange')}</h2>
            <ul className="connect-reads">
              {CHANGES.map((c) => (
                <li key={c}>
                  <Icon name="edit" /> {t(`changes.${c}`)}
                </li>
              ))}
            </ul>
            <p className="connect-note">{t('cannot')}</p>
            <p className="connect-note">{t('revoke')}</p>
            {failed && (
              <p className="connect-failed" role="alert">
                {t('failed')}
              </p>
            )}
            <div className="connect-actions">
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => onAnswer(false)}
              >
                {t('cancel')}
              </button>
              <button type="button" disabled={busy} onClick={() => onAnswer(true)}>
                {t('allow')}
              </button>
            </div>
            <p className="connect-return">{t('returns', { host: load.host })}</p>
          </>
        )}
      </section>
    </div>
  )
}
