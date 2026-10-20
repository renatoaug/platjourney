/** Discover: one game for the moment (the player says what they feel like), Nexo's picks for their
 * taste (asked for with a button), games like the player's, the next platinum from the library, short
 * platinums and the same series. */
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { DemoNote } from '../components/demo'
import { GameCard, GameShelf } from '../components/game-band'
import { LibraryCard } from '../components/game-cards'
import { NexoPickBox } from '../components/nexo-pick'
import { PageHero } from '../components/page-hero'
import {
  type DismissReason,
  openTaste,
  type Recommendation,
  Recommendations,
  type Recs,
  type RecsState,
} from '../components/recommendations'
import { SaveToInterests } from '../components/save-to-interests'
import {
  NAMES_SLOT,
  NamesLine,
  pickItem,
  SimilarPicks,
  type SimilarState,
} from '../components/similar-picks'
import type { RecFilters, TastePrefs } from '../components/taste-editor'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import type { SimilarPick, SimilarRecs } from '../lib/types'
import { modelWorkDone } from '../plugins'
import { Icon } from '../ui/icon'
import { EmptyState } from '../ui/states'
import { toast } from '../ui/toast'
import './discover.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'SUA PRÓXIMA PLATINA',
    title: 'Descobrir',
    rankingEyebrow: 'SUA BIBLIOTECA',
    lead: 'O que platinar a seguir: da sua biblioteca e fora dela.',
    nextPlatinum: 'Próxima platina',
    nothingInProgress: 'Nada em andamento ainda',
    nothingInProgressHint:
      'Quando você começar um jogo que ainda não platinou, ele aparece aqui, do mais perto ao mais longe da platina.',
    findGame: 'Procurar um jogo',
    quickEyebrow: 'ATÉ 10 HORAS',
    quick: 'Platina relâmpago',
    seriesEyebrow: 'CONTINUE A HISTÓRIA',
    series: 'Na mesma série',
    youPlatinumed: 'Você platinou {games}',
    youPlayed: 'Você jogou {games}',
    dismissed: '{name} não aparece mais',
    dismissedWhy: '{name} saiu. O Nexo leva isso em conta nas próximas.',
    dismissFailed: 'Não conseguimos remover. Tenta de novo.',
    prefsFailed: 'Não conseguimos salvar seu perfil. Tenta de novo.',
    prefsSaved: 'Perfil salvo.',
  },
  [Language.En]: {
    eyebrow: 'YOUR NEXT PLATINUM',
    title: 'Discover',
    rankingEyebrow: 'YOUR LIBRARY',
    lead: 'What to platinum next: from your library and beyond.',
    nextPlatinum: 'Next platinum',
    nothingInProgress: 'Nothing in progress yet',
    nothingInProgressHint:
      'When you start a game you have not platinumed, it shows up here, from closest to farthest from the platinum.',
    findGame: 'Find a game',
    quickEyebrow: 'UP TO 10 HOURS',
    quick: 'Lightning platinums',
    seriesEyebrow: 'KEEP THE STORY GOING',
    series: 'In the same series',
    youPlatinumed: 'You platinumed {games}',
    youPlayed: 'You played {games}',
    dismissed: "{name} won't show up again",
    dismissedWhy: '{name} is gone. Nexo takes it into account next time.',
    dismissFailed: 'We could not remove it. Try again.',
    prefsFailed: 'We could not save your profile. Try again.',
    prefsSaved: 'Profile saved.',
  },
})

type Cache = Record<string, unknown>

/** Whether the player's saved rules leave games out. */
const hasFilters = (f?: RecFilters) =>
  !!f && Object.values(f).some((v) => v !== null && v !== undefined && v !== false)

// Nexo's picks are model work, so they live in the app cache: fetched when the player asks and on
// "Gerar de novo" only. The in-flight request is cached too, so coming back mid-load waits for it.
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

