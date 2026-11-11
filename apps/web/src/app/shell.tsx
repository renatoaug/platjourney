/** The signed-in layout: sidebar, top bar and the screen for the current route. */

import { useEffect, useRef, useState } from 'react'
import {
  Link,
  type Location,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router'
import { AccountMenu } from '../components/account-menu'
import { CommandPalette } from '../components/command-palette'
import { DemoBanner } from '../components/demo'
import { JourneyChat } from '../components/journey-chat'
import { Notifications } from '../components/notifications'
import { Onboarding } from '../components/onboarding'
import { PrivateNotice } from '../components/private-notice'
import { PullRefresh } from '../components/pull-refresh'
import {
  defineMessages,
  getLocale,
  Language,
  type MessageKey,
  useLocale,
  useMessages,
} from '../i18n/i18n'
import { number } from '../lib/format'
import { keepBottomBarOnScreen } from '../lib/native'
import { Discover } from '../pages/discover'
import { Game } from '../pages/game'
import { Games } from '../pages/games'
import { Guides } from '../pages/guides'
import { History } from '../pages/history'
import { Home } from '../pages/home'
import { Nexo } from '../pages/nexo'
import { Profile } from '../pages/profile'
import { Settings } from '../pages/settings'
import { Title } from '../pages/title'
import { pluginPages } from '../plugins'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { useApp } from './app-state'
import './shell.css'

const messages = defineMessages({
  [Language.PtBR]: {
    nav: {
      home: 'Home',
      games: 'Jogos',
      game: 'Jornada',
      nexo: 'Nexo',
      goals: 'Interesses',
      discover: 'Descobrir',
      guides: 'Guias',
      history: 'Histórico',
      profile: 'Meu perfil',
      settings: 'Configurações',
      title: 'Jogo',
      more: 'Mais',
    },
    mainNav: 'Navegação principal',
    ai: 'IA',
    profileLabel: 'Meu perfil',
    profileLine: 'Nível {level} · {platinums} platinas',
    profileUnavailable: 'Perfil indisponível',
    waitingPsn: 'Aguardando a PSN',
    sync: {
      connecting: 'Conectando à PSN',
      connected: 'Dados sincronizados',
      failed: 'Falha na sincronização',
      private: 'Troféus privados',
    },
    syncTip: {
      connected: 'Dados sincronizados às {time}. Clique para atualizar.',
      private: 'Troféus privados na PSN',
      failed: 'Falha na sincronização. Clique para tentar de novo.',
      idle: 'Atualizar dados',
    },
    refresh: 'Atualizar dados',
    logoLabel: 'PlatJourney — início',
    yourSpace: 'SEU ESPAÇO',
    noteEyebrow: 'CADA TROFÉU CONTA',
    noteLine1: 'Sua próxima platina',
    noteLine2: 'começa aqui.',
    noteCta: 'Conte com o Nexo',
    breadcrumb: 'Seu espaço',
  },
  [Language.En]: {
    nav: {
      home: 'Home',
      games: 'Games',
      game: 'Journey',
      nexo: 'Nexo',
      goals: 'Interests',
      discover: 'Discover',
      guides: 'Guides',
      history: 'History',
      profile: 'My profile',
      settings: 'Settings',
      title: 'Game',
      more: 'More',
    },
    mainNav: 'Main navigation',
    ai: 'AI',
    profileLabel: 'My profile',
    profileLine: 'Level {level} · {platinums} platinums',
    profileUnavailable: 'Profile unavailable',
    waitingPsn: 'Waiting for PSN',
    sync: {
      connecting: 'Connecting to PSN',
      connected: 'Data synced',
      failed: 'Sync failed',
      private: 'Private trophies',
    },
    syncTip: {
      connected: 'Data synced at {time}. Click to refresh.',
      private: 'Trophies are private on PSN',
      failed: 'Sync failed. Click to try again.',
      idle: 'Refresh data',
    },
    refresh: 'Refresh data',
    logoLabel: 'PlatJourney — home',
    yourSpace: 'YOUR SPACE',
    noteEyebrow: 'EVERY TROPHY COUNTS',
    noteLine1: 'Your next platinum',
    noteLine2: 'starts here.',
    noteCta: 'Count on Nexo',
    breadcrumb: 'Your space',
  },
})

const NAV: { to: string; label: MessageKey<typeof messages>; icon: string }[] = [
  { to: '/', label: 'nav.home', icon: 'dashboard' },
  { to: '/game', label: 'nav.game', icon: 'compass' },
  { to: '/guides', label: 'nav.guides', icon: 'book-open' },
  { to: '/discover', label: 'nav.discover', icon: 'globe' },
  { to: '/games?tab=interests', label: 'nav.games', icon: 'gamepad' },
]

const LABELS: Record<string, MessageKey<typeof messages>> = {
  '/': 'nav.home',
  '/game': 'nav.game',
  '/games': 'nav.games',
  '/overview': 'nav.home',
  '/nexo': 'nav.nexo',
  '/goals': 'nav.goals',
  '/discover': 'nav.discover',
  '/guides': 'nav.guides',
  '/history': 'nav.history',
  '/profile': 'nav.profile',
  '/settings': 'nav.settings',
}

/** How the screen was reached, for its entrance on a phone (page.css): `tab` between the menu's
 * screens fades, `push` into a deeper screen slides in from the right, `pop` (back) from the left. */
type Arrival = 'tab' | 'push' | 'pop'

function useArrival(pathname: string): Arrival {
  const type = useNavigationType()
  const previous = useRef(pathname)
  const arrival = useRef<Arrival>('tab')
  if (previous.current !== pathname) {
    const isTab = (path: string) => path in LABELS || pluginPages.some((p) => p.path === path)
    arrival.current =
      type === 'POP' ? 'pop' : isTab(pathname) && isTab(previous.current) ? 'tab' : 'push'
    previous.current = pathname
  }
  return arrival.current
}

export function Nav() {
  const { pathname } = useLocation()
  const active = pathname.startsWith('/title/') || pathname === '/goals' ? '/games' : pathname
  const t = useMessages(messages)
  return (
    <nav className="nav journey-nav" aria-label={t('mainNav')}>
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          className={active === n.to.split('?')[0] ? 'active' : ''}
        >
          <Icon name={n.icon} />
          {t(n.label)}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarProfile() {
  const t = useMessages(messages)
  const { data } = useApp()
  const p = data?.profile
  return (
    <Link className="profile" id="profile" to="/profile" aria-label={t('profileLabel')}>
      {!data ? (
        <>
          <Sk w="36px" h={36} style={{ borderRadius: '50%', flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <Sk w="60%" h={12} />
            <Sk w="80%" h={9} style={{ marginTop: 6 }} />
          </div>
        </>
      ) : p ? (
        <>
          <img src={p.avatarUrl ?? ''} alt="" />
          <div>
            <b>{p.onlineId}</b>
            <small>
              {t('profileLine', { level: p.level, platinums: number(p.earned.platinum) })}
            </small>
          </div>
        </>
      ) : (
        <div>
          <b>{t('profileUnavailable')}</b>
          <small>{t('waitingPsn')}</small>
        </div>
      )}
    </Link>
  )
}

/** The account's picture at the end of the top bar, a way to the profile on a phone. */
function SyncButton() {
  const t = useMessages(messages)
  const { loadState, loading, sync, syncedAt } = useApp()
  const tip =
    sync === 'connected' && syncedAt
      ? t('syncTip.connected', {
          time: syncedAt.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }),
        })
      : sync === 'private'
        ? t('syncTip.private')
        : sync === 'failed'
          ? t('syncTip.failed')
          : t('syncTip.idle')
  return (
    <button
      className="icon-button"
      type="button"
      id="refresh-state"
      aria-label={t('refresh')}
      data-tip={tip}
      disabled={loading}
      onClick={() => loadState()}
    >
      <Icon name="refresh" />
      <span
        className={`sync-status${sync === 'connected' ? ' connected' : ''}${sync === 'failed' || sync === 'private' ? ' failed' : ''}`}
        id="sync-status"
        role="status"
      >
        {t(`sync.${sync}`)}
      </span>
    </button>
  )
}

export function Shell() {
  const t = useMessages(messages)
  const location = useLocation()
  const background = (location.state as { journey?: Location } | null)?.journey
  const modal = location.pathname === '/nexo' && background
  const pathname = modal ? background.pathname : location.pathname
  const { me, loadState } = useApp()
  const [privateProfile, setPrivateProfile] = useState(false)
  // Pulling down refreshes the app's data and mounts the screen again, so it fetches its own too
  // (a screen seen before keeps showing while it does).
  const [refreshes, setRefreshes] = useState(0)
  const pullRefresh = async () => {
    await loadState()
    setRefreshes((n) => n + 1)
  }
  const locale = useLocale()
  const isTitle = pathname.startsWith('/title/')
  const arrival = useArrival(pathname)
  const page = pluginPages.find((p) => p.path === pathname)
  const label = page
    ? page.label[locale]
    : t(isTitle ? 'nav.title' : (LABELS[pathname] ?? 'nav.home'))

  useEffect(() => {
    // A game page names the tab after the game once it knows it; a generic "Jogo" first would only
    // flash before the name.
    if (!isTitle) document.title = label
    window.scrollTo({ top: 0 })
  }, [label, isTitle])

  useEffect(() => {
    const show = () => setPrivateProfile(true)
    document.addEventListener('api:private-profile', show)
    return () => document.removeEventListener('api:private-profile', show)
  }, [])

  const sidebar = useRef<HTMLElement>(null)
  useEffect(() => (sidebar.current ? keepBottomBarOnScreen(sidebar.current) : undefined), [])

  return (
    <div className="app" id="app" data-arrival={arrival}>
      <aside className="sidebar" ref={sidebar}>
        <Link className="logo" to="/" aria-label={t('logoLabel')}>
          <img className="brand-mark" src="/logo.svg" alt="" width="40" height="40" />
          <span className="brand-name">
            plat<span className="brand-accent">journey</span>
          </span>
        </Link>
        <div className="sidebar-scroll">
          <div className="nav-label">{t('yourSpace')}</div>
          <Nav />
          <Link className="sidebar-note" to="/nexo?resume=latest">
            <span className="eyebrow">{t('noteEyebrow')}</span>
            <strong>
              {t('noteLine1')}
              <br />
              {t('noteLine2')}
            </strong>
            <span>
              {t('noteCta')} <Icon name="arrow" />
            </span>
          </Link>
          <span className="app-version">v{__APP_VERSION__}</span>
        </div>
        <SidebarProfile />
      </aside>

      <main className="content" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb">
            <span className="breadcrumb-root">
              {t('breadcrumb')} <span>/</span>{' '}
            </span>
            <b id="route-label">{label}</b>
          </div>
          <div className="topbar-right">
            <CommandPalette
              screens={NAV.map((n) => ({ to: n.to, label: t(n.label), icon: n.icon }))}
            />
            <Notifications />
            <SyncButton />
            <AccountMenu />
          </div>
        </header>
        {me.demo && <DemoBanner />}
        <Onboarding />
        {privateProfile && <PrivateNotice />}
        <PullRefresh onRefresh={pullRefresh} />
        <Routes key={refreshes} location={modal ? background : location}>
          <Route path="/" element={<Home />} />
          <Route path="/overview" element={<Navigate to="/" replace />} />
          <Route path="/games" element={<Games />} />
          <Route path="/game" element={<Game />} />
          <Route path="/nexo" element={<Nexo />} />
          <Route path="/goals" element={<Navigate to="/games?tab=goals" replace />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/title/*" element={<Title />} />
          {pluginPages.map((p) => (
            <Route key={p.path} path={p.path} element={<p.component />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {modal && <JourneyChat />}
      </main>
    </div>
  )
}
