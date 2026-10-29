/** First-visit introduction: the player's story told in full-screen slides, the way a year in review
 * is, from what PSN just gave us: trophies, platinums, hours, the rarest platinum, the pace by year,
 * the next platinum, and a closing card. A slide with nothing to say for this account is left out.
 * Shown once per account (once per browser session for the demo) and again from the profile. */
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../app/app-state'
import { useProfile } from '../app/use-profile'
import { defineMessages, getLocale, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { fmtRate, number } from '../lib/format'
import type { AppStateData, Me, ProfileSummary } from '../lib/types'
import type { ProfileData } from '../pages/profile'
import { BoldText } from '../ui/bold-text'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { InstallGuide, installGuideDue, installPlatform } from './install-guide'
import './onboarding.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'Sua história no PlatJourney',
    by: 'sua história',
    skip: 'Pular',
    prevSlide: 'Tela anterior',
    nextSlide: 'Próxima tela',
    hello: {
      eyebrow: 'PSN conectada',
      title: 'Achamos sua história, {name}.',
      trophies: 'troféus',
      syncing: 'Lendo seus troféus na PSN…',
    },
    tiers: {
      platinum: 'platina',
      gold: 'ouro',
      silver: 'prata',
      bronze: 'bronze',
    },
    platinums: {
      title: {
        one: '1 platina.',
        other: '{count} platinas.',
      },
      first: 'A primeira foi {first}, em {firstAt}.',
      span: 'A primeira foi {first}, em {firstAt}. A mais recente, {last}, em {lastAt}.',
    },
    hours: {
      eyebrow: 'Tempo de jogo',
      title: '{hours} horas',
      days: 'É como passar {days} dias seguidos com o controle na mão. Quem mais levou seu tempo:',
    },
    rarest: {
      eyebrow: 'Sua platina mais rara',
      share: 'dos jogadores têm essa platina. Você é um deles.',
    },
    pace: {
      eyebrow: 'Seu ritmo',
      best: '{year} foi o seu ano: {count} platinas.',
      chase: 'Em {year} você está a {gap} de igualar.',
      ahead: 'Em {year} você já igualou o seu melhor ano.',
      gap: {
        one: '1 platina',
        other: '{count} platinas',
      },
    },
    next: {
      eyebrow: 'Sua próxima platina',
      progress: '<b>{earned}</b> de {total} troféus',
      remaining: '<b>{count}</b> faltam',
      plan: 'O guia já divide o caminho em fases, e o Nexo acompanha cada troféu que você pegar.',
      go: 'Começar jornada',
    },
    card: {
      eyebrow: 'Seu cartão de caçador',
      role: 'Caçador de platinas',
      platinums: 'platinas',
      level: 'nível',
      rarest: 'mais rara',
      next: 'Próxima: {game}',
    },
    welcome: {
      eyebrow: 'Bem-vindo à jornada',
      title: 'Obrigado por chegar, {name}.',
      titleDemo: 'Obrigado por conhecer o PlatJourney.',
      lead: 'Sua história já está aqui. Agora é escolher a próxima platina e ir atrás dela, um troféu de cada vez. O Nexo vai junto.',
      go: 'Começar jornada',
    },
  },
  [Language.En]: {
    label: 'Your story on PlatJourney',
    by: 'your story',
    skip: 'Skip',
    prevSlide: 'Previous slide',
    nextSlide: 'Next slide',
    hello: {
      eyebrow: 'PSN connected',
      title: 'We found your story, {name}.',
      trophies: 'trophies',
      syncing: 'Reading your trophies on PSN…',
    },
    tiers: {
      platinum: 'platinum',
      gold: 'gold',
      silver: 'silver',
      bronze: 'bronze',
    },
    platinums: {
      title: {
        one: '1 platinum.',
        other: '{count} platinums.',
      },
      first: 'The first was {first}, in {firstAt}.',
      span: 'The first was {first}, in {firstAt}. The latest, {last}, in {lastAt}.',
    },
    hours: {
      eyebrow: 'Time played',
      title: '{hours} hours',
      days: "That's {days} days in a row with the controller in hand. What took most of it:",
    },
    rarest: {
      eyebrow: 'Your rarest platinum',
      share: 'of players have this platinum. You are one of them.',
    },
    pace: {
      eyebrow: 'Your pace',
      best: '{year} was your year: {count} platinums.',
      chase: 'In {year} you are {gap} away from matching it.',
      ahead: 'In {year} you have already matched your best year.',
      gap: {
        one: '1 platinum',
        other: '{count} platinums',
      },
    },
    next: {
      eyebrow: 'Your next platinum',
      progress: '<b>{earned}</b> of {total} trophies',
      remaining: '<b>{count}</b> to go',
      plan: 'The guide already splits the road into phases, and Nexo follows every trophy you get.',
      go: 'Start the journey',
    },
    card: {
      eyebrow: 'Your hunter card',
      role: 'Platinum hunter',
      platinums: 'platinums',
      level: 'level',
      rarest: 'rarest',
      next: 'Next: {game}',
    },
    welcome: {
      eyebrow: 'Welcome to the journey',
      title: 'Thanks for coming, {name}.',
      titleDemo: 'Thanks for checking out PlatJourney.',
      lead: 'Your story is here already. Now pick the next platinum and go after it, one trophy at a time. Nexo comes along.',
      go: 'Start the journey',
    },
  },
})

