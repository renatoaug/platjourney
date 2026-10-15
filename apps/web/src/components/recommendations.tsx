/** Nexo's picks for the player's taste: game cards with save/dismiss in their own section, asked for
 * with a button, and the taste profile behind them. */

import { type MouseEvent, type ReactNode, useState } from 'react'
import { useInterests } from '../app/use-interests'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { nameText, plainText } from '../lib/text'
import type { Game } from '../lib/types'
import { Icon } from '../ui/icon'
import { EmptyState, ErrorState } from '../ui/states'
import { useDemo } from './demo'
import { type CardItem, GameCard, GameShelf, ShelfSkeleton } from './game-band'
import {
  effectiveProfile,
  emptyPrefs,
  samePrefs,
  TasteEditor,
  type TastePrefs,
} from './taste-editor'
import './recommendations.css'

const messages = defineMessages({
  [Language.PtBR]: {
    saveAria: 'Salvar {name} nos interesses',
    removeAria: 'Remover {name} dos interesses',
    saveTip: 'Salvar nos interesses',
    removeTip: 'Remover dos interesses',
    dismissAria: 'Não recomendar {name}',
    dismissTip: 'Não me interessa',
    dismissAsk: 'Por que {name} não te interessa?',
    dismissHint: 'O Nexo usa isso para ajustar as próximas recomendações.',
    dismissSkip: 'Só remover',
    dismissCancel: 'Cancelar',
    reasonTooLong: 'Muito longo',
    reasonTooHard: 'Muito difícil',
    reasonGenre: 'Não curto o gênero',
    reasonOnline: 'Tem online obrigatório',
    reasonPlayed: 'Já joguei',
    why: 'POR QUE ESSAS?',
    seeProfile: 'Ver perfil completo',
    hideProfile: 'Fechar perfil',
    likes: 'Você curte',
    avoids: 'Evitando',
    thinking: 'O Nexo está montando suas recomendações…',
    errorTitle: 'Recomendações fora do ar',
    error: 'Não conseguimos montar suas recomendações agora. Tente de novo em instantes.',
    emptyTitle: 'Nenhuma recomendação ainda',
    empty: 'Toque em "Gerar de novo" para o Nexo montar a lista pelo seu gosto.',
    noLibraryTitle: 'Seu gosto ainda é um mistério',
    noLibrary:
      'Jogue e conquiste alguns troféus: o Nexo usa a sua biblioteca para recomendar a próxima platina.',
    eyebrow: 'ANÁLISE DO NEXO',
    title: 'Escolhas do Nexo',
    ask: 'O Nexo lê o seu gosto e os guias para escolher a dedo as próximas platinas.',
    askButton: 'Pedir ao Nexo',
    customize: 'Personalizar',
    customizeTip: 'Ajustar o seu perfil de gosto e as regras',
    searchAgain: 'Gerar de novo',
    searchAgainTip: 'Pedir ao Nexo um novo lote de escolhas',
  },
  [Language.En]: {
    saveAria: 'Save {name} to interests',
    removeAria: 'Remove {name} from interests',
    saveTip: 'Save to interests',
    removeTip: 'Remove from interests',
    dismissAria: "Don't recommend {name}",
    dismissTip: 'Not interested',
    dismissAsk: 'Why not {name}?',
    dismissHint: 'Nexo uses this to tune your next picks.',
    dismissSkip: 'Just remove',
    dismissCancel: 'Cancel',
    reasonTooLong: 'Too long',
    reasonTooHard: 'Too hard',
    reasonGenre: 'Not my genre',
    reasonOnline: 'Needs online play',
    reasonPlayed: 'Already played',
    why: 'WHY THESE?',
    seeProfile: 'See full profile',
    hideProfile: 'Close profile',
    likes: 'You enjoy',
    avoids: 'Steering away from',
    thinking: 'Nexo is putting your picks together…',
    errorTitle: 'Recommendations are down',
    error: 'We could not build your picks right now. Try again in a moment.',
    emptyTitle: 'No picks yet',
    empty: 'Tap "Get new ones" and Nexo builds the list for your taste.',
    noLibraryTitle: 'Your taste is still a mystery',
    noLibrary:
      'Play and earn a few trophies: Nexo uses your library to recommend the next platinum.',
    eyebrow: "NEXO'S ANALYSIS",
    title: "Nexo's picks",
    ask: 'Nexo reads your taste and the guides to hand-pick your next platinums.',
    askButton: 'Ask Nexo',
    customize: 'Customize',
    customizeTip: 'Adjust your taste profile and rules',
    searchAgain: 'Get new ones',
    searchAgainTip: 'Ask Nexo for a new batch of picks',
  },
})

