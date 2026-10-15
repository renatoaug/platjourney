/** Games like the ones the player has, from the catalog graph: recommendation cards whose short line
 * names the player's games that led to each one. */
import { Fragment, type ReactNode } from 'react'
import { defineMessages, Language, useLocale, useMessages } from '../i18n/i18n'
import type { SimilarPick, SimilarRecs } from '../lib/types'
import { Icon } from '../ui/icon'
import { EmptyState, ErrorState } from '../ui/states'
import { type CardItem, GameShelf } from './game-band'
import { type OnDismiss, RecCard, type Recommendation } from './recommendations'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'DO SEU HISTÓRICO',
    title: 'Parecidos com seus jogos',
    because: 'Parecido com {games}',
    becausePlatinumed: 'Parecido com {games}, que você platinou',
    errorTitle: 'Parecidos fora do ar',
    error: 'Não conseguimos buscar jogos parecidos com os seus agora. Tente de novo em instantes.',
    emptyTitle: 'Nenhum jogo parecido ainda',
    empty:
      'Ainda não achamos jogos próximos dos seus no catálogo. Peça ao Nexo uma análise do seu gosto.',
    filteredTitle: 'Nenhum parecido passa nos seus filtros',
    filtered: 'Há jogos parecidos com os seus, mas as suas regras deixaram todos de fora.',
    changeFilters: 'Ajustar filtros',
    noLibraryTitle: 'Seu gosto ainda é um mistério',
    noLibrary:
      'Jogue e conquiste alguns troféus: os jogos da sua biblioteca mostram o que recomendar.',
  },
  [Language.En]: {
    eyebrow: 'FROM YOUR HISTORY',
    title: 'Like your games',
    because: 'Like {games}',
    becausePlatinumed: 'Like {games}, which you platinumed',
    errorTitle: 'Similar games are down',
    error: 'We could not find games like yours right now. Try again in a moment.',
    emptyTitle: 'No similar games yet',
    empty: 'We have not found catalog games close to yours yet. Ask Nexo for a look at your taste.',
    filteredTitle: 'No similar game passes your filters',
    filtered: 'There are games like yours, but your rules left all of them out.',
    changeFilters: 'Adjust filters',
    noLibraryTitle: 'Your taste is still a mystery',
    noLibrary: 'Play and earn a few trophies: the games in your library show what to recommend.',
  },
})

export type SimilarState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; recs: SimilarRecs }

/** What `{games}` is set to when translating a `NamesLine` text: swapped for the bold names. */
export const NAMES_SLOT = '\u0000'

/** A translated line with `{games}` filled by the names in bold, joined as the language joins a
 * list ("X e Y", "X, Y e Z"). */
export function NamesLine({
  text,
  names,
}: {
  /** Translated with `{games}` set to `NAMES_SLOT`. */
  text: string
  names: string[]
}) {
  const locale = useLocale()
  const parts = new Intl.ListFormat(locale, { type: 'conjunction' }).formatToParts(names)
  const list: ReactNode[] = parts.map((p, i) =>
    p.type === 'element' ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed list
      <strong key={i}>{p.value}</strong>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed list
      <Fragment key={i}>{p.value}</Fragment>
    ),
  )
  const [before, after = ''] = text.split(NAMES_SLOT)
  return (
    <>
      {before}
      {list}
      {after}
    </>
  )
}

/** A pick as a recommendation, for its card with save and dismiss. */
const asRecommendation = (p: SimilarPick): Recommendation => ({
  game: p.game,
  platform: p.platform,
  difficulty: p.difficulty,
  hours: p.hours,
  playthroughs: p.playthroughs,
  hasMissables: p.hasMissables,
  hasOnline: p.hasOnline,
  hasDifficultyTrophy: p.hasDifficultyTrophy,
  why: '',
})

/** A pick's facts for a plain game card (the short platinums, the series). */
export const pickItem = (p: SimilarPick): CardItem => ({
  game: p.game,
  difficulty: p.difficulty,
  hours: p.hours,
  playthroughs: p.playthroughs,
  hasMissables: p.hasMissables,
  hasOnline: p.hasOnline,
  hasDifficultyTrophy: p.hasDifficultyTrophy,
})

function PickCard({ pick, onDismiss }: { pick: SimilarPick; onDismiss: OnDismiss }) {
  const t = useMessages(messages)
  const names = pick.because.slice(0, 3)
  // One game that led to it and the player platinumed it: say so; with more names the line stays short.
  const platinumed = names.length === 1 && !!pick.platinumed?.includes(names[0])
  return (
    <RecCard
      rec={asRecommendation(pick)}
      onDismiss={onDismiss}
      source="similar"
      reason={
        names.length ? (
          <NamesLine
            text={t(platinumed ? 'becausePlatinumed' : 'because', { games: NAMES_SLOT })}
            names={names}
          />
        ) : undefined
      }
    />
  )
}

/** In place of the cards: the error, no library, the rules leaving everything out, or empty. */
function SimilarFallback({
  state,
  filtered,
  onFilters,
}: {
  state: SimilarState
  filtered: boolean
  onFilters?: () => void
}) {
  const t = useMessages(messages)
  if (state.status === 'error')
    return (
      <ErrorState icon="warning" title={t('errorTitle')}>
        {t('error')}
      </ErrorState>
    )
  if (state.status === 'ok' && state.recs.reason === 'no-library')
    return (
      <EmptyState icon="compass" title={t('noLibraryTitle')}>
        {t('noLibrary')}
      </EmptyState>
    )
  if (filtered)
    return (
      <EmptyState
        icon="compass"
        title={t('filteredTitle')}
        action={
          onFilters && (
            <button type="button" className="button ghost sm" onClick={onFilters}>
              <Icon name="edit" /> {t('changeFilters')}
            </button>
          )
        }
      >
        {t('filtered')}
      </EmptyState>
    )
  return (
    <EmptyState icon="compass" title={t('emptyTitle')}>
      {t('empty')}
    </EmptyState>
  )
}

/** The section `#similar` for a load state. `filtered`: the player has rules on, so an empty list
 * says so and `onFilters` takes them to the rules. */
export function SimilarPicks({
  state,
  onDismiss,
  filtered = false,
  onFilters,
}: {
  state: SimilarState
  onDismiss: OnDismiss
  filtered?: boolean
  onFilters?: () => void
}) {
  const t = useMessages(messages)
  const items = state.status === 'ok' ? state.recs.items : []
  return (
    <GameShelf
      id="similar-title"
      bodyId="similar"
      eyebrow={t('eyebrow')}
      title={t('title')}
      loading={state.status === 'loading'}
      cards={items.map((p) => <PickCard key={p.game.id} pick={p} onDismiss={onDismiss} />)}
      fallback={<SimilarFallback state={state} filtered={filtered} onFilters={onFilters} />}
    />
  )
}