// The similar games come from the catalog graph, with no model: loaded with the page, kept for the
// visit, and asked again when the player's rules change. Like Nexo's, the request in flight is
// cached, so coming back mid-load waits for it.
function fetchSimilar(cache: Cache): Promise<SimilarRecs> {
  const load: Promise<SimilarRecs> = api<SimilarRecs>('/api/recommendations/similar')
    .then((similar) => {
      cache.similar = similar
      return similar
    })
    .finally(() => {
      if (cache.similarLoad === load) delete cache.similarLoad
    })
  cache.similarLoad = load
  return load
}

// The batch Nexo already made, with no model work: shown on every visit; nothing saved yet leaves
// the invitation to ask.
function fetchStoredRecs(cache: Cache): Promise<Recs | null> {
  const load = api<Recs>('/api/recommendations?stored=1')
    .then((recs) => {
      cache.recsChecked = true
      if (!recs.items.length) return null
      cache.recs = recs
      return recs
    })
    .finally(() => {
      if (cache.storedLoad === load) delete cache.storedLoad
    })
  cache.storedLoad = load
  return load
}

function initialRecs(cache: Cache): RecsState {
  if (cache.recs) return { status: 'ok', recs: cache.recs as Recs }
  if (cache.recsLoad) return { status: 'loading' }
  return cache.recsChecked ? { status: 'idle' } : { status: 'checking' }
}

const without = (picks: SimilarPick[], id: string) => picks.filter((p) => p.game.id !== id)

/** Short platinums and games of the same series, each left out when it has nothing. */
function DiscoverBands({ similar }: { similar: SimilarState }) {
  const t = useMessages(messages)
  if (similar.status !== 'ok') return null
  const { quick = [], series = [] } = similar.recs
  return (
    <>
      <GameShelf
        id="quick-title"
        eyebrow={t('quickEyebrow')}
        title={t('quick')}
        cards={quick.map((p) => (
          <GameCard
            key={p.game.id}
            item={pickItem(p)}
            actions={<SaveToInterests game={p.game} source="similar" />}
          />
        ))}
      />
      <GameShelf
        id="series-title"
        eyebrow={t('seriesEyebrow')}
        title={t('series')}
        cards={series.map((p) => (
          <GameCard
            key={p.game.id}
            actions={<SaveToInterests game={p.game} source="similar" />}
            item={{
              ...pickItem(p),
              reason: p.because[0] ? (
                <NamesLine
                  text={t(p.platinumed?.includes(p.because[0]) ? 'youPlatinumed' : 'youPlayed', {
                    games: NAMES_SLOT,
                  })}
                  names={[p.because[0]]}
                />
              ) : undefined,
            }}
          />
        ))}
      />
    </>
  )
}

/** The player's games closest to the platinum, in the ranking's order, six a page. */
function Ranking() {
  const t = useMessages(messages)
  const { data } = useApp()
  return (
    <GameShelf
      id="ranking-title"
      bodyId="ranking"
      eyebrow={t('rankingEyebrow')}
      title={t('nextPlatinum')}
      loading={!data}
      cards={(data?.ranking ?? []).map((r, i) => <LibraryCard key={r.game} item={r} index={i} />)}
      fallback={
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
      }
    />
  )
}

