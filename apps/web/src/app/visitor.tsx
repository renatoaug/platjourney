/** Someone without an account: the same app, reading what is public (guides, games, the community,
 * profiles), with the way in where the account would be. What needs an account asks for one. */
import { Link, useLocation } from 'react-router'
import { GameBackdrop } from '../components/game-backdrop'
import { fetchSpotlight, sceneOf, useSpotlight } from '../components/guide-spotlight'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import type { Me } from '../lib/types'
import { Icon } from '../ui/icon'
import { TrophyMedal } from '../ui/trophy-medal'
import { Page } from './page'
import './visitor.css'

const messages = defineMessages({
  [Language.PtBR]: {
    signIn: 'Entrar',
    join: 'Criar conta',
    accountTitle: 'Sua jornada começa aqui',
    accountBody: 'Conecte sua PSN para acompanhar suas platinas.',
    guides: 'Ver os guias',
    connect: 'Conectar minha PSN',
    already: 'Já tenho conta',
    free: 'Grátis. Só precisa do seu PSN ID.',
    prompt: {
      eyebrow: 'COM A SUA CONTA',
      game: {
        title: 'Sua jornada até a platina',
        lead: 'O PlatJourney lê seus troféus na PSN e mostra onde você está no jogo, o próximo troféu e o que não dá para deixar passar.',
      },
      history: {
        title: 'Tudo o que o Nexo te disse',
        lead: 'Os avisos e as dicas do Nexo sobre os seus jogos ficam guardados aqui, para voltar quando precisar.',
      },
      profile: {
        title: 'Seu perfil de caçador',
        lead: 'Suas platinas, a coleção, o ritmo por ano e as mais raras, prontas para compartilhar.',
      },
      other: {
        title: 'Isto é da sua conta',
        lead: 'Conecte sua PSN e o PlatJourney acompanha cada platina sua.',
      },
    },
    perks: {
      next: 'O próximo troféu, sempre à vista',
      missable: 'Aviso antes de perder um troféu',
      nexo: 'O Nexo para tirar dúvidas no seu jogo',
    },
  },
  [Language.En]: {
    signIn: 'Sign in',
    join: 'Sign up',
    accountTitle: 'Your journey starts here',
    accountBody: 'Connect your PSN to follow your platinums.',
    guides: 'Browse the guides',
    connect: 'Connect my PSN',
    already: 'I have an account',
    free: 'Free. All it takes is your PSN ID.',
    prompt: {
      eyebrow: 'WITH YOUR ACCOUNT',
      game: {
        title: 'Your journey to the platinum',
        lead: 'PlatJourney reads your trophies on PSN and shows where you are in the game, the next trophy and what you cannot let slip.',
      },
      history: {
        title: 'Everything Nexo told you',
        lead: "Nexo's notices and tips about your games are kept here, to come back to when you need them.",
      },
      profile: {
        title: 'Your hunter profile',
        lead: 'Your platinums, the collection, the pace per year and the rarest ones, ready to share.',
      },
      other: {
        title: 'This is part of your account',
        lead: 'Connect your PSN and PlatJourney follows every platinum of yours.',
      },
    },
    perks: {
      next: 'The next trophy, always in sight',
      missable: 'A warning before a trophy is missed',
      nexo: 'Nexo to answer questions about your game',
    },
  },
})

/** Nobody signed in. Read only like the demo, so every action that writes stays closed. */
export const VISITOR: Me = {
  id: '',
  onlineId: '',
  telegramLinked: false,
  includeDlcProgress: false,
  onboarded: true,
  demo: true,
  visitor: true,
}

/** The sign-in screen, coming back to `from` once signed in. */
const signInHref = (from: string) =>
  from === '/' || from.startsWith('/entrar')
    ? '/entrar'
    : `/entrar?next=${encodeURIComponent(from)}`

/** Where the sign-in screen sends the player back: a page of this app, else the home. */
export function nextAfterSignIn(search: string): string {
  const next = new URLSearchParams(search).get('next') ?? '/'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

/** The sign-in screen, coming back to the page on screen. */
export function useSignInHref() {
  const { pathname, search } = useLocation()
  return signInHref(pathname + search)
}

/** At the end of the top bar: the way in. A phone keeps only "Sign in". */
export function VisitorActions() {
  const t = useMessages(messages)
  const href = useSignInHref()
  return (
    <div className="visitor-actions">
      <Link className="button secondary sm" to={href} id="visitor-sign-in">
        {t('signIn')}
      </Link>
      <Link className="button sm visitor-join" to={href} id="visitor-join">
        {t('join')}
      </Link>
    </div>
  )
}

/** Where the player's card sits at the end of the menu. */
export function VisitorAccount() {
  const t = useMessages(messages)
  const href = useSignInHref()
  return (
    <div className="visitor-account" id="visitor-account">
      <b>{t('accountTitle')}</b>
      <small>{t('accountBody')}</small>
      <Link className="button sm" to={href}>
        {t('signIn')}
      </Link>
    </div>
  )
}

const PROMPTS = ['game', 'history', 'profile'] as const

/** A screen that needs an account, opened without one: what it would show, and the way in. */
export function SignInPrompt({ path }: { path: string }) {
  const t = useMessages(messages)
  const href = useSignInHref()
  const screen = PROMPTS.find((p) => path === `/${p}`) ?? 'other'
  // The guide of the day's scene behind, as on the public home.
  const scene = sceneOf(useSpotlight(fetchSpotlight))
  return (
    <Page path={path}>
      {scene && <GameBackdrop src={scene} />}
      <section className="card visitor-prompt" aria-labelledby="visitor-prompt-title">
        <TrophyMedal type="platinum" className="visitor-prompt-medal" />
        <span className="eyebrow">{t('prompt.eyebrow')}</span>
        <h1 id="visitor-prompt-title">{t(`prompt.${screen}.title`)}</h1>
        <p className="visitor-prompt-lead">{t(`prompt.${screen}.lead`)}</p>
        <ul className="visitor-perks">
          <li>
            <Icon name="target" /> {t('perks.next')}
          </li>
          <li>
            <Icon name="warning" /> {t('perks.missable')}
          </li>
          <li>
            <Icon name="nexo" /> {t('perks.nexo')}
          </li>
        </ul>
        <div className="visitor-prompt-actions">
          <Link className="button" to={href} id="visitor-prompt-join">
            {t('connect')}
          </Link>
          <Link className="button secondary" to={href}>
            {t('already')}
          </Link>
        </div>
        <small className="visitor-prompt-free">{t('free')}</small>
        <Link className="text-link visitor-prompt-guides" to="/guides">
          <Icon name="book-open" /> {t('guides')}
        </Link>
      </section>
    </Page>
  )
}
