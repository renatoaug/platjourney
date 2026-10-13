/** Discover: the next platinum from the library, recommendations for the player's taste and server alerts. */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { DemoNote } from '../components/demo'
import { RankingRow, RankingRowsSkeleton } from '../components/game-cards'
import {
  type DismissReason,
  type Recommendation,
  Recommendations,
  type Recs,
  type RecsState,
} from '../components/recommendations'
import type { TastePrefs } from '../components/taste-editor'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import { Icon } from '../ui/icon'
import { Pager } from '../ui/pager'
import { modelWorkDone } from '../ui/plugin-slot'
import { EmptyState } from '../ui/states'
import { toast } from '../ui/toast'
import './discover.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Descobrir',
    rankingPages: 'Páginas da sua biblioteca',
    customize: 'Personalizar',
    customizeTip: 'Ajustar o seu perfil de gosto e as regras',
    lead: 'O que platinar a seguir: da sua biblioteca e fora dela.',
    nextPlatinum: 'Próxima platina · sua biblioteca',
    nothingInProgress: 'Nada em andamento ainda',
    nothingInProgressHint:
      'Quando você começar um jogo que ainda não platinou, ele aparece aqui, do mais perto ao mais longe da platina.',
    findGame: 'Procurar um jogo',
    recommendations: 'Recomendações pro seu gosto',
    searchAgain: 'Gerar novas recomendações',
    dismissed: '{name} não aparece mais',
    dismissedWhy: '{name} saiu. O Nexo leva isso em conta nas próximas.',
    dismissFailed: 'Não conseguimos remover. Tenta de novo.',
    prefsFailed: 'Não conseguimos salvar seu perfil. Tenta de novo.',
    prefsSaved: 'Perfil salvo.',
  },
  [Language.En]: {
    title: 'Discover',
    rankingPages: 'Pages of your library',
    customize: 'Customize',
    customizeTip: 'Adjust your taste profile and rules',
    lead: 'What to platinum next: from your library and beyond.',
    nextPlatinum: 'Next platinum · your library',
    nothingInProgress: 'Nothing in progress yet',
    nothingInProgressHint:
      'When you start a game you have not platinumed, it shows up here, from closest to farthest from the platinum.',
    findGame: 'Find a game',
    recommendations: 'Picks for your taste',
    searchAgain: 'Get new picks',
    dismissed: "{name} won't show up again",
    dismissedWhy: '{name} is gone. Nexo takes it into account next time.',
    dismissFailed: 'We could not remove it. Try again.',
    prefsFailed: 'We could not save your profile. Try again.',
    prefsSaved: 'Profile saved.',
  },
})

type Cache = Record<string, unknown>

/** Opens the taste profile under the picks and brings it into view. */
function openTaste() {
  const details = document.querySelector<HTMLDetailsElement>('#taste details')
  if (!details) return
  details.open = true
  details.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Library rows per page: about the height of a batch of recommendations beside it.
const RANKING_PAGE = 10

// Recommendations are model work, so they live in the app cache: fetched on the first visit and on
// the refresh button only. The in-flight request is cached too, so coming back mid-load waits for it.
function fetchRecs(cache: Cache, refresh: boolean): Promise<Recs> {
  const load: Promise<Recs> = api<Recs>(`/api/recommendations${refresh ? '?refresh=1' : ''}`)
    .then((recs) => {
      cache.recs = recs
      return recs
    })
    .finally(() => {
      if (cache.recsLoad === load) delete cache.recsLoad
    })
  cache.recsLoad = load
  return load
}

export function Discover() {
  const t = useMessages(messages)
  const { data, cache, me } = useApp()
  const [recs, setRecs] = useState<RecsState>(() => {
    const cached = cache.recs as Recs | undefined
    return cached ? { status: 'ok', recs: cached } : { status: 'loading' }
  })

  const [rankingPage, setRankingPage] = useState(1)
  const load = useCallback(async (pending: Promise<Recs>) => {
    setRecs({ status: 'loading' })
    try {
      setRecs({ status: 'ok', recs: await pending })
      modelWorkDone()
    } catch {
      setRecs({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    if (cache.recs) return
    load((cache.recsLoad as Promise<Recs> | undefined) ?? fetchRecs(cache, false))
  }, [cache, load])

  const dismiss = async (r: Recommendation, reason?: DismissReason) => {
    try {
      const next = await api<Recs>('/api/recommendations/dismiss', { game: r.game.id, reason })
      cache.recs = next
      setRecs({ status: 'ok', recs: next })
      toast(t(reason ? 'dismissedWhy' : 'dismissed', { name: r.game.name }), 'success')
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) toast(t('dismissFailed'))
    }
  }

  // The profile draft, saved when the player asks; with `regenerate`, a new batch follows.
  const savePrefs = async (prefs: TastePrefs, regenerate: boolean) => {
    try {
      const next = await api<Recs>('/api/recommendations/preferences', prefs)
      cache.recs = next
      toast(t('prefsSaved'), 'success')
      if (regenerate) await load(fetchRecs(cache, true))
      else setRecs({ status: 'ok', recs: next })
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) toast(t('prefsFailed'))
    }
  }

  return (
    <Page path="/discover">
      <div className="page-head">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('lead')}</p>
        </div>
      </div>
      <div className="grid cols-2 discover-columns">
        <div className="card">
          <h2>{t('nextPlatinum')}</h2>
          <div id="ranking">
            {!data ? (
              <RankingRowsSkeleton n={RANKING_PAGE} />
            ) : data.ranking.length ? (
              data.ranking
                .slice((rankingPage - 1) * RANKING_PAGE, rankingPage * RANKING_PAGE)
                .map((r, i) => (
                  <RankingRow key={r.game} item={r} index={(rankingPage - 1) * RANKING_PAGE + i} />
                ))
            ) : (
              <EmptyState
                icon="gamepad"
                title={t('nothingInProgress')}
                action={
                  <Link className="button ghost sm" to="/guides">
                    <Icon name="search" /> {t('findGame')}
                  </Link>
                }
              >
                {t('nothingInProgressHint')}
              </EmptyState>
            )}
          </div>
          {data && (
            <Pager
              page={rankingPage}
              size={RANKING_PAGE}
              total={data.ranking.length}
              onPage={setRankingPage}
              label={t('rankingPages')}
            />
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>{t('recommendations')}</h2>
            {/* With no library to learn from there is nothing to search again. */}
            {!(recs.status === 'ok' && recs.recs.reason === 'no-library') && (
              <span className="card-actions">
                {recs.status === 'ok' && (
                  <button
                    type="button"
                    className="ghost sm"
                    data-tip={t('customizeTip')}
                    onClick={openTaste}
                  >
                    <Icon name="edit" /> {t('customize')}
                  </button>
                )}
                <button
                  type="button"
                  className={`icon-button${recs.status === 'loading' ? ' busy' : ''}`}
                  id="recs-refresh"
                  aria-label={t('searchAgain')}
                  data-tip={t('searchAgain')}
                  disabled={recs.status === 'loading' || me.demo}
                  onClick={() => load(fetchRecs(cache, true))}
                >
                  <Icon name="refresh" />
                </button>
              </span>
            )}
          </div>
          <Recommendations
            state={recs}
            onDismiss={dismiss}
            editing={{ editable: !me.demo, onSave: savePrefs }}
          />
          {me.demo && <DemoNote />}
        </div>
      </div>
    </Page>
  )
}
