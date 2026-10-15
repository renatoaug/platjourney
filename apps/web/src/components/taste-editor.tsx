/** The taste profile the player can change: genres, what they enjoy and what to avoid, as tags they
 * remove or add (typed or from suggestions), and the rules every recommendation follows. Each change
 * is saved at once; a new batch of picks waits for the player to ask. */
import { type FormEvent, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { plainText } from '../lib/text'
import { Icon } from '../ui/icon'
import './recommendations.css'
import './taste-editor.css'

const messages = defineMessages({
  [Language.PtBR]: {
    genres: 'Gêneros',
    traits: 'Você curte',
    avoid: 'Evitando',
    add: 'Adicionar',
    addTo: 'Adicionar em {group}',
    placeholder: 'Escreva e aperte Enter',
    remove: 'Tirar {item}',
    yours: 'Você adicionou',
    suggestions: 'Sugestões',
    suggest: {
      genres:
        'RPG|Ação|Aventura|Soulslike|Metroidvania|Plataforma|Terror|Corrida|Luta|Estratégia|Puzzle|Indie',
      traits:
        'Platinas curtas|História forte|Mundo aberto|Exploração|Colecionáveis|Desafio alto|Jogos relaxantes|Coop',
      avoid:
        'Online obrigatório|Grind longo|Várias jogadas|Troféu de dificuldade|Multiplayer competitivo|Terror',
    },
    rules: 'Regras para as recomendações',
    rulesHint: 'Nenhuma recomendação quebra estas regras.',
    noMissables: 'Sem perdíveis',
    onePlaythrough: 'Uma jogada só',
    noDifficultyTrophy: 'Sem troféu de dificuldade',
    noOnline: 'Sem online',
    maxHours: 'Horas até a platina',
    maxDifficulty: 'Dificuldade',
    anyHours: 'Qualquer duração',
    upToHours: 'Até {hours}h',
    anyDifficulty: 'Qualquer dificuldade',
    upToDifficulty: 'Até {difficulty}/10',
    dirty: 'Mudanças ainda não salvas.',
    discard: 'Descartar',
    save: 'Salvar',
    saveAndRegenerate: 'Salvar e gerar novas recomendações',
  },
  [Language.En]: {
    genres: 'Genres',
    traits: 'You enjoy',
    avoid: 'Steering away from',
    add: 'Add',
    addTo: 'Add to {group}',
    placeholder: 'Type and press Enter',
    remove: 'Remove {item}',
    yours: 'You added',
    suggestions: 'Suggestions',
    suggest: {
      genres:
        'RPG|Action|Adventure|Soulslike|Metroidvania|Platformer|Horror|Racing|Fighting|Strategy|Puzzle|Indie',
      traits:
        'Short platinums|Strong story|Open world|Exploration|Collectibles|High challenge|Relaxing games|Co-op',
      avoid:
        'Online required|Long grind|Several playthroughs|Difficulty trophy|Competitive multiplayer|Horror',
    },
    rules: 'Rules for the picks',
    rulesHint: 'No pick breaks these rules.',
    noMissables: 'No missables',
    onePlaythrough: 'One playthrough',
    noDifficultyTrophy: 'No difficulty trophy',
    noOnline: 'No online',
    maxHours: 'Hours to platinum',
    maxDifficulty: 'Difficulty',
    anyHours: 'Any length',
    upToHours: 'Up to {hours}h',
    anyDifficulty: 'Any difficulty',
    upToDifficulty: 'Up to {difficulty}/10',
    dirty: 'Changes not saved yet.',
    discard: 'Discard',
    save: 'Save',
    saveAndRegenerate: 'Save and get new picks',
  },
})

const TASTE_LISTS = ['genres', 'traits', 'avoid'] as const
type TasteList = (typeof TASTE_LISTS)[number]
type Lists = Record<TasteList, string[]>

export interface RecFilters {
  noMissables?: boolean
  onePlaythrough?: boolean
  noDifficultyTrophy?: boolean
  noOnline?: boolean
  maxHours?: number | null
  maxDifficulty?: number | null
}

/** The player's changes to the model's profile and their rules (POST /api/recommendations/preferences). */
export interface TastePrefs {
  added: Lists
  removed: Lists
  filters: RecFilters
}

interface TasteLists {
  genres: string[]
  traits: string[]
  avoid: string[]
}

export const emptyPrefs = (): TastePrefs => ({
  added: { genres: [], traits: [], avoid: [] },
  removed: { genres: [], traits: [], avoid: [] },
  filters: {},
})

/** The profile the player sees: the model's, without what they removed and with what they added
 * (the server applies the same on save). */
export function effectiveProfile(base: TasteLists, prefs: TastePrefs): TasteLists {
  const merged = (key: TasteList) => {
    const kept = (base[key] ?? []).filter((x) => !has(prefs.removed[key], x))
    return [...kept, ...prefs.added[key].filter((x) => !has(kept, x))]
  }
  return { genres: merged('genres'), traits: merged('traits'), avoid: merged('avoid') }
}

/** What a set of preferences says, without the empty rules ("any length" is no rule at all). */
const said = (p: TastePrefs) =>
  JSON.stringify({
    added: p.added,
    removed: p.removed,
    filters: Object.fromEntries(Object.entries(p.filters).filter(([, v]) => v)),
  })

/** Whether two sets of preferences say the same. */
export const samePrefs = (a: TastePrefs, b: TastePrefs) => said(a) === said(b)

const FLAGS = ['noMissables', 'onePlaythrough', 'noDifficultyTrophy', 'noOnline'] as const
const HOURS = [10, 20, 40, 60, 100]
const DIFFICULTIES = [3, 5, 7]
const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase()
const has = (list: string[], item: string) => list.some((x) => same(x, item))

/** Taking a tag out: one the player added just goes; one the model wrote is remembered as removed. */
export function removeItem(prefs: TastePrefs, key: TasteList, item: string): TastePrefs {
  if (has(prefs.added[key], item))
    return {
      ...prefs,
      added: { ...prefs.added, [key]: prefs.added[key].filter((x) => !same(x, item)) },
    }
  return { ...prefs, removed: { ...prefs.removed, [key]: [...prefs.removed[key], item] } }
}

/** Adding a tag: back from the removed ones if the model had it, otherwise one of the player's own. */
export function addItem(prefs: TastePrefs, key: TasteList, item: string): TastePrefs {
  const text = item.trim()
  if (!text) return prefs
  if (has(prefs.removed[key], text))
    return {
      ...prefs,
      removed: { ...prefs.removed, [key]: prefs.removed[key].filter((x) => !same(x, text)) },
    }
  if (has(prefs.added[key], text)) return prefs
  return { ...prefs, added: { ...prefs.added, [key]: [...prefs.added[key], text] } }
}

function Group({
  label,
  list,
  items,
  prefs,
  editable,
  onChange,
}: {
  label: string
  list: TasteList
  items: string[]
  prefs: TastePrefs
  editable: boolean
  onChange: (next: TastePrefs) => void
}) {
  const t = useMessages(messages)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const suggestions = (t(`suggest.${list}`) as string).split('|').filter((s) => !has(items, s))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim()) onChange(addItem(prefs, list, text))
    setText('')
  }
  if (!editable && !items.length) return null
  return (
    <div className="taste-group">
      <span className="taste-label">{label}</span>
      <div className="taste-tags">
        {items.map((x) => {
          const yours = has(prefs.added[list], x)
          return (
            <span
              key={x}
              className={`taste-tag ${list === 'genres' ? 'genre' : list === 'traits' ? 'trait' : 'avoid'}${yours ? ' yours' : ''}`}
              title={yours ? t('yours') : undefined}
            >
              {plainText(x)}
              {editable && (
                <button
                  type="button"
                  className="taste-remove"
                  aria-label={t('remove', { item: x })}
                  onClick={() => onChange(removeItem(prefs, list, x))}
                >
                  <Icon name="close" />
                </button>
              )}
            </span>
          )
        })}
        {editable && !adding && (
          <button
            type="button"
            className="taste-add"
            aria-label={t('addTo', { group: label })}
            onClick={() => setAdding(true)}
          >
            <Icon name="plus" /> {t('add')}
          </button>
        )}
      </div>
      {editable && adding && (
        <div className="taste-adding">
          <form onSubmit={submit}>
            <input
              value={text}
              maxLength={40}
              placeholder={t('placeholder')}
              aria-label={t('addTo', { group: label })}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setAdding(false)
              }}
            />
            <button type="button" className="ghost sm" onClick={() => setAdding(false)}>
              <Icon name="close" />
            </button>
          </form>
          {suggestions.length > 0 && (
            <fieldset className="taste-suggest" aria-label={t('suggestions')}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  onClick={() => onChange(addItem(prefs, list, s))}
                >
                  <Icon name="plus" /> {s}
                </button>
              ))}
            </fieldset>
          )}
        </div>
      )}
    </div>
  )
}

