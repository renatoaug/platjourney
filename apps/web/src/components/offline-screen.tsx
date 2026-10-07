/** The whole app when the server cannot be reached: nothing else can show without it. */
import { useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Icon } from '../ui/icon'
import './offline-screen.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Perdemos a conexão por um instante',
    lead: 'Não conseguimos falar com o servidor agora. Confira sua internet e tente de novo: seus troféus, metas e conversas com o Nexo continuam guardados.',
    retry: 'Tentar de novo',
    retrying: 'Tentando…',
    stillOffline: 'Ainda sem conexão. Tente de novo em instantes.',
    hint: 'Se continuar assim por muito tempo, o serviço pode estar em manutenção.',
  },
  [Language.En]: {
    title: 'We lost the connection for a moment',
    lead: 'We cannot reach the server right now. Check your internet and try again: your trophies, goals and chats with Nexo are still saved.',
    retry: 'Try again',
    retrying: 'Trying…',
    stillOffline: 'Still no connection. Try again in a moment.',
    hint: 'If it stays like this for long, the service may be under maintenance.',
  },
})

const STARS: { x: number; y: number; shape: 'plus' | 'dot' }[] = [
  { x: 30, y: 44, shape: 'plus' },
  { x: 204, y: 30, shape: 'dot' },
  { x: 218, y: 120, shape: 'plus' },
  { x: 226, y: 78, shape: 'dot' },
  { x: 40, y: 168, shape: 'dot' },
  { x: 64, y: 16, shape: 'dot' },
]

// Nexo, drifting on a tilted orbit, looking up at a signal with its outer arc gone dark: the
// connection it is waiting for. Decorative.
function WaitingForSignal() {
  return (
    <div className="offline-art" aria-hidden="true">
      <svg className="offline-sky" viewBox="0 0 240 200" aria-hidden="true">
        <circle className="offline-glow" cx="120" cy="96" r="78" />
        <ellipse
          className="offline-orbit"
          cx="120"
          cy="100"
          rx="108"
          ry="34"
          transform="rotate(-12 120 100)"
        />
        {STARS.map((star, i) => (
          <g
            key={`${star.x}-${star.y}`}
            className="offline-star"
            style={{ animationDelay: `${i * 0.4}s` }}
          >
            {star.shape === 'plus' ? (
              <path d={`M${star.x - 5} ${star.y}h10M${star.x} ${star.y - 5}v10`} />
            ) : (
              <circle cx={star.x} cy={star.y} r="2.5" />
            )}
          </g>
        ))}
        <ellipse className="offline-shadow" cx="112" cy="184" rx="40" ry="5" />
        <g className="offline-signal">
          <circle className="offline-signal-dot" cx="178" cy="78" r="4" />
          <path className="offline-signal-on" d="M166 66a17 17 0 0 1 24 0" />
          <path className="offline-signal-on" d="M157 57a30 30 0 0 1 42 0" />
          <path className="offline-signal-off" d="M148 48a43 43 0 0 1 60 0" />
        </g>
      </svg>
      <div className="offline-float">
        <img className="offline-nexo" src="/nexo-avatar.svg" alt="" />
      </div>
    </div>
  )
}

/** `onRetry` asks the server again and says whether it answered. */
export function OfflineScreen({ onRetry }: { onRetry: () => Promise<boolean> }) {
  const t = useMessages(messages)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const retry = async () => {
    setBusy(true)
    setFailed(false)
    const back = await onRetry()
    setBusy(false)
    if (!back) setFailed(true)
  }
  return (
    <main className="offline" id="main-content" tabIndex={-1}>
      <header className="logo offline-brand">
        <img className="brand-mark" src="/logo.svg" alt="" width="36" height="36" />
        <span className="brand-name">
          plat<span className="brand-accent">journey</span>
        </span>
      </header>
      <section className="offline-card" aria-labelledby="offline-title">
        <WaitingForSignal />
        <h1 id="offline-title">{t('title')}</h1>
        <p className="offline-lead">{t('lead')}</p>
        <button type="button" className="button" onClick={retry} disabled={busy}>
          <Icon name="refresh" className={busy ? 'offline-spin' : undefined} />{' '}
          {busy ? t('retrying') : t('retry')}
        </button>
        <p className="offline-status" role="status">
          {failed ? t('stillOffline') : ''}
        </p>
        <p className="offline-hint">{t('hint')}</p>
      </section>
    </main>
  )
}
