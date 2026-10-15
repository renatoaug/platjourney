/** First-visit introduction: a full-screen welcome with the player's numbers, then a tour that opens Jogo atual, Guias, Nexo and Interesses with the explanation beside each page. Shown once per account (once per browser session for the demo) and again from the profile. */
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { number } from '../lib/format'
import type { AppStateData, Me } from '../lib/types'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { InstallGuide, installGuideDue, installPlatform } from './install-guide'
import './onboarding.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'Introdução ao PlatJourney',
    skip: 'Pular',
    back: 'Voltar',
    next: 'Avançar',
    start: 'Começar a caçada',
    tour: 'Começar o tour',
    tourHint: '{count} paradas rápidas, menos de dois minutos.',
    phase: 'FASE {n}/{total}',
    goTo: 'Ir para a fase {n}',
    expand: 'Abrir o tour, fase {n} de {total}: {title}',
    xp: '+{xp} XP',
    welcome: {
      eyebrow: 'NOVA JORNADA DESBLOQUEADA',
      title: 'Boas-vindas, {name}.',
      body: 'Sua conta da PSN já está conectada. O PlatJourney lê seus troféus sozinho, a cada 15 minutos: você joga, a gente organiza a caçada. Bora ver como usar?',
      level: 'Nível',
      platinums: 'Platinas',
      trophies: 'Troféus',
      syncing: 'Sincronizando seus troféus com a PSN…',
      ready: 'Tudo pronto: {game} é o seu jogo atual.',
      readyNoGame: 'Sincronizado. Assim que você jogar algo, ele aparece aqui.',
      wait: 'Sincronizando…',
    },
    home: {
      eyebrow: 'SEU PAINEL',
      title: 'Comece sempre por aqui.',
      body: 'A Visão geral junta o que importa hoje: a sua jornada atual, a última orientação do Nexo, os jogos mais perto da platina e os lançamentos que estão chegando. Em qualquer tela, a busca no topo acha um jogo (no computador, ⌘K ou Ctrl+K).',
      journey: 'Sua jornada atual',
      nexo: 'A última orientação do Nexo',
      next: 'Suas próximas platinas',
      releases: 'Os lançamentos que estão chegando',
    },
    radar: {
      eyebrow: 'RADAR LIGADO',
      title: 'Ele sabe o que você está jogando.',
      body: 'Abriu um jogo no PS5 ou no PS4? Em até 15 minutos ele vira o seu jogo atual, com progresso, guia e troféus. Para atualizar na hora, use o botão de sincronizar no topo.',
      noGame: 'Jogue algo e ele aparece aqui.',
      progress: '{earned} de {total} troféus',
    },
    notices: {
      eyebrow: 'O NEXO JOGA JUNTO',
      title: 'Dicas enquanto você joga.',
      body: 'Sem você pedir, o Nexo acompanha a sessão: avisa o que focar quando você começa um jogo, e comenta cada troféu desbloqueado com o próximo passo. Tudo chega no sininho e, se você conectar, no Telegram.',
      start: 'Começou Days Gone: pegue os colecionáveis do capítulo 1 antes de avançar.',
      unlock: 'Troféu Corcel Fiel! O próximo mais perto é Mestre das Hordas.',
    },
    trophies: {
      eyebrow: 'CADA TROFÉU, EXPLICADO',
      title: 'O que falta, e como fazer.',
      body: 'Na lista de troféus, filtre o que falta e toque em Pedir dica para o Nexo explicar um troféu específico. Ao lado, o guia da platina: roteiro, perdíveis antes que seja tarde e os troféus mais difíceis.',
      trophy: 'Mestre das Hordas',
      ask: 'Pedir dica',
      roadmap: 'Roteiro em fases',
      missables: 'Perdíveis',
    },
    plan: {
      eyebrow: 'ROTEIRO DA SESSÃO',
      title: 'Quanto tempo você tem hoje?',
      body: 'Antes de jogar, diga quanto tempo tem e o Nexo monta a sessão: os troféus que cabem nesse tempo, na ordem certa, com a dica de cada um. Durante o jogo, você marca o que fez.',
      demoBody:
        'Antes de jogar, diga quanto tempo tem e o Nexo monta a sessão: os troféus que cabem nesse tempo, na ordem certa, com a dica de cada um. Na demonstração, um roteiro pronto mostra como fica.',
      time: '2 horas',
      step1: 'Corcel Fiel · vínculo com o cavalo',
      step2: 'Missão do acampamento',
      step3: 'Colecionável do capítulo 2',
    },
    nexo: {
      eyebrow: 'PARCEIRO DESBLOQUEADO',
      title: 'Pergunte ao Nexo.',
      body: 'Travou? Pergunte qualquer coisa sobre o jogo atual: onde fica um colecionável, qual troféu fazer agora, como contornar um bug. Ele responde com o guia daquele jogo.',
      demoBody:
        'Travou? Pergunte qualquer coisa sobre o jogo atual: onde fica um colecionável, qual troféu fazer agora, como contornar um bug. Na demonstração, o chat mostra conversas de exemplo.',
      question: 'Tem algum troféu perdível no capítulo em que estou?',
      answer: 'Tem 2. Faça a missão do acampamento antes de avançar a história.',
    },
    guides: {
      eyebrow: 'MAPA DA PLATINA',
      title: 'Antes de comprar, consulte.',
      body: 'Em Guias você busca qualquer jogo e filtra por dificuldade, horas até a platina, sem perdíveis, uma jogada só, sem online e gênero, antes mesmo de ter o jogo.',
      search: 'Elden Ring',
      meta: '6/10 · ~80h · perdíveis',
    },
    discover: {
      eyebrow: 'PRÓXIMA FASE',
      title: 'Qual vai ser a próxima platina?',
      body: 'Descobrir mostra o que da sua biblioteca está mais perto da platina e recomenda jogos pelo seu gosto e pelo que você já platinou, com o porquê de cada um.',
      demoBody:
        'Descobrir mostra o que da sua biblioteca está mais perto da platina e recomenda jogos pelo seu gosto e pelo que você já platinou. Na demonstração, as recomendações já vêm prontas.',
      match: 'combina',
    },
    goals: {
      eyebrow: 'METAS',
      title: 'Sua missão do ano.',
      body: 'Em Interesses, defina quantas platinas quer no ano e salve os próximos jogos na ordem em que pretende jogar. O anel acompanha seu ritmo, e a gente avisa quando um jogo salvo entra em promoção ou no seu PS Plus.',
      goal: 'Meta {year}',
    },
    profile: {
      eyebrow: 'SEU QG',
      title: 'Ajuste do seu jeito.',
      body: 'No seu perfil, conecte o Telegram para receber as dicas do Nexo e conversar com ele pelo celular, diga qual é o seu PS Plus e escolha se o progresso conta as DLCs.',
      demoBody:
        'No seu perfil, conecte o Telegram para receber as dicas do Nexo pelo celular, diga qual é o seu PS Plus e escolha se o progresso conta as DLCs. Na demonstração, as configurações ficam travadas.',
      telegram: 'Telegram',
      connect: 'Conectar',
      dlc: 'Contar DLCs',
    },
  },
  [Language.En]: {
    label: 'Introduction to PlatJourney',
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    start: 'Start the hunt',
    tour: 'Start the tour',
    tourHint: '{count} quick stops, under two minutes.',
    phase: 'PHASE {n}/{total}',
    goTo: 'Go to phase {n}',
    expand: 'Open the tour, phase {n} of {total}: {title}',
    xp: '+{xp} XP',
    welcome: {
      eyebrow: 'NEW JOURNEY UNLOCKED',
      title: 'Welcome, {name}.',
      body: 'Your PSN account is connected. PlatJourney reads your trophies on its own, every 15 minutes: you play, we organise the hunt. Ready to see how to use it?',
      level: 'Level',
      platinums: 'Platinums',
      trophies: 'Trophies',
      syncing: 'Syncing your trophies with PSN…',
      ready: 'All set: {game} is your current game.',
      readyNoGame: 'Synced. As soon as you play something, it shows up here.',
      wait: 'Syncing…',
    },
    home: {
      eyebrow: 'YOUR DASHBOARD',
      title: 'Always start here.',
      body: 'The Overview brings together what matters today: your current journey, Nexo’s latest guidance, the games closest to the platinum and the releases coming up. On any screen, the search at the top finds a game (on a computer, ⌘K or Ctrl+K).',
      journey: 'Your current journey',
      nexo: 'Nexo’s latest guidance',
      next: 'Your next platinums',
      releases: 'The releases coming up',
    },
    radar: {
      eyebrow: 'RADAR ON',
      title: 'It knows what you are playing.',
      body: 'Started a game on PS5 or PS4? Within 15 minutes it becomes your current game, with progress, guide and trophies. To update right away, use the sync button at the top.',
      noGame: 'Play something and it shows up here.',
      progress: '{earned} of {total} trophies',
    },
    notices: {
      eyebrow: 'NEXO PLAYS ALONG',
      title: 'Tips while you play.',
      body: 'Without you asking, Nexo follows the session: it says what to focus on when you start a game, and comments on every trophy you unlock with the next step. It all arrives under the bell and, if you connect it, on Telegram.',
      start: 'Started Days Gone: grab chapter 1’s collectibles before moving on.',
      unlock: 'Loyal Steed unlocked! The closest one now is Horde Master.',
    },
    trophies: {
      eyebrow: 'EVERY TROPHY, EXPLAINED',
      title: 'What is left, and how.',
      body: 'In the trophy list, filter what is left and tap Ask for a tip to have Nexo explain one trophy. Next to it, the platinum guide: a roadmap, missables before it is too late and the hardest trophies.',
      trophy: 'Horde Master',
      ask: 'Ask for a tip',
      roadmap: 'Roadmap in phases',
      missables: 'Missables',
    },
    plan: {
      eyebrow: 'SESSION ROUTE',
      title: 'How much time do you have today?',
      body: 'Before playing, say how long you have and Nexo builds the session: the trophies that fit that time, in the right order, with a tip for each. While you play, you tick what you did.',
      demoBody:
        'Before playing, say how long you have and Nexo builds the session: the trophies that fit that time, in the right order, with a tip for each. In the demo, a ready route shows how it looks.',
      time: '2 hours',
      step1: 'Loyal Steed · bond with the horse',
      step2: 'The camp mission',
      step3: 'A chapter 2 collectible',
    },
    nexo: {
      eyebrow: 'PARTNER UNLOCKED',
      title: 'Ask Nexo.',
      body: 'Stuck? Ask anything about the current game: where a collectible is, which trophy to go for now, how to get around a bug. It answers from that game’s guide.',
      demoBody:
        'Stuck? Ask anything about the current game: where a collectible is, which trophy to go for now, how to get around a bug. In the demo, the chat shows sample conversations.',
      question: 'Is there a missable trophy in the chapter I am in?',
      answer: 'There are 2. Do the camp mission before moving the story on.',
    },
    guides: {
      eyebrow: 'PLATINUM MAP',
      title: 'Check before you buy.',
      body: 'In Guides you search any game and filter by difficulty, hours to the platinum, no missables, one playthrough, no online and genre, even before you own it.',
      search: 'Elden Ring',
      meta: '6/10 · ~80h · missables',
    },
    discover: {
      eyebrow: 'NEXT LEVEL',
      title: 'What will the next platinum be?',
      body: 'Discover shows what in your library is closest to the platinum and recommends games for your taste and for what you have already platinumed, with why each one fits.',
      demoBody:
        'Discover shows what in your library is closest to the platinum and recommends games for your taste and for what you have already platinumed. In the demo, the picks come ready.',
      match: 'match',
    },
    goals: {
      eyebrow: 'GOALS',
      title: 'Your mission of the year.',
      body: 'In Interests, set how many platinums you want this year and save your next games in the order you mean to play them. The ring follows your pace, and we tell you when a saved game goes on sale or joins your PS Plus.',
      goal: 'Goal {year}',
    },
    profile: {
      eyebrow: 'YOUR BASE',
      title: 'Make it yours.',
      body: 'On your profile, connect Telegram to get Nexo’s tips and talk to it from your phone, tell us your PS Plus tier and choose whether progress counts DLC.',
      demoBody:
        'On your profile, connect Telegram to get Nexo’s tips on your phone, tell us your PS Plus tier and choose whether progress counts DLC. In the demo, the settings are locked.',
      telegram: 'Telegram',
      connect: 'Connect',
      dlc: 'Count DLC',
    },
  },
})

