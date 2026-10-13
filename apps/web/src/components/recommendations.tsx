/** Recommendations for the player's taste: rows with save/dismiss, and the taste profile behind them. */
import { type MouseEvent, useState } from 'react'
import { Link } from 'react-router'
import { useInterests } from '../app/use-interests'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { plainText } from '../lib/text'
import type { Game } from '../lib/types'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { repeat, Sk } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'
import { useDemo } from './demo'
import {
  effectiveProfile,
  emptyPrefs,
  samePrefs,
  TasteEditor,
  type TastePrefs,
} from './taste-editor'
import { titleHref } from './tip'
import './recommendations.css'

const messages = defineMessages({
  [Language.PtBR]: {
    difficulty: 'Dificuldade da platina',
    hours: 'Tempo estimado para a platina',
    runsTitle: 'Número mínimo de jogadas',
    runs: {
      one: '{count} jogada',
      other: '{count} jogadas',
    },
    difficultyTrophyYes: 'Há troféu que exige jogar em uma dificuldade específica',
    difficultyTrophyNo: 'Nenhum troféu exige uma dificuldade específica',
    difficultyTrophy: 'Troféu de dificuldade',
    noDifficultyTrophy: 'Sem troféu de dificuldade',
    missablesTitle: 'Há troféus perdíveis',
    missables: 'Perdíveis',
    similarTo: 'parecido com {games}',
    and: ' e ',
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
    empty: 'Toque no ↻ ao lado do título para o Nexo montar a lista pelo seu gosto.',
    noLibraryTitle: 'Seu gosto ainda é um mistério',
    noLibrary:
      'Jogue e conquiste alguns troféus: o Nexo usa a sua biblioteca para recomendar a próxima platina.',
  },
  [Language.En]: {
    difficulty: 'Platinum difficulty',
    hours: 'Estimated time to platinum',
    runsTitle: 'Minimum number of playthroughs',
    runs: {
      one: '{count} playthrough',
      other: '{count} playthroughs',
    },
    difficultyTrophyYes: 'A trophy requires playing on a specific difficulty',
    difficultyTrophyNo: 'No trophy requires a specific difficulty',
    difficultyTrophy: 'Difficulty trophy',
    noDifficultyTrophy: 'No difficulty trophy',
    missablesTitle: 'Has missable trophies',
    missables: 'Missables',
    similarTo: 'similar to {games}',
    and: ' and ',
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
    empty: 'Tap ↻ next to the title and Nexo builds the list for your taste.',
    noLibraryTitle: 'Your taste is still a mystery',
    noLibrary:
      'Play and earn a few trophies: Nexo uses your library to recommend the next platinum.',
  },
})

/** Why a recommendation was turned down; the next batch steers away from it. */
export const DISMISS_REASONS = ['too_long', 'too_hard', 'genre', 'online', 'played'] as const
export type DismissReason = (typeof DISMISS_REASONS)[number]
const REASON_LABEL = {
  too_long: 'reasonTooLong',
  too_hard: 'reasonTooHard',
  genre: 'reasonGenre',
  online: 'reasonOnline',
  played: 'reasonPlayed',
} as const

export interface TasteProfile {
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

export type RecsState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; recs: Recs }

// Keep generated text free of decorative emoji, like uiText() does for HTML (React escapes for us).
// The buttons sit inside the row's link; keep the click from navigating.
const stop = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

type OnDismiss = (r: Recommendation, reason?: DismissReason) => void

/** In place of the row: why the player is turning it down, or no reason at all. */
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
    <fieldset className="row rec-ask" aria-label={t('dismissAsk', { name })}>
      <Cover url={r.game.cover_url} name={name} className="rec-cover" />
      <div className="grow">
        <div className="n">{t('dismissAsk', { name })}</div>
        <small className="muted">{t('dismissHint')}</small>
        <div className="chips rec-reasons">
          {DISMISS_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              className="chip"
              onClick={() => onDismiss(r, reason)}
            >
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
      </div>
    </fieldset>
  )
}

