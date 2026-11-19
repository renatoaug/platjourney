/** The home of someone without an account: what PlatJourney is, with the guide of the day, the
 * releases and what the community is playing, all things anyone can open. */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Page } from '../app/page'
import { useSignInHref } from '../app/visitor'
import { CommunityHighlights } from '../components/community/community-highlights'
import {
  fetchSpotlight,
  GuideSpotlight,
  GuideSpotlightSkeleton,
  type SpotlightGame,
  sceneOf,
  useSpotlight,
} from '../components/guide-spotlight'
import { PageTop } from '../components/page-top'
import { Releases } from '../components/releases'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
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

export function PublicHome({
  loadSpotlight = fetchSpotlight,
  releases = <Releases />,
  community = <CommunityHighlights />,
}: {
  loadSpotlight?: () => Promise<SpotlightGame | null>
  releases?: ReactNode
  community?: ReactNode
} = {}) {
  const t = useMessages(messages)
  const signIn = useSignInHref()
  const spotlight = useSpotlight(loadSpotlight)
  const scene = sceneOf(spotlight)
  return (
    <Page path="/">
      {/* The same top as Guides: the guide of the day's scene behind, its card beside. */}
      <PageTop
        eyebrow={t('eyebrow')}
        title={t('title')}
        lead={t('lead')}
        art={scene}
        aside={
          spotlight.status === 'loading' ? (
            <GuideSpotlightSkeleton />
          ) : spotlight.game ? (
            <GuideSpotlight game={spotlight.game} />
          ) : null
        }
      >
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
      </PageTop>
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
  loadArt = fetchSpotlight,
}: {
  releases?: ReactNode
  community?: ReactNode
  /** The game whose scene goes across the top: the guide of the day, as on Guides. */
  loadArt?: () => Promise<SpotlightGame | null>
} = {}) {
  const t = useMessages(messages)
  const signIn = useSignInHref()
  const art = sceneOf(useSpotlight(loadArt))
  return (
    <Page path="/games">
      <PageTop
        eyebrow={t('games.eyebrow')}
        title={t('games.title')}
        lead={t('games.lead')}
        art={art}
      >
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