const PHASES = [
  'welcome',
  'home',
  'radar',
  'notices',
  'trophies',
  'plan',
  'nexo',
  'guides',
  'discover',
  'goals',
  'profile',
] as const
type Phase = (typeof PHASES)[number]

/** The stops this player's screens can show: without a game being played there is no trophy list
 or session route to point at. */
function phasesFor(data: AppStateData | null): Phase[] {
  return PHASES.filter((p) => !(data && !data.current && (p === 'trophies' || p === 'plan')))
}
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

// The phases after the welcome open their own screen: the tab is selected in the navigation and the
// explanation sits beside the page.
const ROUTES: Record<Exclude<Phase, 'welcome'>, string> = {
  home: '/',
  radar: '/game',
  notices: '/game',
  trophies: '/game',
  plan: '/game',
  nexo: '/nexo',
  guides: '/guides',
  discover: '/discover',
  goals: '/goals',
  profile: '/profile',
}
// Stops whose text changes in the demo, where those features only show stored examples.
const DEMO_TEXT: Phase[] = ['plan', 'nexo', 'discover', 'profile']
// Parts of a page the stop talks about: they glow too, and the first is scrolled into view.
const SPOTS: Partial<Record<Exclude<Phase, 'welcome'>, string[]>> = {
  home: ['#home-hero', '#home-nexo'],
  radar: ['#game-hero', '#refresh-state'],
  notices: ['#notif-button'],
  trophies: ['#trophies-card', '#guide-card'],
  plan: ['#plan-card'],
  profile: ['#telegram-card', '#preferences-card'],
}

