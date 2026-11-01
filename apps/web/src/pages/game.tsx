/** The current PSN game opens the same personal journey as an owned library title. */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { HeroSkeleton } from '../components/hero'
import { Journey } from '../components/journey'
import { PlanCard } from '../components/plan'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import type { CurrentGame } from '../lib/types'
import { EmptyState, ErrorState } from '../ui/states'
import './game.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Sua jornada',
    empty: 'Qual vai ser sua próxima platina?',
    lead: 'Inicie um jogo na PSN para acompanhar seu progresso aqui, ou explore seus jogos.',
    games: 'Ver meus jogos',
    error: 'Não conseguimos atualizar sua jornada. Tente sincronizar novamente.',
  },
  [Language.En]: {
    title: 'Your journey',
    empty: 'What is your next platinum?',
    lead: 'Start a game on PSN to track your progress here, or explore your games.',
    games: 'See my games',
    error: 'Could not update your journey. Try syncing again.',
  },
})

export function GameScreen({
  current,
  plan,
}: {
  current: CurrentGame | null | undefined
  plan: ReactNode
}) {
  const t = useMessages(messages)
  return (
    <Page path="/game">
      {current ? (
        <Journey game={current} plan={plan} />
      ) : current === undefined ? (
        <>
          <h1 className="sr-only">{t('title')}</h1>
          <HeroSkeleton cta={false} />
        </>
      ) : (
        <EmptyState
          title={t('empty')}
          icon="gamepad"
          action={
            <Link className="button" to="/games">
              {t('games')}
            </Link>
          }
        >
          {t('lead')}
        </EmptyState>
      )}
    </Page>
  )
}

export function Game() {
  const { data, sync } = useApp()
  const t = useMessages(messages)
  if (!data && sync === 'failed')
    return (
      <Page path="/game">
        <ErrorState>{t('error')}</ErrorState>
      </Page>
    )
  return (
    <GameScreen
      current={data ? data.current : undefined}
      plan={<PlanCard key={data?.current?.np} np={data?.current?.np} />}
    />
  )
}
