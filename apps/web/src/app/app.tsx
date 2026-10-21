/** Nothing renders until we know who is signed in: the login screen, the app, or an offline notice.
 * The boot screen covers the start, until the session is known and, signed in, the first data. */
import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router'
import { BootScreen } from '../components/boot-screen'
import { OfflineScreen } from '../components/offline-screen'
import {
  applySavedLocale,
  defineMessages,
  getLocale,
  Language,
  takePickedLocale,
  useMessages,
} from '../i18n/i18n'
import { api } from '../lib/api'
import type { Me } from '../lib/types'
import { Connect, isConnectPage } from '../pages/connect'
import { Login } from '../pages/login'
import { ToastHost } from '../ui/toast'
import { TooltipHost } from '../ui/tooltip'
import { AppStateProvider, useApp } from './app-state'
import { Shell } from './shell'
import './app.css'

const messages = defineMessages({
  [Language.PtBR]: {
    skipToContent: 'Pular para o conteúdo',
  },
  [Language.En]: {
    skipToContent: 'Skip to content',
  },
})

type Session = { kind: 'loading' } | { kind: 'in'; me: Me } | { kind: 'out' } | { kind: 'offline' }

// How long the boot screen takes to fade out (boot-screen.css).
const BOOT_FADE_MS = 250

/** Tells the app the first /api/state answered, or will not: a private profile or a failure. */
function FirstData({ onReady }: { onReady: () => void }) {
  const { data, sync } = useApp()
  const ready = data !== null || sync !== 'connecting'
  useEffect(() => {
    if (ready) onReady()
  }, [ready, onReady])
  return null
}

/** The boot screen's life: shown, fading out once `ready`, then gone. */
function useBoot(ready: boolean): 'shown' | 'leaving' | 'gone' {
  const [boot, setBoot] = useState<'shown' | 'leaving' | 'gone'>('shown')
  useEffect(() => {
    if (ready && boot === 'shown') setBoot('leaving')
  }, [ready, boot])
  // Its own effect: one keyed on `ready` too would clear the timer as soon as `boot` changed.
  useEffect(() => {
    if (boot !== 'leaving') return
    const id = setTimeout(() => setBoot('gone'), BOOT_FADE_MS)
    return () => clearTimeout(id)
  }, [boot])
  return boot
}

export function App() {
  const t = useMessages(messages)
  const [session, setSession] = useState<Session>({ kind: 'loading' })
  const [firstData, setFirstData] = useState(false)
  const markFirstData = useCallback(() => setFirstData(true), [])
  // The consent page loads nothing of the app's own data, so it does not wait for it.
  const boot = useBoot(
    session.kind !== 'loading' && (session.kind !== 'in' || firstData || isConnectPage()),
  )
  // The account's saved language wins over the browser's guess, unless the player just picked
  // one on the sign-in screen: then that one is kept and saved to the account.
  const signIn = (me: Me) => {
    const picked = getLocale()
    if (takePickedLocale() && me.locale !== picked) {
      api('/api/account/preferences', { locale: picked }).catch(() => {})
      setSession({ kind: 'in', me: { ...me, locale: picked } })
      return
    }
    applySavedLocale(me.locale)
    setSession({ kind: 'in', me })
  }

  // Only a 401 means nobody is signed in; anything else (a network error, a 500, an answer that
  // is not JSON) means the server cannot be reached. Says whether the server answered.
  const loadSession = () =>
    api<{ user: Me }>('/api/me')
      .then((r) => {
        applySavedLocale(r.user.locale)
        setSession({ kind: 'in', me: r.user })
        return true
      })
      .catch((e) => {
        const out = e.status === 401
        setSession({ kind: out ? 'out' : 'offline' })
        return out
      })

  // biome-ignore lint/correctness/useExhaustiveDependencies: loads once, on the first render.
  useEffect(() => {
    loadSession()
    const out = () => setSession({ kind: 'out' })
    document.addEventListener('api:unauthorized', out)
    return () => document.removeEventListener('api:unauthorized', out)
  }, [])

  return (
    <>
      {/* A button, not a link: the hash belongs to the router. */}
      <button
        type="button"
        className="skip-link"
        onClick={() => {
          document.getElementById('main-content')?.focus()
          window.scrollTo({ top: 0 })
        }}
      >
        {t('skipToContent')}
      </button>
      {/* An assistant asking to connect gets the consent page alone, after the sign-in if needed. */}
      {session.kind === 'in' && isConnectPage() && <Connect me={session.me} />}
      {session.kind === 'in' && !isConnectPage() && (
        <BrowserRouter>
          <AppStateProvider me={session.me}>
            <FirstData onReady={markFirstData} />
            <Shell />
          </AppStateProvider>
        </BrowserRouter>
      )}
      {session.kind === 'out' && <Login onSignedIn={signIn} />}
      {session.kind === 'offline' && <OfflineScreen onRetry={loadSession} />}
      {boot !== 'gone' && <BootScreen leaving={boot === 'leaving'} />}
      <TooltipHost />
      <ToastHost />
    </>
  )
}
