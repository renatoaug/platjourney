/** The signed-in layout: sidebar, top bar and the screen for the current route. */

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Link, type Location, Navigate, NavLink, Route, Routes, useLocation } from 'react-router'
import { AccountMenu, signOut } from '../components/account-menu'
import { CommandPalette } from '../components/command-palette'
import { connectAccount, DemoBanner } from '../components/demo'
import { JourneyChat } from '../components/journey-chat'
import { NexoBubble } from '../components/nexo-bubble'
import { Notifications } from '../components/notifications'
import { Onboarding } from '../components/onboarding'
import { PrivateNotice } from '../components/private-notice'
import { PushAsk } from '../components/push-ask'
import {
  defineMessages,
  getLocale,
  Language,
  type MessageKey,
  useLocale,
  useMessages,
} from '../i18n/i18n'
import { keepBottomBarOnScreen } from '../lib/native'
import { Community } from '../pages/community'
import { Game } from '../pages/game'
import { Games } from '../pages/games'
import { Guides } from '../pages/guides'
import { History } from '../pages/history'
import { Home } from '../pages/home'
import { Nexo } from '../pages/nexo'
import { Profile, PublicProfile } from '../pages/profile'
import { PublicHome, VisitorGames } from '../pages/public-home'
import { Settings } from '../pages/settings'
import { Title } from '../pages/title'
import { menuPages, pluginPages } from '../plugins'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { useApp } from './app-state'
import { screenOf, useArrival, useScrollMemory } from './navigation'
import { nextAfterSignIn, SignInPrompt, VisitorAccount, VisitorActions } from './visitor'
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
      community: 'Comunidade',
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
    profileLevel: 'Nível {level}',
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
    groups: { play: 'JOGAR', account: 'CONTA' },
    xp: 'Progresso do nível {level}: {progress}%',
    signOut: 'Sair',
    leaveDemo: 'Sair da demo',
    leaving: 'Saindo…',
    signOutFailed: 'Não deu para sair. Tente de novo.',
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
      community: 'Community',
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
    profileLevel: 'Level {level}',
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
    groups: { play: 'PLAY', account: 'ACCOUNT' },
    xp: 'Level {level} progress: {progress}%',
    signOut: 'Sign out',
    leaveDemo: 'Leave the demo',
    leaving: 'Signing out…',
    signOutFailed: 'Could not sign out. Try again.',
    breadcrumb: 'Your space',
  },
})

/** Discover became a tab of Games: old links keep their options (?scope=interests). */
function DiscoverMoved() {
  const { search } = useLocation()
  const extra = search ? `&${search.slice(1)}` : ''
  return <Navigate to={`/games?tab=discover${extra}`} replace />
}

const NAV: { to: string; label: MessageKey<typeof messages>; icon: string }[] = [
  { to: '/', label: 'nav.home', icon: 'dashboard' },
  { to: '/game', label: 'nav.game', icon: 'compass' },
  { to: '/guides', label: 'nav.guides', icon: 'book-open' },
  { to: '/community', label: 'nav.community', icon: 'users' },
  { to: '/games?tab=discover', label: 'nav.games', icon: 'gamepad' },
]

const LABELS: Record<string, MessageKey<typeof messages>> = {
  '/': 'nav.home',
  '/game': 'nav.game',
  '/games': 'nav.games',
  '/overview': 'nav.home',
  '/nexo': 'nav.nexo',
  '/goals': 'nav.goals',
  '/discover': 'nav.games',
  '/community': 'nav.community',
  '/guides': 'nav.guides',
  '/history': 'nav.history',
  '/profile': 'nav.profile',
  '/settings': 'nav.settings',
}

/** The active link in the navigation, for the pill to slide under. */
function activeNavItem(nav: HTMLElement | null) {
  const link = nav?.querySelector<HTMLElement>('a.active')
  return link?.offsetWidth ? link : null
}

