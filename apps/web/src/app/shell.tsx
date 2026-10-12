/** The signed-in layout: sidebar, top bar and the screen for the current route. */
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router'
import { AccountMenu } from '../components/account-menu'
import { DemoBanner } from '../components/demo'
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
import { Discover } from '../pages/discover'
import { Game } from '../pages/game'
import { Goals } from '../pages/goals'
import { Guides } from '../pages/guides'
import { History } from '../pages/history'
import { Home } from '../pages/home'
import { Nexo } from '../pages/nexo'
import { Profile } from '../pages/profile'
import { Title } from '../pages/title'
import { Icon } from '../ui/icon'
import { PluginSlot, pluginModule } from '../ui/plugin-slot'
import { Sk } from '../ui/skeleton'
import { useApp } from './app-state'
import './shell.css'

const messages = defineMessages({
  [Language.PtBR]: {
    nav: {
      home: 'Visão geral',
      game: 'Jogo atual',
      nexo: 'Nexo',
      goals: 'Interesses',
      discover: 'Descobrir',
      guides: 'Guias',
      history: 'Histórico',
      profile: 'Meu perfil',
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
      home: 'Overview',
      game: 'Current game',
      nexo: 'Nexo',
      goals: 'Interests',
      discover: 'Discover',
      guides: 'Guides',
      history: 'History',
      profile: 'My profile',
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

const NAV: { to: string; label: MessageKey<typeof messages>; icon: string; ai?: boolean }[] = [
  { to: '/', label: 'nav.home', icon: 'dashboard' },
  { to: '/game', label: 'nav.game', icon: 'gamepad' },
  { to: '/nexo', label: 'nav.nexo', icon: 'nexo', ai: true },
  { to: '/goals', label: 'nav.goals', icon: 'bookmark' },
  { to: '/discover', label: 'nav.discover', icon: 'compass' },
  { to: '/guides', label: 'nav.guides', icon: 'search' },
  { to: '/history', label: 'nav.history', icon: 'history' },
]

// Links in the phone's bottom bar before "Mais".
const BAR_ITEMS = 4

const LABELS: Record<string, MessageKey<typeof messages>> = {
  '/': 'nav.home',
  '/game': 'nav.game',
  '/nexo': 'nav.nexo',
  '/goals': 'nav.goals',
  '/discover': 'nav.discover',
  '/guides': 'nav.guides',
  '/history': 'nav.history',
  '/profile': 'nav.profile',
}

/** How the screen was reached, for its entrance on a phone (page.css): `tab` between the menu's
 * screens fades, `push` into a deeper screen slides in from the right, `pop` (back) from the left. */
type Arrival = 'tab' | 'push' | 'pop'

function useArrival(pathname: string): Arrival {
  const type = useNavigationType()
  const previous = useRef(pathname)
  const arrival = useRef<Arrival>('tab')
  if (previous.current !== pathname) {
    const isTab = (path: string) =>
      path in LABELS || pluginModule.pages?.some((p) => p.path === path)
    arrival.current =
      type === 'POP' ? 'pop' : isTab(pathname) && isTab(previous.current) ? 'tab' : 'push'
    previous.current = pathname
  }
  return arrival.current
}

function Nav() {
  const t = useMessages(messages)
  const locale = useLocale()
  const nav = useRef<HTMLElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const { pathname } = useLocation()
  const animated = useRef(false)
  const [more, setMore] = useState(false)
  const { data } = useApp()

  // A pill slides behind the active link.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the active link changes with the route
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const el = indicator.current
      // On a phone a page from the "Mais" sheet has no visible link: the pill sits on "Mais".
      const link = nav.current?.querySelector<HTMLElement>('a.active')
      const active = link?.offsetWidth
        ? link
        : nav.current?.querySelector<HTMLElement>('.nav-more.active')
      if (!el) return
      if (!active?.offsetWidth) {
        el.style.opacity = '0'
        return
      }
      const first = !animated.current
      el.style.transition = first || !animate ? 'none' : ''
      el.style.width = `${active.offsetWidth}px`
      el.style.height = `${active.offsetHeight}px`
      el.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`
      el.style.opacity = '1'
      animated.current = true
      nav.current?.classList.add('nav-animated')
      if (first || !animate)
        requestAnimationFrame(() => {
          el.style.transition = ''
        })
    }
    place(true)
    const observer = new ResizeObserver(() => place(false))
    if (nav.current) observer.observe(nav.current)
    return () => observer.disconnect()
  }, [pathname, more])

  // On a phone the bar holds the first BAR_ITEMS links and "Mais"; the rest open in a sheet above it.
  const extras = [
    ...NAV.slice(BAR_ITEMS).map((n) => ({ to: n.to, icon: n.icon, label: t(n.label) })),
    ...(pluginModule.pages ?? []).map((p) => ({
      to: p.path,
      icon: p.icon,
      label: p.label[locale],
    })),
    { to: '/profile', icon: 'circle', label: t('nav.profile'), avatar: data?.profile?.avatarUrl },
  ] as { to: string; icon: string; label: string; avatar?: string }[]
  const inExtras = extras.some((e) => pathname === e.to)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new route closes the sheet
  useEffect(() => setMore(false), [pathname])
  return (
    <>
      <nav className="nav" aria-label={t('mainNav')} ref={nav}>
        <span className="nav-indicator" aria-hidden="true" ref={indicator} />
        {NAV.map((n, i) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={i >= BAR_ITEMS ? 'nav-extra' : undefined}
          >
            <Icon name={n.icon} />
            {t(n.label)}
            {n.ai && <span className="nav-ai">{t('ai')}</span>}
          </NavLink>
        ))}
        {pluginModule.pages?.map((p) => (
          <NavLink key={p.path} to={p.path} className="nav-extra">
            <Icon name={p.icon} />
            {p.label[locale]}
          </NavLink>
        ))}
        <button
          type="button"
          className={`nav-more${more || inExtras ? ' active' : ''}`}
          aria-expanded={more}
          aria-controls="nav-sheet"
          onClick={() => setMore((m) => !m)}
        >
          <Icon name={more ? 'close' : 'more'} />
          {t('nav.more')}
        </button>
      </nav>
      {/* On the body: the bar's backdrop filter would make it the box the sheet is fixed to. */}
      {more &&
        createPortal(
          <>
            <button
              type="button"
              className="nav-sheet-scrim"
              aria-label={t('nav.more')}
              onClick={() => setMore(false)}
            />
            <div className="nav-sheet" id="nav-sheet">
              <span className="nav-sheet-handle" aria-hidden="true" />
              <div className="nav-sheet-grid">
                {extras.map((e, i) => (
                  <NavLink key={e.to} to={e.to} style={{ '--i': i } as CSSProperties}>
                    <span className={`nav-sheet-icon${e.avatar ? ' is-avatar' : ''}`}>
                      {e.avatar ? <img src={e.avatar} alt="" /> : <Icon name={e.icon} />}
                    </span>
                    {e.label}
                  </NavLink>
                ))}
              </div>
              <span className="app-version">v{__APP_VERSION__}</span>
            </div>
          </>,
          document.body,
        )}
    </>
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
  const { pathname } = useLocation()
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
  const page = pluginModule.pages?.find((p) => p.path === pathname)
  const label = page
    ? page.label[locale]
    : t(isTitle ? 'nav.title' : (LABELS[pathname] ?? 'nav.home'))

  useEffect(() => {
    document.title = label
    window.scrollTo({ top: 0 })
  }, [label])

  useEffect(() => {
    const show = () => setPrivateProfile(true)
    document.addEventListener('api:private-profile', show)
    return () => document.removeEventListener('api:private-profile', show)
  }, [])

  return (
    <div className="app" id="app" data-arrival={arrival}>
      <aside className="sidebar">
        <Link className="logo" to="/" aria-label={t('logoLabel')}>
          <img className="brand-mark" src="/logo.svg" alt="" width="40" height="40" />
          <span className="brand-name">
            plat<span className="brand-accent">journey</span>
          </span>
        </Link>
        <div className="sidebar-scroll">
          <div className="nav-label">{t('yourSpace')}</div>
          <Nav />
          <Link className="sidebar-note" to="/nexo">
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
            {t('breadcrumb')} <span>/</span> <b id="route-label">{label}</b>
          </div>
          <div className="topbar-right">
            <PluginSlot name="top-bar" />
            <Notifications />
            <SyncButton />
            <AccountMenu />
          </div>
        </header>
        {me.demo && <DemoBanner />}
        <Onboarding />
        {privateProfile && <PrivateNotice />}
        <PullRefresh onRefresh={pullRefresh} />
        <Routes key={refreshes}>
          <Route path="/" element={<Home />} />
          <Route path="/game" element={<Game />} />
          <Route path="/nexo" element={<Nexo />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/title/*" element={<Title />} />
          {pluginModule.pages?.map((p) => (
            <Route key={p.path} path={p.path} element={<p.component />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