/** Shows itself on the first visit; the demo keeps "seen" in the browser session, players on the server. */
export function Onboarding() {
  const { me, setMe, data, warming } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => (me.demo ? !sessionSeen() : !me.onboarded))
  const [step, setStep] = useState(0)
  const [phases, setPhases] = useState<readonly Phase[]>(PHASES)
  const [installStep, setInstallStep] = useState(
    () => !me.demo && !me.onboarded && installGuideDue(),
  )
  useEffect(() => {
    const show = () => {
      setStep(0)
      setOpen(true)
    }
    document.addEventListener(OPEN_ONBOARDING, show)
    return () => document.removeEventListener(OPEN_ONBOARDING, show)
  }, [])
  const done = useCallback(
    (home: boolean) => {
      setOpen(false)
      if (home) navigate('/')
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
  if (step === 0 && installStep) {
    const platform = installPlatform()
    if (platform) return <InstallGuide platform={platform} onDone={() => setInstallStep(false)} />
  }
  if (step === 0)
    return (
      <WelcomeDialog
        me={me}
        data={data}
        onStart={() => {
          setPhases(phasesFor(data))
          setStep(1)
        }}
        onSkip={() => done(false)}
        warming={warming && !data?.current}
      />
    )
  return <Tour step={step} setStep={setStep} me={me} data={data} onDone={done} phases={phases} />
}

// The closing sparks play before the introduction goes; without motion it goes at once.
// `home` says whether the player finished the tour (and goes to the overview) or skipped it.
function useLeaving(onDone: (home: boolean) => void) {
  const [leaving, setLeaving] = useState(false)
  const leave = useCallback(
    (home = false) => {
      setLeaving(true)
      const quick = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      window.setTimeout(() => onDone(home), quick ? 0 : 650)
    },
    [onDone],
  )
  return { leaving, leave }
}

function XpBar({ step, phases }: { step: number; phases: readonly Phase[] }) {
  return (
    <div className="onb-xp" aria-hidden="true">
      {phases.map((p, i) => (
        <span key={p} className={i <= step ? 'on' : ''} />
      ))}
    </div>
  )
}

function SyncLine({ warming, game }: { warming: boolean; game?: string }) {
  const t = useMessages(messages)
  if (warming)
    return (
      <span className="onb-sync" role="status">
        <span className="onb-sync-bar" aria-hidden="true" />
        {t('welcome.syncing')}
      </span>
    )
  return (
    <span className="onb-sync onb-sync-done" role="status">
      <Icon name="check" /> {game ? t('welcome.ready', { game }) : t('welcome.readyNoGame')}
    </span>
  )
}

function Burst() {
  return (
    <div className="onb-burst" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: decorative sparks never reorder
        <i key={i} style={{ '--a': `${(360 / 14) * i}deg` } as CSSProperties} />
      ))}
    </div>
  )
}