const DEMO_SEEN = 'platjourney:onboarding-demo'
/** Dispatch on document to show the introduction again (the profile does). */
export const OPEN_ONBOARDING = 'onboarding:open'

const sessionSeen = () => {
  try {
    return sessionStorage.getItem(DEMO_SEEN) === '1'
  } catch {
    return false
  }
}

/** Shows itself on the first visit; the demo keeps "seen" in the browser session, players on the server. */
export function Onboarding() {
  const { me, setMe, data, warming } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => (me.demo ? !sessionSeen() : !me.onboarded))
  const [installStep, setInstallStep] = useState(
    () => !me.demo && !me.onboarded && installGuideDue(),
  )
  const profile = useProfile(open)
  // The slides on the player's platinums need the profile: the first waits for it, a while at most.
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => setWaited(true), PROFILE_WAIT_MS)
    return () => clearTimeout(timer)
  }, [open])
  useEffect(() => {
    const show = () => setOpen(true)
    document.addEventListener(OPEN_ONBOARDING, show)
    return () => document.removeEventListener(OPEN_ONBOARDING, show)
  }, [])
  const done = useCallback(
    (to?: string) => {
      setOpen(false)
      if (to) navigate(to)
      if (me.demo) {
        try {
          sessionStorage.setItem(DEMO_SEEN, '1')
        } catch {}
        return
      }
      if (!me.onboarded) {
        setMe({ ...me, onboarded: true })
        api('/api/account/onboarded', {}).catch(() => {})
      }
    },
    [me, setMe, navigate],
  )
  if (!open) return null
  // On a phone, before the introduction: put the app on the home screen first.
  if (installStep) {
    const platform = installPlatform()
    if (platform) return <InstallGuide platform={platform} onDone={() => setInstallStep(false)} />
  }
  return (
    <Stories
      me={me}
      data={warming && !data?.current ? null : data}
      profile={profile}
      waiting={!profile && !waited}
      onDone={done}
    />
  )
}

const SLIDE_MS = 6500
// How long the first slide waits for the profile before the story goes on without it.
const PROFILE_WAIT_MS = 5000