/** The editable lists and the rules. `profile` is the one the player sees (the model's with their
 * changes); `onChange` saves the new preferences. */
export function TasteEditor({
  profile,
  prefs,
  editable,
  dirty = false,
  saving = false,
  onChange,
  onSave,
  onDiscard,
}: {
  profile: TasteLists
  prefs: TastePrefs
  editable: boolean
  /** The draft differs from what is saved: the save bar shows. */
  dirty?: boolean
  saving?: boolean
  onChange: (next: TastePrefs) => void
  onSave?: (regenerate: boolean) => void
  onDiscard?: () => void
}) {
  const t = useMessages(messages)
  const f = prefs.filters
  const setFilter = (patch: RecFilters) =>
    onChange({ ...prefs, filters: { ...prefs.filters, ...patch } })
  return (
    <>
      {TASTE_LISTS.map((list) => (
        <Group
          key={list}
          label={t(list)}
          list={list}
          items={profile[list]}
          prefs={prefs}
          editable={editable}
          onChange={onChange}
        />
      ))}
      {editable && (
        <div className="taste-group taste-rules">
          <span className="taste-label">{t('rules')}</span>
          <small className="muted">{t('rulesHint')}</small>
          <div className="taste-tags">
            {FLAGS.map((flag) => (
              <button
                key={flag}
                type="button"
                className={`chip${f[flag] ? ' active' : ''}`}
                aria-pressed={!!f[flag]}
                onClick={() => setFilter({ [flag]: !f[flag] })}
              >
                {f[flag] && <Icon name="check" />} {t(flag)}
              </button>
            ))}
          </div>
          <div className="taste-limits">
            <label>
              <span>{t('maxHours')}</span>
              <select
                value={f.maxHours ?? ''}
                onChange={(e) =>
                  setFilter({ maxHours: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">{t('anyHours')}</option>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {t('upToHours', { hours: h })}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('maxDifficulty')}</span>
              <select
                value={f.maxDifficulty ?? ''}
                onChange={(e) =>
                  setFilter({ maxDifficulty: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">{t('anyDifficulty')}</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {t('upToDifficulty', { difficulty: d })}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
      {dirty && onSave && (
        <div className="taste-changed" role="status">
          <span>{t('dirty')}</span>
          <span className="taste-changed-actions">
            <button type="button" className="ghost sm" disabled={saving} onClick={onDiscard}>
              {t('discard')}
            </button>
            <button
              type="button"
              className="ghost sm"
              disabled={saving}
              onClick={() => onSave(false)}
            >
              {t('save')}
            </button>
            <button
              type="button"
              className="button sm"
              disabled={saving}
              onClick={() => onSave(true)}
            >
              <Icon name="refresh" /> {t('saveAndRegenerate')}
            </button>
          </span>
        </div>
      )}
    </>
  )
}