export function Discover() {
  const t = useMessages(messages)
  const { cache, me } = useApp()
  // From the interests' "Deixa o Nexo escolher": the pick looks among the saved games.
  const [params] = useSearchParams()
  const [recs, setRecs] = useState<RecsState>(() => initialRecs(cache))
  const [similar, setSimilar] = useState<SimilarState>(() => {
    const cached = cache.similar as SimilarRecs | undefined
    return cached ? { status: 'ok', recs: cached } : { status: 'loading' }
  })

  const load = useCallback(async (pending: Promise<Recs>) => {
    setRecs({ status: 'loading' })
    try {
      setRecs({ status: 'ok', recs: await pending })
      modelWorkDone()
    } catch {
      setRecs({ status: 'error' })
    }
  }, [])

  const loadSimilar = useCallback(async (pending: Promise<SimilarRecs>) => {
    try {
      setSimilar({ status: 'ok', recs: await pending })
    } catch {
      setSimilar({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    if (cache.similar) return
    loadSimilar((cache.similarLoad as Promise<SimilarRecs> | undefined) ?? fetchSimilar(cache))
  }, [cache, loadSimilar])

  // Coming back while Nexo was still working: wait for that request, never start another. Otherwise
  // the batch he already made shows at once, and only a player who never asked sees the invitation.
  useEffect(() => {
    if (cache.recs) return
    if (cache.recsLoad) {
      load(cache.recsLoad as Promise<Recs>)
      return
    }
    if (cache.recsChecked) return
    ;((cache.storedLoad as Promise<Recs | null> | undefined) ?? fetchStoredRecs(cache))
      .then((stored) => setRecs(stored ? { status: 'ok', recs: stored } : { status: 'idle' }))
      .catch(() => setRecs({ status: 'idle' }))
  }, [cache, load])

  const dismiss = async (r: Recommendation, reason?: DismissReason) => {
    try {
      const next = await api<Recs>('/api/recommendations/dismiss', { game: r.game.id, reason })
      // Nexo's batch only shows once the player asked for it.
      if (recs.status === 'ok') {
        cache.recs = next
        setRecs({ status: 'ok', recs: next })
      }
      if (similar.status === 'ok') {
        const s = similar.recs
        const rest: SimilarRecs = {
          ...s,
          items: without(s.items, r.game.id),
          quick: without(s.quick ?? [], r.game.id),
          series: without(s.series ?? [], r.game.id),
        }
        cache.similar = rest
        setSimilar({ status: 'ok', recs: rest })
      }
      toast(t(reason ? 'dismissedWhy' : 'dismissed', { name: r.game.name }), 'success')
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) toast(t('dismissFailed'))
    }
  }

  // The profile draft, saved when the player asks; with `regenerate`, a new batch follows. The
  // rules apply to the similar games too, so those are asked again.
  const savePrefs = async (prefs: TastePrefs, regenerate: boolean) => {
    try {
      const next = await api<Recs>('/api/recommendations/preferences', prefs)
      cache.recs = next
      toast(t('prefsSaved'), 'success')
      loadSimilar(fetchSimilar(cache))
      if (regenerate) await load(fetchRecs(cache, true))
      else setRecs({ status: 'ok', recs: next })
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) toast(t('prefsFailed'))
    }
  }

  const noLibrary = similar.status === 'ok' && similar.recs.reason === 'no-library'
  // Wide artworks of the games recommended.
  const art = [
    ...(recs.status === 'ok' ? recs.recs.items : []),
    ...(similar.status === 'ok' ? similar.recs.items : []),
  ].flatMap((r) => (r.game.art_url ? [r.game.art_url] : []))

  return (
    <Page path="/discover">
      <PageHero
        eyebrow={t('eyebrow')}
        title={t('title')}
        lead={t('lead')}
        images={art}
        look="art"
      />
      <NexoPickBox
        initialScope={params.get('scope') === 'interests' ? 'interests' : 'any'}
        spotlight={params.has('scope')}
      />
      {/* With no library to learn from, Nexo has nothing to look at: only the similar section says so. */}
      {!noLibrary && (
        <Recommendations
          state={recs}
          onDismiss={dismiss}
          editing={{ editable: !me.demo, onSave: savePrefs }}
          onAsk={() =>
            load((cache.recsLoad as Promise<Recs> | undefined) ?? fetchRecs(cache, false))
          }
          onRefresh={() => load(fetchRecs(cache, true))}
          refreshDisabled={me.demo}
        />
      )}
      <SimilarPicks
        state={similar}
        onDismiss={dismiss}
        filtered={recs.status === 'ok' && hasFilters(recs.recs.prefs?.filters)}
        onFilters={openTaste}
      />
      {me.demo && <DemoNote />}
      <Ranking />
      <DiscoverBands similar={similar} />
    </Page>
  )
}