function RecRow({ rec: r, onDismiss }: { rec: Recommendation; onDismiss: OnDismiss }) {
  const t = useMessages(messages)
  const { find, toggle } = useInterests()
  const demo = useDemo()
  const [saving, setSaving] = useState(false)
  const [asking, setAsking] = useState(false)
  const saved = !!find(r.game.id)
  const name = r.game.name
  const runs = r.playthroughs
  if (asking) return <DismissAsk rec={r} onDismiss={onDismiss} onCancel={() => setAsking(false)} />
  return (
    <Link className="row" to={titleHref(r.game.id)}>
      <Cover url={r.game.cover_url} name={name} className="rec-cover" />
      <div className="grow">
        <div className="recommendation-heading">
          <div className="n">
            {name}{' '}
            <span className="pill" style={{ fontSize: 10, padding: '1px 7px' }}>
              {r.platform}
            </span>
          </div>
          <div className="recommendation-meta">
            <span title={t('difficulty')}>
              <Icon name="target" /> {r.difficulty}/10
            </span>
            <span title={t('hours')}>
              <Icon name="clock" /> ~{r.hours}h
            </span>
            {Number.isInteger(runs) && runs && runs > 0 ? (
              <span title={t('runsTitle')}>
                <Icon name="refresh" /> {t('runs', { count: runs })}
              </span>
            ) : null}
            {typeof r.hasDifficultyTrophy === 'boolean' && (
              <span
                title={r.hasDifficultyTrophy ? t('difficultyTrophyYes') : t('difficultyTrophyNo')}
              >
                <Icon name="trophy" />{' '}
                {r.hasDifficultyTrophy ? t('difficultyTrophy') : t('noDifficultyTrophy')}
              </span>
            )}
            {r.hasMissables && (
              <span title={t('missablesTitle')}>
                <Icon name="warning" /> {t('missables')}
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 13, marginTop: 4, color: 'var(--color-fg)' }}>
          {plainText(r.why)}
        </div>
        {/* The "similar to" line and the row's actions share one line; long text wraps before them. */}
        <div className="rec-foot">
          <div className="rec-foot-text">
            {!!r.similarTo?.length && (
              <div className="similar-to">
                <Icon name="layers" /> {t('similarTo', { games: r.similarTo.join(t('and')) })}
              </div>
            )}
          </div>
          {!demo && (
            <span className="rec-actions">
              <button
                type="button"
                className={`rec-save ${saved ? 'saved' : ''}`}
                disabled={saving}
                aria-label={t(saved ? 'removeAria' : 'saveAria', {
                  name,
                })}
                data-tip={t(saved ? 'removeTip' : 'saveTip')}
                onClick={async (e) => {
                  stop(e)
                  setSaving(true)
                  await toggle(r.game.id, name)
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
                  setAsking(true)
                }}
              >
                <Icon name="close" />
              </button>
            </span>
          )}
          <span className="row-arrow">
            <Icon name="arrow" />
          </span>
        </div>
      </div>
    </Link>
  )
}

/** What the editable profile needs from the screen: saving the draft, and asking for new picks with
 * it. Resolves once saved. */
export interface TasteEditing {
  editable: boolean
  onSave: (next: TastePrefs, regenerate: boolean) => Promise<void>
}

/** Why these games: the top genres, and the full profile (genres, what they enjoy, what the picks
 * avoid and the player's rules) when opened, editable by the player. */
export function Taste({
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

export function RecsSkeleton({ n = 4 }: { n?: number }) {
  return repeat(n, () => (
    <div className="row">
      <Sk w="92px" h={43} style={{ borderRadius: 'var(--radius-tag)', flex: 'none' }} />
      <div className="grow">
        <Sk w="45%" h={12} />
        <Sk w="30%" h={10} style={{ marginTop: 8 }} />
        <Sk w="100%" h={11} style={{ marginTop: 10 }} />
        <Sk w="85%" h={11} style={{ marginTop: 6 }} />
        <Sk w="40%" h={10} style={{ marginTop: 10 }} />
      </div>
    </div>
  ))
}

/** `#recs` and `#taste` for a load state. Saving goes through the interests; dismissing is the caller's. */
export function Recommendations({
  state,
  onDismiss,
  editing,
}: {
  state: RecsState
  onDismiss: OnDismiss
  editing?: TasteEditing
}) {
  const t = useMessages(messages)
  const items = state.status === 'ok' ? (state.recs.items ?? []) : []
  return (
    <>
      <div id="recs">
        {state.status === 'loading' ? (
          <>
            <div className="recs-thinking" role="status">
              <img src="/nexo-avatar.svg" alt="" />
              <span>{t('thinking')}</span>
            </div>
            <RecsSkeleton n={3} />
          </>
        ) : state.status === 'error' ? (
          <ErrorState icon="warning" title={t('errorTitle')}>
            {t('error')}
          </ErrorState>
        ) : items.length ? (
          items.map((r) => <RecRow key={r.game.id} rec={r} onDismiss={onDismiss} />)
        ) : state.status === 'ok' && state.recs.reason === 'no-library' ? (
          <EmptyState icon="compass" title={t('noLibraryTitle')}>
            {t('noLibrary')}
          </EmptyState>
        ) : (
          <EmptyState icon="compass" title={t('emptyTitle')}>
            {t('empty')}
          </EmptyState>
        )}
      </div>
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
    </>
  )
}