type Platinum = ProfileData['platinums'][number]

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function CountUp({ to }: { to: number }) {
  const [shown, setShown] = useState(to)
  useEffect(() => {
    if (reduced() || to <= 0) {
      setShown(to)
      return
    }
    let frame = 0
    const start = performance.now() + 300
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / 1500))
      setShown(Math.round(to * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    setShown(0)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [to])
  return <>{number(shown)}</>
}

/** A slide's background: the game's art drifting in, or its cover blurred into a color. */
function Backdrop({ art, cover }: { art?: string | null; cover?: string | null }) {
  const src = art ?? cover
  return (
    <>
      <div className={`story-art${art ? '' : ' blur'}`} aria-hidden="true">
        {src && <img src={src} alt="" />}
      </div>
      <div className="story-shade" aria-hidden="true" />
    </>
  )
}

const rise = (d: number) => ({ '--d': d }) as CSSProperties

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' })

interface Slide {
  key: string
  body: ReactNode
  /** Waits here: the first slide while PSN is still being read, and the last one. */
  hold?: boolean
  center?: boolean
}

function Hello({
  me,
  summary,
  cover,
}: {
  me: Me
  summary?: ProfileSummary | null
  cover?: string | null
}) {
  const t = useMessages(messages)
  const s = summary
  const total = s ? s.earned.bronze + s.earned.silver + s.earned.gold + s.earned.platinum : 0
  return (
    <>
      <Backdrop cover={cover} />
      <div className="story-orbit" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: decorative sparks never reorder
            key={i}
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${30 + ((i * 37) % 60)}%`,
              animationDelay: `${((i * 0.37) % 6).toFixed(2)}s`,
            }}
          />
        ))}
      </div>
      <span className="eyebrow rise">{t('hello.eyebrow')}</span>
      <h2 className="story-mid rise" style={rise(1)}>
        {t('hello.title', { name: me.onlineId })}
      </h2>
      {s ? (
        <>
          <p className="story-big rise" style={rise(2)}>
            <CountUp to={total} />
            <span className="story-unit"> {t('hello.trophies')}</span>
          </p>
          <div className="story-tiers">
            {(['platinum', 'gold', 'silver', 'bronze'] as const).map((k, i) => (
              <div key={k} className={`story-tier ${k}`} style={{ '--i': i } as CSSProperties}>
                <Icon name="trophy" />
                <b>{number(s.earned[k])}</b>
                <span>{t(`tiers.${k}`)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <span className="story-sync rise" style={rise(2)} role="status">
          <span className="story-sync-bar" aria-hidden="true" />
          {t('hello.syncing')}
        </span>
      )}
    </>
  )
}

/** `newest` first; at least one. */
function Platinums({ newest }: { newest: Platinum[] }) {
  const t = useMessages(messages)
  const last = newest[0]
  const first = newest[newest.length - 1]
  return (
    <>
      <Backdrop cover={last.game.cover_url} />
      <div className="story-wall" aria-hidden="true">
        <div className="story-wall-in">
          {newest.slice(0, 15).map((p, i) => (
            <span
              key={p.game.id}
              className="story-wall-cover"
              style={{ '--n': i } as CSSProperties}
            >
              <Cover url={p.game.cover_url} name={p.game.name} />
            </span>
          ))}
        </div>
      </div>
      <h2 className="story-big rise" style={rise(3)}>
        <span className="story-shine">{t('platinums.title', { count: newest.length })}</span>
      </h2>
      <p className="story-say rise" style={rise(4)}>
        {newest.length === 1
          ? t('platinums.first', { first: first.game.name, firstAt: monthYear(first.earnedAt) })
          : t('platinums.span', {
              first: first.game.name,
              firstAt: monthYear(first.earnedAt),
              last: last.game.name,
              lastAt: monthYear(last.earnedAt),
            })}
      </p>
    </>
  )
}

function Hours({ profile }: { profile: ProfileData }) {
  const t = useMessages(messages)
  const played = profile.mostPlayed.slice(0, 3)
  const top = played[0]?.hours || 1
  return (
    <>
      <Backdrop art={played[0]?.game.art_url} cover={played[0]?.game.cover_url} />
      <span className="eyebrow rise">{t('hours.eyebrow')}</span>
      <h2 className="story-big rise" style={rise(1)}>
        {t('hours.title', { hours: number(profile.totalHours) })}
      </h2>
      <p className="story-say rise" style={rise(2)}>
        {t('hours.days', { days: number(Math.round(profile.totalHours / 24)) })}
      </p>
      <div className="story-played rise" style={rise(3)}>
        {played.map((m) => (
          <div key={m.game.id}>
            <Cover url={m.game.cover_url} name={m.game.name} />
            <span>
              {m.game.name}
              <span className="story-track">
                <i style={{ width: `${(m.hours / top) * 100}%` }} />
              </span>
            </span>
            <b>{number(Math.round(m.hours))}h</b>
          </div>
        ))}
      </div>
    </>
  )
}

function Rarest({ rarest }: { rarest: Platinum }) {
  const t = useMessages(messages)
  return (
    <>
      <Backdrop art={rarest.game.art_url} cover={rarest.game.cover_url} />
      <span className="eyebrow rise">{t('rarest.eyebrow')}</span>
      <h2 className="story-mid rise" style={rise(1)}>
        {rarest.game.name}
      </h2>
      <p className="story-rare rise" style={rise(2)}>
        <span className="story-shine">{fmtRate(rarest.rarity)}%</span>
      </p>
      <p className="story-say rise" style={rise(3)}>
        {t('rarest.share')}
      </p>
      {rarest.trophyName && (
        <span className="story-trophy rise" style={rise(4)}>
          <Icon name="trophy" />
          {rarest.trophyName} · {monthYear(rarest.earnedAt)}
        </span>
      )}
    </>
  )
}

/** The last years with platinums, at least two; `backdrop` paints behind them. */
function Pace({ years, backdrop }: { years: ProfileData['byYear']; backdrop?: Platinum }) {
  const t = useMessages(messages)
  const best = years.reduce((a, b) => (b.count >= a.count ? b : a))
  const max = best.count || 1
  const now = years[years.length - 1]
  const gap = best.count - now.count
  return (
    <>
      <Backdrop art={backdrop?.game.art_url} cover={backdrop?.game.cover_url} />
      <span className="eyebrow rise">{t('pace.eyebrow')}</span>
      <h2 className="story-mid rise" style={rise(1)}>
        {t('pace.best', { year: best.year, count: best.count })}
      </h2>
      <div className="story-years">
        {years.map((y, i) => (
          <div
            key={y.year}
            className={y === best ? 'best' : ''}
            style={{ '--i': i } as CSSProperties}
          >
            <b>{y.count}</b>
            <i style={{ height: `${Math.max(6, (y.count / max) * 100)}%` }} />
            <span>{y.year}</span>
          </div>
        ))}
      </div>
      {now !== best && (
        <p className="story-say rise" style={rise(3)}>
          {gap > 0
            ? t('pace.chase', { year: now.year, gap: t('pace.gap', { count: gap }) })
            : t('pace.ahead', { year: now.year })}
        </p>
      )}
    </>
  )
}

/** The next platinum, as the slides tell it: the game played, else the closest one on the radar. */
interface NextGame {
  name: string
  art?: string | null
  cover?: string | null
  earned: number
  total: number
  remaining: number
  to: string
}

function nextGame(data: AppStateData | null): NextGame | null {
  const c = data?.current
  if (c)
    return {
      name: c.name,
      art: c.icon,
      cover: c.game.cover_url,
      earned: c.groups?.base.earned ?? c.earned,
      total: c.groups?.base.total ?? c.total,
      remaining: c.groups?.base.remaining ?? Math.max(0, c.total - c.earned - 1),
      to: '/game',
    }
  const r = data?.ranking[0]
  return r
    ? {
        name: r.name,
        art: r.art,
        cover: r.cover,
        earned: r.earned,
        total: r.total,
        remaining: r.remaining,
        to: '/',
      }
    : null
}

function Next({ game, onGo }: { game: NextGame; onGo: () => void }) {
  const t = useMessages(messages)
  return (
    <>
      <Backdrop art={game.art} cover={game.cover} />
      <span className="eyebrow rise">{t('next.eyebrow')}</span>
      <h2 className="story-big rise" style={rise(1)}>
        {game.name}
      </h2>
      <div className="story-next rise" style={rise(2)}>
        <span>
          <BoldText text={t('next.progress', { earned: game.earned, total: game.total })} />
        </span>
        <span>
          <BoldText text={t('next.remaining', { count: game.remaining })} />
        </span>
      </div>
      <p className="story-say rise" style={rise(3)}>
        {t('next.plan')}
      </p>
      <div className="story-row rise" style={rise(4)}>
        <button type="button" className="button" onClick={onGo}>
          {t('next.go')} <Icon name="arrow" />
        </button>
      </div>
    </>
  )
}

function HunterCard({
  me,
  summary: s,
  newest,
  rarest,
  next,
}: {
  me: Me
  summary: ProfileSummary
  newest: Platinum[]
  rarest?: Platinum | null
  next?: string
}) {
  const t = useMessages(messages)
  return (
    <>
      <Backdrop cover={rarest?.game.cover_url ?? newest[0]?.game.cover_url} />
      <span className="eyebrow rise story-center">{t('card.eyebrow')}</span>
      <div className="story-card">
        <header>
          <img src={s.avatarUrl || '/logo.svg'} alt="" />
          <div>
            <b>{me.onlineId}</b>
            <span>{t('card.role')}</span>
          </div>
        </header>
        <div className="story-stats">
          <div>
            <b className="plat">{number(s.earned.platinum)}</b>
            <span>{t('card.platinums')}</span>
          </div>
          <div>
            <b>{s.level}</b>
            <span>{t('card.level')}</span>
          </div>
          {rarest && (
            <div>
              <b className="plat">{fmtRate(rarest.rarity)}%</b>
              <span>{t('card.rarest')}</span>
            </div>
          )}
        </div>
        {newest.length > 0 && (
          <div className="story-strip">
            {newest.slice(0, 6).map((p) => (
              <Cover key={p.game.id} url={p.game.cover_url} name={p.game.name} />
            ))}
          </div>
        )}
        <footer>
          <span>{next ? t('card.next', { game: next }) : ''}</span>
          <b>platjourney</b>
        </footer>
      </div>
    </>
  )
}

/** The last word: thanks for coming, and the way into the app. */
function Welcome({ me, onGo }: { me: Me; onGo: () => void }) {
  const t = useMessages(messages)
  return (
    <>
      <div className="story-orbit" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: decorative sparks never reorder
            key={i}
            style={{
              left: `${(i * 41) % 100}%`,
              top: `${10 + ((i * 29) % 80)}%`,
              animationDelay: `${((i * 0.29) % 5).toFixed(2)}s`,
            }}
          />
        ))}
      </div>
      <img className="story-welcome-nexo rise story-center" src="/nexo-avatar.svg" alt="" />
      <span className="eyebrow rise story-center" style={rise(1)}>
        {t('welcome.eyebrow')}
      </span>
      <h2 className="story-mid rise story-center" style={rise(2)}>
        {me.demo ? t('welcome.titleDemo') : t('welcome.title', { name: me.onlineId })}
      </h2>
      <p className="story-lead rise story-center" style={rise(3)}>
        {t('welcome.lead')}
      </p>
      <div className="story-row story-center rise" style={rise(4)}>
        <button type="button" className="button" onClick={onGo}>
          {t('welcome.go')} <Icon name="arrow" />
        </button>
      </div>
    </>
  )
}

/** The slides this account has something to say on, in order. */
function slidesFor(
  me: Me,
  data: AppStateData | null,
  profile: ProfileData | null,
  onDone: (to?: string) => void,
  waiting = false,
): Slide[] {
  const summary = data?.profile
  const newest = [...(profile?.platinums ?? [])].sort((a, b) =>
    b.earnedAt.localeCompare(a.earnedAt),
  )
  const rarest = profile?.rarest
  const years = (profile?.byYear ?? []).slice(-4)
  const next = nextGame(data)
  const slides: (Slide | false | null | undefined)[] = [
    {
      key: 'hello',
      hold: !summary || waiting,
      body: <Hello me={me} summary={summary} cover={newest[0]?.game.cover_url ?? next?.cover} />,
    },
    newest.length > 0 && { key: 'platinums', body: <Platinums newest={newest} /> },
    profile &&
      profile.totalHours > 0 &&
      profile.mostPlayed.length > 0 && {
        key: 'hours',
        body: <Hours profile={profile} />,
      },
    rarest && { key: 'rarest', body: <Rarest rarest={rarest} /> },
    years.length >= 2 && {
      key: 'pace',
      body: <Pace years={years} backdrop={newest.find((p) => p.game.art_url) ?? newest[0]} />,
    },
    next && { key: 'next', body: <Next game={next} onGo={() => onDone(next.to)} /> },
    summary && {
      key: 'card',
      center: true,
      body: (
        <HunterCard me={me} summary={summary} newest={newest} rarest={rarest} next={next?.name} />
      ),
    },
    {
      key: 'welcome',
      hold: true,
      center: true,
      body: <Welcome me={me} onGo={() => onDone(next?.to ?? '/')} />,
    },
  ]
  return slides.filter((s): s is Slide => !!s)
}

/** The slides, one at a time: each moves on by itself, or with a tap on either side, or the arrows. */
export function Stories({
  me,
  data,
  profile,
  waiting = false,
  onDone,
}: {
  me: Me
  /** Null while the first PSN sync runs: the first slide waits for it. */
  data: AppStateData | null
  profile: ProfileData | null
  /** The profile is on its way: the first slide holds until it lands. */
  waiting?: boolean
  onDone: (to?: string) => void
}) {
  const t = useMessages(messages)
  const ref = useRef<HTMLDialogElement>(null)
  const slides = slidesFor(me, data, profile, onDone, waiting)
  const [at, setAt] = useState(0)
  const [progress, setProgress] = useState(0)
  const index = Math.min(at, slides.length - 1)
  const slide = slides[index]
  const go = useCallback(
    (by: number) => setAt((i) => Math.max(0, Math.min(slides.length - 1, i + by))),
    [slides.length],
  )

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
  }, [])

  // The bar of the slide on screen fills up; full, the next one comes.
  const hold = slide.hold === true
  // biome-ignore lint/correctness/useExhaustiveDependencies: restarts on every slide.
  useEffect(() => {
    setProgress(0)
    if (hold) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / SLIDE_MS)
      setProgress(p)
      if (p >= 1) go(1)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [index, hold, go])

  return (
    <dialog
      ref={ref}
      className="stories"
      aria-label={t('label')}
      onCancel={(e) => {
        e.preventDefault()
        onDone()
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
    >
      <div className="story-phone">
        <div className="story-bars" aria-hidden="true">
          {slides.map((s, i) => (
            <span key={s.key}>
              <i
                style={{
                  width: `${i < index ? 100 : i === index ? (hold ? 100 : progress * 100) : 0}%`,
                }}
              />
            </span>
          ))}
        </div>
        <div className="story-top">
          <span className="story-who">
            <img src="/logo.svg" alt="" width="26" height="26" />
            PlatJourney <small>{t('by')}</small>
          </span>
          <button type="button" className="ghost sm" onClick={() => onDone()}>
            {t('skip')}
          </button>
        </div>
        <button
          type="button"
          className="story-tap prev"
          aria-label={t('prevSlide')}
          onClick={() => go(-1)}
        />
        <button
          type="button"
          className="story-tap next"
          aria-label={t('nextSlide')}
          onClick={() => go(1)}
        />
        {slides.map((s, i) => (
          <section
            key={s.key}
            className={`story-slide${i === index ? ' on' : ''}${s.center ? ' center' : ''}`}
            aria-hidden={i !== index}
          >
            {/* Only the slide on screen is mounted, so its animations and counters start with it. */}
            {i === index && s.body}
          </section>
        ))}
      </div>
    </dialog>
  )
}