/** Phase 1, the only full-screen one: who the player is, then the tour starts. */
export function WelcomeDialog({
  me,
  data,
  onStart,
  onSkip,
  warming = false,
}: {
  me: Me
  data: AppStateData | null
  onStart: () => void
  onSkip: () => void
  /** The first PSN sync is still running: the tour waits for it, so its stops fit the account. */
  warming?: boolean
}) {
  const t = useMessages(messages)
  const ref = useRef<HTMLDialogElement>(null)
  const { leaving, leave } = useLeaving(onSkip)
  const phases = phasesFor(data)
  const syncing = warming || !data
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`onb${leaving ? ' onb-leaving' : ''}`}
      aria-label={t('label')}
      onCancel={(e) => {
        e.preventDefault()
        // While the first sync runs there is nothing to skip to yet.
        if (!syncing) leave()
      }}
    >
      <div className="onb-grid" aria-hidden="true" />
      <div className="onb-card">
        <header className="onb-top">
          <XpBar step={0} phases={phases} />
          {!syncing && (
            <button type="button" className="ghost sm onb-skip" onClick={() => leave()}>
              {t('skip')}
            </button>
          )}
        </header>
        <div className="onb-body">
          <div className="onb-stage" aria-hidden="true">
            <Stage phase="welcome" me={me} data={data} />
          </div>
          <div className="onb-copy">
            <span className="onb-phase">{t('phase', { n: 1, total: phases.length })}</span>
            <span className="eyebrow">{t('welcome.eyebrow')}</span>
            <h2>{t('welcome.title', { name: me.onlineId })}</h2>
            <p>{t('welcome.body')}</p>
            <SyncLine warming={syncing} game={data?.current?.name} />
          </div>
        </div>
        <footer className="onb-controls">
          <span className="onb-hint">{t('tourHint', { count: phases.length - 1 })}</span>
          <div className="onb-nav">
            <button type="button" className="button" onClick={onStart} disabled={warming || !data}>
              {syncing ? (
                t('welcome.wait')
              ) : (
                <>
                  {t('tour')} <Icon name="arrow-right" />
                </>
              )}
            </button>
          </div>
        </footer>
        {leaving && <Burst />}
      </div>
    </dialog>
  )
}