/** Why a recommendation was turned down; the next batch steers away from it. */
const DISMISS_REASONS = ['too_long', 'too_hard', 'genre', 'online', 'played'] as const
export type DismissReason = (typeof DISMISS_REASONS)[number]
const REASON_LABEL = {
  too_long: 'reasonTooLong',
  too_hard: 'reasonTooHard',
  genre: 'reasonGenre',
  online: 'reasonOnline',
  played: 'reasonPlayed',
} as const

interface TasteProfile {
  summary: string
  genres: string[]
  traits: string[]
  avoid: string[]
}

export interface Recommendation {
  game: Game
  platform: string
  difficulty: number
  hours: number
  playthroughs?: number | null
  hasDifficultyTrophy?: boolean | null
  why: string
  hasMissables?: boolean
  hasOnline?: boolean
  similarTo?: string[]
}

/** GET /api/recommendations (and the dismiss answer). */
export interface Recs {
  profile: TasteProfile | null
  /** The model's profile as it wrote it, to preview changes before they are saved. */
  baseProfile?: TasteProfile | null
  /** The player's changes to the profile and their rules. */
  prefs?: TastePrefs
  items: Recommendation[]
  generatedAt?: string
  /** No library to learn a taste from yet: nothing was searched. */
  reason?: 'no-library'
}

/** `idle`: the player has not asked Nexo yet. */
export type RecsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; recs: Recs }

// The buttons sit over the card, outside its links; keep a click from reaching them anyway.
const stop = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

export type OnDismiss = (r: Recommendation, reason?: DismissReason) => void

/** In place of the card: why the player is turning it down, or no reason at all. */
function DismissAsk({
  rec: r,
  onDismiss,
  onCancel,
}: {
  rec: Recommendation
  onDismiss: OnDismiss
  onCancel: () => void
}) {
  const t = useMessages(messages)
  const name = r.game.name
  return (
    <fieldset className="band-card rec-ask" aria-label={t('dismissAsk', { name })}>
      <b className="band-name">{t('dismissAsk', { name })}</b>
      <small className="muted">{t('dismissHint')}</small>
      <div className="chips rec-reasons">
        {DISMISS_REASONS.map((reason) => (
          <button key={reason} type="button" className="chip" onClick={() => onDismiss(r, reason)}>
            {t(REASON_LABEL[reason])}
          </button>
        ))}
      </div>
      <div className="rec-ask-actions">
        <button type="button" className="button ghost sm" onClick={() => onDismiss(r)}>
          {t('dismissSkip')}
        </button>
        <button type="button" className="button ghost sm" onClick={onCancel}>
          {t('dismissCancel')}
        </button>
      </div>
    </fieldset>
  )
}

/** Save and dismiss, over the card's cover. */
function RecActions({ game, onAsk }: { game: Game; onAsk: () => void }) {
  const t = useMessages(messages)
  const { find, toggle } = useInterests()
  const [saving, setSaving] = useState(false)
  const saved = !!find(game.id)
  const name = game.name
  return (
    <>
      <button
        type="button"
        className={`rec-save ${saved ? 'saved' : ''}`}
        disabled={saving}
        aria-label={t(saved ? 'removeAria' : 'saveAria', { name })}
        data-tip={t(saved ? 'removeTip' : 'saveTip')}
        onClick={async (e) => {
          stop(e)
          setSaving(true)
          await toggle(game.id, name, 'recommendations')
          setSaving(false)
        }}
      >
        <Icon name={saved ? 'bookmark-filled' : 'bookmark'} />
      </button>
      <button
        type="button"
        className="rec-dismiss"
        aria-label={t('dismissAria', { name })}
        data-tip={t('dismissTip')}
        onClick={(e) => {
          stop(e)
          onAsk()
        }}
      >
        <Icon name="close" />
      </button>
    </>
  )
}

/** One recommendation as a game card, with save and dismiss (none in the demo). `reason` is the
 * card's short line; Nexo's cards pass its paragraph, clamped, with the full text in the tooltip. */
