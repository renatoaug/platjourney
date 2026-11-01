import { useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { GameCardsSkeleton, LibraryCard } from '../components/game-cards'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Icon } from '../ui/icon'
import { EmptyState, ErrorState } from '../ui/states'
import { Goals } from './goals'
import './games.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Jogos',
    lead: 'Escolha a jornada que quer continuar.',
    library: 'Em progresso',
    interests: 'Interesses',
    all: 'Biblioteca e conquistas',
    search: 'Buscar nos seus jogos',
    empty: 'Sua próxima jornada começa com um jogo.',
    find: 'Buscar jogo',
    none: 'Nenhum jogo encontrado. Tente outro nome.',
    error: 'Não conseguimos carregar seus jogos. Atualize para tentar novamente.',
    tabs: 'Seus jogos',
  },
  [Language.En]: {
    title: 'Games',
    lead: 'Choose the journey you want to continue.',
    library: 'In progress',
    interests: 'Interests',
    all: 'Library and achievements',
    search: 'Search your games',
    empty: 'Your next journey starts with a game.',
    find: 'Find a game',
    none: 'No games found. Try another name.',
    error: 'Could not load your games. Refresh to try again.',
    tabs: 'Your games',
  },
})

export function Games() {
  const t = useMessages(messages)
  const { data, sync } = useApp()
  const [side, setSide] = useState<'library' | 'interests'>('library')
  const [q, setQ] = useState('')
  const games = data?.ranking.filter((g) =>
    g.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()),
  )
  return (
    <Page path="/games">
      <div className="games-page">
        <header>
          <h1>{t('title')}</h1>
          <p>{t('lead')}</p>
        </header>
        <fieldset className="segmented" aria-label={t('tabs')}>
          {(['library', 'interests'] as const).map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={side === key}
              onClick={() => setSide(key)}
            >
              {t(key)}
            </button>
          ))}
        </fieldset>
        {side === 'interests' ? (
          <Goals />
        ) : (
          <>
            <div className="games-controls">
              <label>
                <Icon name="search" />
                <input
                  type="search"
                  aria-label={t('search')}
                  placeholder={t('search')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <Link className="text-link" to="/profile">
                {t('all')}
              </Link>
            </div>
            <div className="game-grid">
              {!data ? (
                sync === 'failed' ? (
                  <ErrorState>{t('error')}</ErrorState>
                ) : (
                  <GameCardsSkeleton />
                )
              ) : games?.length ? (
                games.map((g, i) => <LibraryCard key={g.game} item={g} index={i} />)
              ) : (
                <EmptyState
                  action={
                    !q && (
                      <Link className="button" to="/guides">
                        {t('find')}
                      </Link>
                    )
                  }
                >
                  {q ? t('none') : t('empty')}
                </EmptyState>
              )}
            </div>
          </>
        )}
      </div>
    </Page>
  )
}