/** Puts the pill under `active`; `instant` skips the slide (first placement, resize). */
function moveIndicator(el: HTMLElement, active: HTMLElement, instant: boolean) {
  el.style.transition = instant ? 'none' : ''
  el.style.width = `${active.offsetWidth}px`
  el.style.height = `${active.offsetHeight}px`
  el.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`
  el.style.opacity = '1'
  if (instant)
    requestAnimationFrame(() => {
      el.style.transition = ''
    })
}

/** Signing out from the end of the menu: busy until the page reloads into the sign-in screen. */
function SignOut() {
  const t = useMessages(messages)
  const { me } = useApp()
  const [leaving, setLeaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const leave = async () => {
    setLeaving(true)
    setFailed(false)
    try {
      await (me.demo ? connectAccount : signOut)()
    } catch {
      setLeaving(false)
      setFailed(true)
    }
  }
  const label = leaving ? t('leaving') : t(me.demo ? 'leaveDemo' : 'signOut')
  return (
    <>
      <button
        type="button"
        className="nav-signout"
        onClick={leave}
        disabled={leaving}
        aria-busy={leaving}
        aria-label={label}
        data-tip={label}
      >
        <Icon name="arrow-right" />
      </button>
      {failed && (
        <p className="nav-signout-error" role="alert">
          {t('signOutFailed')}
        </p>
      )}
    </>
  )
}

/** The whole menu, in two groups: playing (the bottom bar on a phone) and the account, with the plugins' pages before the settings. A pill slides under the active link. */
export function Nav() {
  const { pathname } = useLocation()
  const visitor = useApp().me.visitor === true
  const active = pathname.startsWith('/title/') || pathname === '/goals' ? '/games' : pathname
  const t = useMessages(messages)
  const locale = useLocale()
  const nav = useRef<HTMLElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: the active link changes with the route
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const el = indicator.current
      const link = activeNavItem(nav.current)
      if (!el) return
      if (!link) {
        el.style.opacity = '0'
        return
      }
      moveIndicator(el, link, !placed.current || !animate)
      placed.current = true
      nav.current?.classList.add('nav-animated')
    }
    place(true)
    const observer = new ResizeObserver(() => place(false))
    if (nav.current) observer.observe(nav.current)
    return () => observer.disconnect()
  }, [active])

  const groups: {
    key: string
    items: { to: string; label: string; icon: string }[]
  }[] = [
    { key: 'play', items: NAV.map((n) => ({ to: n.to, label: t(n.label), icon: n.icon })) },
    // Someone without an account has no account pages to list.
    ...(visitor
      ? []
      : [
          {
            key: 'account',
            items: [
              ...menuPages().map((p) => ({ to: p.path, label: p.label[locale], icon: p.icon })),
              { to: '/settings', label: t('nav.settings'), icon: 'settings' },
            ],
          },
        ]),
  ]
  let order = 0
  return (
    <nav className="nav journey-nav" aria-label={t('mainNav')} ref={nav}>
      <span className="nav-indicator" aria-hidden="true" ref={indicator} />
      {groups.map((g) => (
        <div key={g.key} className={`nav-group is-${g.key}`}>
          <span className="nav-label">{t(`groups.${g.key}` as MessageKey<typeof messages>)}</span>
          {g.items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              // The name in a tooltip, only while the tablet's menu shows the icon alone.
              data-tip={n.label}
              data-tip-hidden-label
              end={n.to === '/'}
              className={active === n.to.split('?')[0] ? 'active' : ''}
              style={{ '--i': order++ } as CSSProperties}
            >
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </div>
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
            <small>{t('profileLevel', { level: p.level })}</small>
            <span
              className="profile-xp"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(p.levelProgress)}
              aria-label={t('xp', { level: p.level, progress: Math.round(p.levelProgress) })}
            >
              <i style={{ width: `${Math.max(0, Math.min(100, p.levelProgress))}%` }} />
            </span>
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

/** The end of the menu: the player's card and the way out, or the way in without an account. */
function SidebarAccount() {
  if (useApp().me.visitor) return <VisitorAccount />
  return (
    <>
      <SidebarProfile />
      <SignOut />
    </>
  )
}

/** The end of the top bar: notices, the sync and the account menu, or the way in. */
function AccountActions() {
  if (useApp().me.visitor) return <VisitorActions />
  return (
    <>
      <Notifications />
      <SyncButton />
      <AccountMenu />
    </>
  )
}

export function Shell() {
  const t = useMessages(messages)
  const location = useLocation()
  const background = (location.state as { journey?: Location } | null)?.journey
  const modal = location.pathname === '/nexo' && background
  const pathname = modal ? background.pathname : location.pathname
  const { me } = useApp()
  // A screen of the account, for someone without one: the way in instead.
  const own = (screen: ReactNode, path: string) =>
    me.visitor ? <SignInPrompt path={path} /> : screen
  const [privateProfile, setPrivateProfile] = useState(false)
  const locale = useLocale()
  const isTitle = pathname.startsWith('/title/')
  const screen = screenOf(modal ? background : location)
  const arrival = useArrival(screen)
  useScrollMemory(location, screen, !!modal)
  const page = pluginPages.find((p) => p.path === pathname)
  const label = page
    ? page.label[locale]
    : t(
        isTitle
          ? 'nav.title'
          : (LABELS[pathname.replace(/^\/profiles\/.+/, '/community')] ?? 'nav.home'),
      )

  useEffect(() => {
    // A game page names the tab after the game once it knows it; a generic "Jogo" first would only
    // flash before the name.
    if (!isTitle) document.title = label
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
          <img className="brand-mark" src="/logo.png" alt="" width="40" height="40" />
          <span className="brand-name">
            plat<span className="brand-accent">journey</span>
          </span>
        </Link>
        <div className="sidebar-scroll">
          <Nav />
          <span className="app-version">v{__APP_VERSION__}</span>
        </div>
        <div className="sidebar-account">
          <SidebarAccount />
        </div>
      </aside>

      <main className="content" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb">
            <span className="breadcrumb-root">
              {me.visitor ? 'PlatJourney' : t('breadcrumb')} <span>/</span>{' '}
            </span>
            <b id="route-label">{label}</b>
          </div>
          <div className="topbar-right">
            <CommandPalette
              screens={NAV.map((n) => ({ to: n.to, label: t(n.label), icon: n.icon }))}
            />
            <AccountActions />
          </div>
        </header>
        {me.demo && !me.visitor && <DemoBanner />}
        <Onboarding />
        <PushAsk />
        {privateProfile && <PrivateNotice />}
        <Routes location={modal ? background : location}>
          <Route path="/" element={me.visitor ? <PublicHome /> : <Home />} />
          <Route path="/overview" element={<Navigate to="/" replace />} />
          <Route path="/games" element={me.visitor ? <VisitorGames /> : <Games />} />
          <Route path="/game" element={own(<Game />, '/game')} />
          <Route path="/nexo" element={<Nexo />} />
          <Route path="/goals" element={<Navigate to="/games?tab=goals" replace />} />
          <Route path="/discover" element={<DiscoverMoved />} />
          <Route path="/community" element={<Community />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/history" element={own(<History />, '/history')} />
          <Route path="/profile" element={own(<Profile />, '/profile')} />
          <Route path="/profiles/:user" element={<PublicProfile />} />
          <Route path="/settings" element={own(<Settings />, '/settings')} />
          <Route path="/title/*" element={<Title />} />
          {/* Signed in from the sign-in screen: back to the page that sent there. */}
          <Route
            path="/entrar"
            element={<Navigate to={nextAfterSignIn(location.search)} replace />}
          />
          {pluginPages.map((p) => (
            <Route key={p.path} path={p.path} element={own(<p.component />, p.path)} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {modal && <JourneyChat />}
        <NexoBubble />
      </main>
    </div>
  )
}
