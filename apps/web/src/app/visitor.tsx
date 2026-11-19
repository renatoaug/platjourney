/** Someone without an account: the pages anyone can open (a shared profile, a game's guide, the
 * guides), under a header with the way in. Every other address is the sign-in screen. */
import { useEffect } from 'react'
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from 'react-router'
import { SIGN_IN } from '../components/join-link'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import type { Me } from '../lib/types'
import { Guides } from '../pages/guides'
import { Login } from '../pages/login'
import { PublicProfile } from '../pages/profile'
import { Title } from '../pages/title'
import { Icon } from '../ui/icon'
import { AppStateProvider } from './app-state'
import './visitor.css'

const messages = defineMessages({
  [Language.PtBR]: {
    logoLabel: 'PlatJourney, início',
    guides: 'Guias',
    signIn: 'Entrar',
    join: 'Criar conta grátis',
    joinShort: 'Criar conta',
    pitch:
      'Conecte sua PSN e o PlatJourney acompanha cada platina sua: o próximo troféu, o que é perdível e o Nexo para tirar dúvidas.',
  },
  [Language.En]: {
    logoLabel: 'PlatJourney, home',
    guides: 'Guides',
    signIn: 'Sign in',
    join: 'Create a free account',
    joinShort: 'Sign up',
    pitch:
      'Connect your PSN and PlatJourney follows every platinum of yours: the next trophy, what is missable and Nexo to answer questions.',
  },
})

const VISITOR: Me = {
  id: '',
  onlineId: '',
  telegramLinked: false,
  includeDlcProgress: false,
  onboarded: true,
  visitor: true,
}

/** Under a public page: what an account adds, and the way to make one. */
function JoinBand() {
  const t = useMessages(messages)
  return (
    <aside className="visitor-join card" aria-label={t('join')}>
      <img src="/logo.png" alt="" width="48" height="48" />
      <p>{t('pitch')}</p>
      <Link className="button" to={SIGN_IN}>
        {t('join')}
      </Link>
    </aside>
  )
}

function VisitorShell() {
  const t = useMessages(messages)
  return (
    <div className="visitor" id="visitor">
      <header className="visitor-bar">
        <Link className="visitor-logo" to="/guides" aria-label={t('logoLabel')}>
          <img className="brand-mark" src="/logo.png" alt="" width="32" height="32" />
          <span className="brand-name">
            plat<span className="brand-accent">journey</span>
          </span>
        </Link>
        <nav className="visitor-nav">
          <NavLink to="/guides" className="visitor-link">
            <Icon name="book-open" /> {t('guides')}
          </NavLink>
        </nav>
        <div className="visitor-actions">
          <Link className="button secondary sm" to={SIGN_IN} id="visitor-sign-in">
            {t('signIn')}
          </Link>
          <Link className="button sm" to={SIGN_IN} id="visitor-join">
            {t('joinShort')}
          </Link>
        </div>
      </header>
      <main className="content visitor-content" id="main-content" tabIndex={-1}>
        <Outlet />
        <JoinBand />
      </main>
    </div>
  )
}

/** The sign-in screen, or a public page under the visitor's header. */
function VisitorRoutes({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  return (
    <Routes>
      <Route element={<VisitorShell />}>
        <Route path="/profiles/:user" element={<PublicProfile />} />
        <Route path="/title/*" element={<Title />} />
        <Route path="/guides" element={<Guides />} />
      </Route>
      <Route path="*" element={<SignIn onSignedIn={onSignedIn} />} />
    </Routes>
  )
}

/** The sign-in screen starts at the top, wherever the visitor scrolled before. */
function SignIn({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])
  return <Login onSignedIn={onSignedIn} />
}

export function VisitorApp({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  return (
    <BrowserRouter>
      <AppStateProvider me={VISITOR}>
        <VisitorRoutes onSignedIn={onSignedIn} />
      </AppStateProvider>
    </BrowserRouter>
  )
}
