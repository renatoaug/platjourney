/** Nothing renders until we know who is signed in: the login screen, the app, or an offline notice. */
import { useEffect, useState } from 'react'
import { HashRouter } from 'react-router'
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
import { Login } from '../pages/login'
import { ToastHost } from '../ui/toast'
import { TooltipHost } from '../ui/tooltip'
import { AppStateProvider } from './app-state'
import { Shell } from './shell'

const messages = defineMessages({
  [Language.PtBR]: {
    skipToContent: 'Pular para o conteúdo',
  },
  [Language.En]: {
    skipToContent: 'Skip to content',
  },
})

type Session = { kind: 'loading' } | { kind: 'in'; me: Me } | { kind: 'out' } | { kind: 'offline' }

export function App() {
  const t = useMessages(messages)
  const [session, setSession] = useState<Session>({ kind: 'loading' })
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

  useEffect(() => {
    api<{ user: Me }>('/api/me')
      .then((r) => {
        applySavedLocale(r.user.locale)
        setSession({ kind: 'in', me: r.user })
      })
      .catch((e) => setSession({ kind: e.status === 401 ? 'out' : 'offline' }))
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
      {session.kind === 'in' && (
        <HashRouter>
          <AppStateProvider me={session.me}>
            <Shell />
          </AppStateProvider>
        </HashRouter>
      )}
      {session.kind === 'out' && <Login onSignedIn={signIn} />}
      {session.kind === 'offline' && <Login offline onSignedIn={signIn} />}
      <TooltipHost />
      <ToastHost />
    </>
  )
}
