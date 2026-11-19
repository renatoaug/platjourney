/** The home of someone without an account: what PlatJourney is, with the guide of the day, the
 * releases and what the community is playing, all things anyone can open. */
import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Page } from '../app/page'
import { useSignInHref } from '../app/visitor'
import { CommunityHighlights } from '../components/community/community-highlights'
import {
  GuideSpotlight,
  GuideSpotlightSkeleton,
  pickOfTheDay,
  type SpotlightGame,
} from '../components/guide-spotlight'
import { PageTop } from '../components/page-top'
import { Releases } from '../components/releases'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { Icon } from '../ui/icon'
import './public-home.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'CADA TROFÉU CONTA',
    title: 'Sua próxima platina começa aqui.',
    lead: 'Guias de platina com dificuldade, horas e perdíveis, a jornada até o troféu e o Nexo para tirar dúvidas. Conecte sua PSN e o PlatJourney acompanha cada platina sua.',
    join: 'Conectar minha PSN',
    guides: 'Ver os guias',
    points: {
      guides: 'Guias de platina',
      journey: 'A jornada até a platina',
      nexo: 'O Nexo no seu jogo',
    },
    games: {
      eyebrow: 'Jogos',
      title: 'Lançamentos e o que a comunidade joga',
      lead: 'Sua biblioteca, seus interesses e suas metas aparecem aqui quando você entra.',
      signIn: 'Entrar para ver os meus',
    },
  },
  [Language.En]: {
    eyebrow: 'EVERY TROPHY COUNTS',
    title: 'Your next platinum starts here.',
    lead: 'Platinum guides with difficulty, hours and missables, the journey to the trophy and Nexo to answer questions. Connect your PSN and PlatJourney follows every platinum of yours.',
    join: 'Connect my PSN',
    guides: 'Browse the guides',
    points: {
      guides: 'Platinum guides',
      journey: 'The journey to the platinum',
      nexo: 'Nexo in your game',
    },
    games: {
      eyebrow: 'Games',
      title: 'Releases and what the community plays',
      lead: 'Your library, interests and goals show up here once you sign in.',
      signIn: 'Sign in to see mine',
    },
  },
})

type Spotlight = { status: 'loading' } | { status: 'ok'; game: SpotlightGame | null }

const fetchSpotlight = () =>
  api<{ items: SpotlightGame[] }>('/api/guides?').then(({ items }) => pickOfTheDay(items))

/** The guide of the day; nothing when the catalog has none or does not answer. */
function TodaysGuide({ load = fetchSpotlight }: { load?: () => Promise<SpotlightGame | null> }) {
  const [state, setState] = useState<Spotlight>({ status: 'loading' })
  useEffect(() => {
    let live = true
    load()
      .then((game) => live && setState({ status: 'ok', game }))
      .catch(() => live && setState({ status: 'ok', game: null }))
    return () => {
      live = false
    }
  }, [load])
  if (state.status === 'loading') return <GuideSpotlightSkeleton />
  return state.game ? <GuideSpotlight game={state.game} /> : null
}

export function PublicHome({
  spotlight = <TodaysGuide />,
  releases = <Releases />,
  community = <CommunityHighlights />,
}: {
  spotlight?: ReactNode
  releases?: ReactNode
  community?: ReactNode
} = {}) {
  const t = useMessages(messages)
  const signIn = useSignInHref()
  return (
    <Page path="/">
      <section className="card public-home-hero" id="public-home-hero">
        <span className="eyebrow">{t('eyebrow')}</span>
        <h1>{t('title')}</h1>
        <p>{t('lead')}</p>
        <ul className="public-home-points">
          <li>
            <Icon name="book-open" /> {t('points.guides')}
          </li>
          <li>
            <Icon name="compass" /> {t('points.journey')}
          </li>
          <li>
            <Icon name="sparkles" /> {t('points.nexo')}
          </li>
        </ul>
        <div className="public-home-actions">
          <Link className="button" to={signIn} id="public-home-join">
            {t('join')}
          </Link>
          <Link className="button secondary" to="/guides">
            <Icon name="book-open" /> {t('guides')}
          </Link>
        </div>
      </section>
      <div className="public-home-spotlight">{spotlight}</div>
      {releases}
      {community}
    </Page>
  )
}

/** Games without an account: the releases and the community's games; the player's own lists wait
 * for the sign-in. */
export function VisitorGames({
  releases = <Releases />,
  community = <CommunityHighlights />,
}: {
  releases?: ReactNode
  community?: ReactNode
} = {}) {
  const t = useMessages(messages)
  const signIn = useSignInHref()
  return (
    <Page path="/games">
      <PageTop eyebrow={t('games.eyebrow')} title={t('games.title')} lead={t('games.lead')}>
        <div className="public-home-actions">
          <Link className="button sm" to={signIn} id="games-sign-in">
            {t('games.signIn')}
          </Link>
        </div>
      </PageTop>
      {releases}
      {community}
    </Page>
  )
}