export function RecCard({
  rec: r,
  onDismiss,
  reason,
  reasonTitle,
  reasonLines,
}: {
  rec: Recommendation
  onDismiss: OnDismiss
  reason?: ReactNode
  reasonTitle?: string
  reasonLines?: CardItem['reasonLines']
}) {
  const demo = useDemo()
  const [asking, setAsking] = useState(false)
  if (asking) return <DismissAsk rec={r} onDismiss={onDismiss} onCancel={() => setAsking(false)} />
  return (
    <GameCard
      item={{
        game: r.game,
        difficulty: r.difficulty,
        hours: r.hours,
        playthroughs: r.playthroughs,
        hasMissables: r.hasMissables,
        hasOnline: r.hasOnline,
        hasDifficultyTrophy: r.hasDifficultyTrophy,
        reason,
        reasonTitle,
        reasonLines,
      }}
      actions={demo ? undefined : <RecActions game={r.game} onAsk={() => setAsking(true)} />}
    />
  )
}

/** Opens the taste profile under Nexo's picks and brings it into view. */
export function openTaste() {
  const details = document.querySelector<HTMLDetailsElement>('#taste details')
  if (!details) return
  details.open = true
  details.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** What the editable profile needs from the screen: saving the draft, and asking for new picks with
 * it. Resolves once saved. */
interface TasteEditing {
  editable: boolean
  onSave: (next: TastePrefs, regenerate: boolean) => Promise<void>
}

/** Why these games: the top genres, and the full profile (genres, what they enjoy, what the picks
 * avoid and the player's rules) when opened, editable by the player. */
function Taste({
  profile,
  baseProfile,
  prefs = emptyPrefs(),
  editing,
}: {
  profile: TasteProfile | null
  baseProfile?: TasteProfile | null
  prefs?: TastePrefs
  editing?: TasteEditing
}) {
  const t = useMessages(messages)
  const [open, setOpen] = useState(false)
  // Changes stay a draft until the player saves them; a new saved set starts the draft over.
  const [draft, setDraft] = useState(prefs)
  const [saved, setSaved] = useState(prefs)
  const [saving, setSaving] = useState(false)
  if (!samePrefs(saved, prefs)) {
    setSaved(prefs)
    setDraft(prefs)
  }
  if (!profile && !editing?.editable) return null
  const empty = { summary: '', genres: [], traits: [], avoid: [] }
  // Without the model's own profile (an older answer), the saved one is the base.
  const base = (baseProfile !== undefined ? baseProfile : profile) ?? empty
  const shown = { ...base, ...effectiveProfile(base, draft) }
  const dirty = !samePrefs(draft, prefs)
  const save = async (regenerate: boolean) => {
    if (!editing) return
    setSaving(true)
    try {
      await editing.onSave(draft, regenerate)
    } finally {
      setSaving(false)
    }
  }
  const tag = (text: string, cls = '', key = text) => (
    <span key={key} className={`taste-tag ${cls}`}>
      {plainText(text)}
    </span>
  )
  const group = (label: string, items: string[], cls: string) =>
    items.length > 0 && (
      <div className="taste-group">
        <span className="taste-label">{label}</span>
        <div className="taste-tags">{items.map((x, i) => tag(x, cls, `${cls}${i}`))}</div>
      </div>
    )
  return (
    <details className="taste" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="taste-head">
          <span className="eyebrow">{t('why')}</span>
          <span className="taste-more">
            {t(open ? 'hideProfile' : 'seeProfile')} <Icon name="chevron-down" />
          </span>
        </span>
        <span className="taste-genres">{shown.genres.slice(0, 3).map((g) => tag(g, 'genre'))}</span>
      </summary>
      <div className="taste-body">
        {shown.summary && <p>{plainText(shown.summary)}</p>}
        {editing ? (
          <TasteEditor
            profile={shown}
            prefs={draft}
            editable={editing.editable}
            dirty={dirty}
            saving={saving}
            onChange={setDraft}
            onSave={save}
            onDiscard={() => setDraft(prefs)}
          />
        ) : (
          <>
            {group(t('likes'), shown.traits, 'trait')}
            {group(t('avoids'), shown.avoid, 'avoid')}
          </>
        )}
      </div>
    </details>
  )
}

/** Before the player asks: one line and the button, with Nexo beside them. */
function NexoInvite({ onAsk, disabled }: { onAsk?: () => void; disabled?: boolean }) {
  const t = useMessages(messages)
  return (
    <div className="nexo-invite">
      <img src="/nexo-avatar.svg" alt="" />
      <p>{t('ask')}</p>
      <button type="button" className="button sm" disabled={disabled} onClick={onAsk}>
        <Icon name="nexo" /> {t('askButton')}
      </button>
    </div>
  )
}

/** In place of the cards for a state with none: the invitation, Nexo at work, the error or empty. */
function RecsFallback({
  state,
  onAsk,
  askDisabled,
}: {
  state: RecsState
  onAsk?: () => void
  askDisabled?: boolean
}) {
  const t = useMessages(messages)
  if (state.status === 'idle') return <NexoInvite onAsk={onAsk} disabled={askDisabled} />
  if (state.status === 'loading')
    return (
      <>
        <div className="recs-thinking" role="status">
          <img src="/nexo-avatar.svg" alt="" />
          <span>{t('thinking')}</span>
        </div>
        <ShelfSkeleton />
      </>
    )
  if (state.status === 'error')
    return (
      <ErrorState icon="warning" title={t('errorTitle')}>
        {t('error')}
      </ErrorState>
    )
  if (state.recs.reason === 'no-library')
    return (
      <EmptyState icon="compass" title={t('noLibraryTitle')}>
        {t('noLibrary')}
      </EmptyState>
    )
  return (
    <EmptyState icon="compass" title={t('emptyTitle')}>
      {t('empty')}
    </EmptyState>
  )
}

/** "Gerar de novo" and, with picks, "Personalizar"; nothing before the player asks. */
function RecsActions({
  state,
  onRefresh,
  refreshDisabled,
}: {
  state: RecsState
  onRefresh?: () => void
  refreshDisabled?: boolean
}) {
  const t = useMessages(messages)
  if (state.status === 'idle' || !onRefresh) return null
  if (state.status === 'ok' && state.recs.reason === 'no-library') return null
  const loading = state.status === 'loading'
  return (
    <>
      {state.status === 'ok' && (
        <button type="button" className="ghost sm" data-tip={t('customizeTip')} onClick={openTaste}>
          <Icon name="edit" /> {t('customize')}
        </button>
      )}
      <button
        type="button"
        className={`ghost sm${loading ? ' busy' : ''}`}
        id="recs-refresh"
        data-tip={t('searchAgainTip')}
        disabled={loading || refreshDisabled}
        onClick={onRefresh}
      >
        <Icon name="refresh" /> {t('searchAgain')}
      </button>
    </>
  )
}

/** The section `#recs` (with `#taste` under the cards) for a load state: Nexo's picks, asked for
 * with `onAsk` while idle, new ones with `onRefresh`. Saving goes through the interests; dismissing
 * is the caller's. */
export function Recommendations({
  state,
  onDismiss,
  editing,
  onAsk,
  askDisabled,
  onRefresh,
  refreshDisabled,
}: {
  state: RecsState
  onDismiss: OnDismiss
  editing?: TasteEditing
  onAsk?: () => void
  askDisabled?: boolean
  onRefresh?: () => void
  refreshDisabled?: boolean
}) {
  const t = useMessages(messages)
  const items = state.status === 'ok' ? (state.recs.items ?? []) : []
  return (
    <GameShelf
      id="recs-title"
      bodyId="recs"
      className="recs-shelf"
      eyebrow={t('eyebrow')}
      title={t('title')}
      actions={
        <RecsActions state={state} onRefresh={onRefresh} refreshDisabled={refreshDisabled} />
      }
      cards={items.map((r) => {
        const why = nameText(r.why)
        return (
          <RecCard
            key={r.game.id}
            rec={r}
            onDismiss={onDismiss}
            reason={why || undefined}
            reasonTitle={why || undefined}
            reasonLines={3}
          />
        )
      })}
      fallback={<RecsFallback state={state} onAsk={onAsk} askDisabled={askDisabled} />}
      footer={
        <div id="taste">
          {state.status === 'ok' && state.recs.reason !== 'no-library' && (
            <Taste
              profile={state.recs.profile}
              baseProfile={state.recs.baseProfile}
              prefs={state.recs.prefs}
              editing={editing}
            />
          )}
        </div>
      }
    />
  )
}