// How far the player scrolls, in px, before the card folds on a phone.
const FOLD_AFTER = 40

/** Phases 2 to 5: each opens its screen, selects its tab and explains it in a card beside the page. */
export function Tour({
  step,
  setStep,
  me,
  data,
  onDone,
  phases = phasesFor(data),
}: {
  step: number
  setStep: (step: number) => void
  me: Me
  data: AppStateData | null
  onDone: (home: boolean) => void
  /** Fixed when the tour starts, so data arriving midway does not move the stops. */
  phases?: readonly Phase[]
}) {
  const t = useMessages(messages)
  const navigate = useNavigate()
  const phase = phases[step] as Exclude<Phase, 'welcome'>
  const route = ROUTES[phase]
  const last = step === phases.length - 1
  const { leaving, leave } = useLeaving(onDone)
  const [place, setPlace] = useState<{ left?: number; bottom?: boolean } | null>(null)
  // On a phone the card folds into a small bar once the player scrolls, so the page behind can be
  // seen whole; a tap opens it again. Each phase starts open.
  const [foldedAt, setFoldedAt] = useState<number | null>(null)
  const folded = foldedAt === step
  const go = (to: number) => setStep(Math.max(1, Math.min(phases.length - 1, to)))

  useEffect(() => {
    if (!place || folded || window.innerWidth > 760) return
    let from = window.scrollY
    // The phase scrolls its parts into view first: wait for that before watching the player.
    const start = window.setTimeout(() => {
      from = window.scrollY
      window.addEventListener('scroll', fold, { passive: true })
    }, 400)
    const fold = () => {
      if (Math.abs(window.scrollY - from) > FOLD_AFTER) setFoldedAt(step)
    }
    return () => {
      window.clearTimeout(start)
      window.removeEventListener('scroll', fold)
    }
  }, [place, folded, step])

  useEffect(() => {
    navigate(route)
  }, [navigate, route])

  // While touring, the app behind only shows: no clicks, focus or keys reach it. The card lives
  // outside it (a portal on the body), so its buttons keep working; the page still scrolls.
  useEffect(() => {
    const app = document.getElementById('app')
    app?.setAttribute('inert', '')
    return () => app?.removeAttribute('inert')
  }, [])

  // The tab of this phase glows in the navigation while the page behind is quieter.
  useEffect(() => {
    setPlace(null)
    document.body.classList.add('touring')
    let lit: Element[] = []
    let page: Element | null = null
    let tries = 0
    let timer = 0
    // The page may still be loading its data: look again for a moment until its parts are there.
    const light = () => {
      const tab = document.querySelector(
        route === '/profile' ? '#profile' : `.nav a[href$="${route}"]`,
      )
      const parts = (SPOTS[phase] ?? []).map((s) => document.querySelector(s))
      // The screen of this stop, not the one leaving: it renders a moment after the route changes.
      const screen = document.querySelector(`#main-content .page[data-page="${route}"]`)
      // Outside the app (a story, a test) there is no page to wait for.
      const inApp = !!document.getElementById('main-content')
      if (inApp && (parts.some((p) => !p) || !screen) && tries++ < 20) {
        timer = window.setTimeout(light, 100)
        return
      }
      // An attribute, not a class: React rewrites a link's class when it becomes the active tab.
      lit = [tab, ...parts].filter((e): e is Element => !!e)
      for (const e of lit) e.setAttribute('data-tour-spot', '')
      // A stop about the whole page keeps the page clear, without a glow around it.
      if (!parts.some(Boolean)) {
        page = screen
        page?.setAttribute('data-tour-page', '')
      }
      document.body.classList.add('touring-focus')
      const found = parts.filter((e): e is Element => !!e)
      const spot = found[0]
      const phone = window.innerWidth <= 760
      const main = document.getElementById('main-content')?.getBoundingClientRect()
      // The card shows once it knows its place, so it never appears on one side and jumps.
      if (!spot || !main) {
        setPlace({})
        return
      }
      // The lit parts together: as wide as the page, they go to the top and the card to the bottom
      // corner, below their headings; narrower, they are centred with the card on the other side.
      const span = () => {
        const boxes = found.map((e) => e.getBoundingClientRect())
        const left = Math.min(...boxes.map((b) => b.left))
        const right = Math.max(...boxes.map((b) => b.right))
        return { left, width: right - left }
      }
      const wide = span().width > main.width * 0.6
      spot.scrollIntoView?.({ behavior: 'instant', block: phone || wide ? 'start' : 'center' })
      const box = span()
      // Something in the top bar (the counter, the bell): the card hangs right under it.
      if (phone || spot.closest('.topbar')) setPlace({})
      else if (wide) setPlace({ bottom: true })
      else if (box.left + box.width / 2 > main.left + main.width / 2)
        setPlace({ left: main.left + 28 })
      else setPlace({})
    }
    timer = window.setTimeout(light, 0)
    return () => {
      window.clearTimeout(timer)
      for (const e of lit) e.removeAttribute('data-tour-spot')
      page?.removeAttribute('data-tour-page')
      document.body.classList.remove('touring', 'touring-focus')
    }
  }, [route, phase])

  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave()
      if (e.key === 'ArrowRight' && !last) setStep(step + 1)
      if (e.key === 'ArrowLeft' && step > 1) setStep(step - 1)
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [leave, last, step, setStep])

  return createPortal(
    <section
      className={`tour-card${leaving ? ' onb-leaving' : ''}`}
      data-placed={place ? '' : undefined}
      style={
        place?.left !== undefined
          ? { left: place.left, right: 'auto' }
          : place?.bottom
            ? { top: 'auto', bottom: 16 }
            : undefined
      }
      aria-label={t('label')}
      aria-live="polite"
      data-folded={folded ? '' : undefined}
    >
      {folded ? (
        <button
          type="button"
          className="tour-fold"
          aria-label={t('expand', {
            n: step + 1,
            total: phases.length,
            title: t(`${phase}.title`),
          })}
          onClick={() => setFoldedAt(null)}
        >
          <img className="tour-guide" src="/nexo-avatar.svg" alt="" />
          <span className="tour-fold-step">
            {step + 1}/{phases.length}
          </span>
          <span className="tour-fold-title">{t(`${phase}.title`)}</span>
          <Icon name="chevron-up" />
        </button>
      ) : (
        content()
      )}
      {leaving && <Burst />}
    </section>,
    document.body,
  )

  // A plain function, not a component: a component declared here would mount anew on every render.
  function content() {
    return (
      <>
        <header className="onb-top">
          <img className="tour-guide" src="/nexo-avatar.svg" alt="" />
          <XpBar step={step} phases={phases} />
          <button type="button" className="ghost sm onb-skip" onClick={() => leave()}>
            {t('skip')}
          </button>
        </header>
        <div className="tour-body" key={phase}>
          <div className="tour-stage" aria-hidden="true">
            <Stage phase={phase} me={me} data={data} />
            <span className="onb-xp-pop">{t('xp', { xp: step * 250 })}</span>
          </div>
          <div className="onb-copy">
            <span className="onb-phase">{t('phase', { n: step + 1, total: phases.length })}</span>
            <span className="eyebrow">{t(`${phase}.eyebrow`)}</span>
            <h2>{t(`${phase}.title`)}</h2>
            <p>
              {me.demo && DEMO_TEXT.includes(phase)
                ? t(`${phase as 'nexo'}.demoBody`)
                : t(`${phase}.body`)}
            </p>
          </div>
        </div>
        <footer className="onb-controls">
          <div className="onb-dots">
            {phases.map((p, i) =>
              i === 0 ? null : (
                <button
                  key={p}
                  type="button"
                  aria-label={t('goTo', { n: i + 1 })}
                  aria-current={i === step ? 'step' : undefined}
                  onClick={() => go(i)}
                />
              ),
            )}
          </div>
          <div className="onb-nav">
            {step > 1 && (
              <button type="button" className="ghost" onClick={() => go(step - 1)}>
                {t('back')}
              </button>
            )}
            {last ? (
              <button type="button" className="button onb-start" onClick={() => leave(true)}>
                <Icon name="trophy" /> {t('start')}
              </button>
            ) : (
              <button type="button" className="button" onClick={() => go(step + 1)}>
                {t('next')} <Icon name="arrow-right" />
              </button>
            )}
          </div>
        </footer>
      </>
    )
  }
}

function Stage({ phase, me, data }: { phase: Phase; me: Me; data: AppStateData | null }) {
  const t = useMessages(messages)
  const profile = data?.profile
  if (phase === 'welcome') {
    const e = profile?.earned
    const trophies = e ? e.platinum + e.gold + e.silver + e.bronze : 0
    return (
      <div className="onb-welcome">
        <div className="onb-avatar">
          <img src={me.avatarUrl || '/nexo-avatar.svg'} alt="" />
          {profile && <span className="onb-level">{profile.level}</span>}
        </div>
        {profile && (
          <dl className="onb-stats">
            <div>
              <dt>{t('welcome.level')}</dt>
              <dd>
                <CountUp to={profile.level} />
              </dd>
            </div>
            <div>
              <dt>{t('welcome.platinums')}</dt>
              <dd>
                <CountUp to={e?.platinum ?? 0} />
              </dd>
            </div>
            <div>
              <dt>{t('welcome.trophies')}</dt>
              <dd>
                <CountUp to={trophies} />
              </dd>
            </div>
          </dl>
        )}
      </div>
    )
  }
  if (phase === 'radar') {
    const c = data?.current
    return (
      <div className="onb-radar">
        <span className="onb-sweep" />
        {c ? (
          <div className="onb-game">
            <Cover url={c.game.cover_url} name={c.name} className="onb-cover" />
            <div>
              <b>{c.name}</b>
              <span>{t('radar.progress', { earned: c.earned, total: c.total })}</span>
              <span className="onb-bar">
                <span style={{ '--to': `${c.progress}%` } as CSSProperties} />
              </span>
            </div>
          </div>
        ) : (
          <p className="onb-empty">{t('radar.noGame')}</p>
        )}
      </div>
    )
  }
  if (phase === 'plan') {
    return (
      <div className="onb-plan">
        <div className="onb-plan-times">
          {['30 min', '1h', t('plan.time')].map((m, i) => (
            <span key={m} className={i === 2 ? 'on' : ''}>
              {m}
            </span>
          ))}
        </div>
        {(['plan.step1', 'plan.step2', 'plan.step3'] as const).map((k, i) => (
          <div key={k} className="onb-plan-step" style={{ '--i': i } as CSSProperties}>
            <span className="onb-plan-dot">{i + 1}</span>
            <span>{t(k)}</span>
          </div>
        ))}
      </div>
    )
  }
  if (phase === 'home') {
    // What the Overview gathers, one line each.
    const parts = [
      ['gamepad', 'home.journey'],
      ['nexo', 'home.nexo'],
      ['trophy', 'home.next'],
      ['clock', 'home.releases'],
    ] as const
    return (
      <div className="onb-home">
        {parts.map(([icon, k], i) => (
          <div key={k} className="onb-home-part" style={{ '--i': i } as CSSProperties}>
            <span className="onb-home-icon">
              <Icon name={icon} />
            </span>
            <span>{t(k)}</span>
          </div>
        ))}
      </div>
    )
  }
  if (phase === 'notices') {
    const notes = [
      { icon: 'gamepad', text: t('notices.start') },
      { icon: 'trophy', text: t('notices.unlock') },
    ]
    return (
      <div className="onb-notices">
        <span className="onb-bell">
          <Icon name="bell" />
          <i>3</i>
        </span>
        {notes.map((n, i) => (
          <div key={n.icon} className="onb-notice" style={{ '--i': i } as CSSProperties}>
            <img src="/nexo-avatar.svg" alt="" />
            <span>
              <Icon name={n.icon} /> {n.text}
            </span>
          </div>
        ))}
      </div>
    )
  }
  if (phase === 'trophies') {
    return (
      <div className="onb-guides">
        <div className="onb-guide-row onb-ask" style={{ '--i': 0 } as CSSProperties}>
          <Icon name="trophy" />
          <div>
            <b>{t('trophies.trophy')}</b>
          </div>
          <span className="onb-connect">{t('trophies.ask')}</span>
        </div>
        {[
          { icon: 'compass', title: t('trophies.roadmap') },
          { icon: 'warning', title: t('trophies.missables') },
        ].map((r, i) => (
          <div key={r.title} className="onb-guide-row" style={{ '--i': i + 1 } as CSSProperties}>
            <Icon name={r.icon} />
            <div>
              <b>{r.title}</b>
            </div>
            <Icon name="check" />
          </div>
        ))}
      </div>
    )
  }
  if (phase === 'guides') {
    return (
      <div className="onb-search">
        <div className="onb-search-box">
          <Icon name="search" />
          <span className="onb-typed">{t('guides.search')}</span>
        </div>
        <div className="onb-search-hit">
          <span className="onb-search-cover" />
          <div>
            <b>{t('guides.search')}</b>
            <span>{t('guides.meta')}</span>
          </div>
        </div>
      </div>
    )
  }
  if (phase === 'nexo') {
    return (
      <div className="onb-nexo">
        <img className="onb-nexo-avatar" src="/nexo-avatar.svg" alt="" />
        <div className="onb-bubble onb-bubble-user">{t('nexo.question')}</div>
        <div className="onb-bubble onb-bubble-nexo">
          <span className="onb-typing">
            <i />
            <i />
            <i />
          </span>
          <span className="onb-answer">{t('nexo.answer')}</span>
        </div>
      </div>
    )
  }
  if (phase === 'discover') {
    // Recommendations come from the server only on Discover; the cards here are the shape of one.
    const picks = [
      { name: 'Hades', match: 96, difficulty: 5, hours: 45 },
      { name: 'Ghost of Tsushima', match: 91, difficulty: 3, hours: 50 },
      { name: 'Celeste', match: 87, difficulty: 7, hours: 25 },
    ]
    return (
      <div className="onb-picks">
        {picks.map((p, i) => (
          <div key={p.name} className="onb-pick" style={{ '--i': i } as CSSProperties}>
            <span className="onb-pick-rank">0{i + 1}</span>
            <div>
              <b>{p.name}</b>
              <span>
                <Icon name="target" /> {p.difficulty}/10 · <Icon name="clock" /> ~{p.hours}h
              </span>
            </div>
            <span className="onb-pick-match">
              {p.match}% <small>{t('discover.match')}</small>
            </span>
          </div>
        ))}
      </div>
    )
  }
  if (phase === 'profile') {
    return (
      <div className="onb-settings">
        <div className="onb-setting" style={{ '--i': 0 } as CSSProperties}>
          <img src="/telegram.svg" alt="" />
          <b>{t('profile.telegram')}</b>
          <span className="onb-connect">{t('profile.connect')}</span>
        </div>
        <div className="onb-setting" style={{ '--i': 1 } as CSSProperties}>
          <Icon name="layers" />
          <b>{t('profile.dlc')}</b>
          <span className="onb-switch" />
        </div>
      </div>
    )
  }
  const goals = data?.goals
  const target = goals?.target || 12
  const done = Math.min(goals?.done ?? 0, target)
  return (
    <div className="onb-goals">
      <svg className="onb-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" />
        <circle
          cx="60"
          cy="60"
          r="52"
          className="onb-ring-fill"
          style={{ '--to': 1 - done / target } as CSSProperties}
        />
      </svg>
      <div className="onb-ring-label">
        <b>
          {done}
          <small>/{target}</small>
        </b>
        <span>{t('goals.goal', { year: goals?.year ?? new Date().getFullYear() })}</span>
      </div>
    </div>
  )
}

/** A number that climbs to its value, or shows it at once without motion. */
function CountUp({ to }: { to: number }) {
  const [shown, setShown] = useState(to)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || to <= 0) {
      setShown(to)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900)
      setShown(Math.round(to * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    setShown(0)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [to])
  return <>{number(shown)}</>
}
