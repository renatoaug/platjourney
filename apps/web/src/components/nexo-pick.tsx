/** "O que jogar agora?": the player tells Nexo what they feel like right now, where to look (their
 * interests or any game) and whether to keep to games they already have; Nexo answers with one game,
 * why it fits and where to start. The latest pick stays in view and the earlier ones open in a
 * dialog. Model work, so it runs only on the button. */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import { fmtWhen } from '../lib/format'
import { plainText } from '../lib/text'
import type { AssistantKey } from '../lib/types'
import { modelWorkDone } from '../plugins'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { AppLogo, assistantName } from './app-logo'
import { titleHref } from './tip'
import './nexo-pick.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'O que jogar agora?',
    mood: 'O que você tá a fim?',
    moodPlaceholder: 'Ex.: algo curto pra hoje à noite',
    moods: {
      easy: 'Algo fácil',
      short: 'Algo curto',
      relax: 'Pra relaxar',
      challenge: 'Um desafio',
    },
    lead: 'Platinou aquele jogo ou tá quase, e não sabe o que vem depois? Deixa com o Nexo.',
    howLink: 'Como ele escolhe?',
    how: 'Por padrão ele procura em qualquer jogo parecido com os que você joga e platina, pesa o ritmo das suas últimas platinas e o que cada guia diz (tempo, dificuldade, perdíveis, online) e escolhe um só. Em "Dar uma direção" dá para ficar só nos seus interesses ou no que você já tem. Pedir de novo traz outro.',
    tune: 'Dar uma direção',
    optional: '(opcional)',
    where: 'Onde procurar',
    interestsHint: 'Entre os jogos salvos nos seus interesses do ano',
    anyHint: 'Jogos parecidos com os que você joga e platina, que você ainda não tem',
    interests: 'Meus interesses',
    any: 'Qualquer jogo',
    ownedOnly: 'Só o que já tenho',
    ownedHint:
      'Jogos que você já abriu e o catálogo do seu PS Plus. Jogo comprado e nunca aberto não aparece.',
    ask: 'Escolher pra mim',
    again: 'Escolher outro',
    thinking: 'O Nexo está pensando…',
    latest: 'ÚLTIMA ESCOLHA · {when}',
    latestBy: 'ÚLTIMA ESCOLHA · {name} · {when}',
    unnamed: 'ASSISTENTE',
    asked: 'Você pediu: “{mood}”',
    first: 'Por onde começar',
    noFit: 'Nenhum dos seus interesses combina direito com isso. Esse foi o mais perto.',
    lookBeyond: 'Procurar fora da lista',
    history: { one: 'Ver a escolha anterior', other: 'Ver as {count} escolhas anteriores' },
    historyTitle: 'Escolhas anteriores',
    close: 'Fechar',
    ownedTag: 'só o que tenho',
    failed: 'O Nexo não conseguiu escolher agora. Tenta de novo.',
    none: 'Nada para escolher com esses filtros. Salve jogos nos seus interesses ou procure em qualquer jogo.',
  },
  [Language.En]: {
    title: 'What to play now?',
    mood: 'What do you feel like?',
    moodPlaceholder: 'E.g. something short for tonight',
    moods: {
      easy: 'Something easy',
      short: 'Something short',
      relax: 'To relax',
      challenge: 'A challenge',
    },
    lead: 'Just platinumed that game, or almost there, and not sure what comes next? Leave it to Nexo.',
    howLink: 'How does it pick?',
    how: 'By default it looks at any game like the ones you play and platinum, weighs the pace of your last platinums and what each guide says (time, difficulty, missables, online) and picks one. Under "Give a direction" you can keep to your interests or to what you already have. Asking again brings another.',
    tune: 'Give a direction',
    optional: '(optional)',
    where: 'Where to look',
    interestsHint: 'Among the games saved in your interests for the year',
    anyHint: 'Games like the ones you play and platinum, that you do not have yet',
    interests: 'My interests',
    any: 'Any game',
    ownedOnly: 'Only what I have',
    ownedHint:
      'Games you have opened and your PS Plus catalog. A game bought and never opened does not show up.',
    ask: 'Pick for me',
    again: 'Pick another',
    thinking: 'Nexo is thinking…',
    latest: 'LATEST PICK · {when}',
    latestBy: 'LATEST PICK · {name} · {when}',
    unnamed: 'ASSISTANT',
    asked: 'You asked for: “{mood}”',
    first: 'Where to start',
    noFit: 'None of your interests really matches that. This was the closest.',
    lookBeyond: 'Look beyond the list',
    history: { one: 'See the previous pick', other: 'See the {count} previous picks' },
    historyTitle: 'Previous picks',
    close: 'Close',
    ownedTag: 'only what I have',
    failed: 'Nexo could not pick right now. Try again.',
    none: 'Nothing to pick with these filters. Save games to your interests or look at any game.',
  },
})

export type PickScope = 'interests' | 'any'

export interface NexoPick {
  id: string
  game: { id: string; name: string; cover_url?: string | null }
  why: string
  /** Where to start; null when an assistant left it out. */
  firstStep: string | null
  mood: string | null
  scope: PickScope | null
  ownedOnly: boolean
  /** False when nothing matched the mood and Nexo chose the closest. */
  fits: boolean
  /** Who picked it: Nexo, or an assistant in its chat (save_suggestion). */
  recommender?: 'nexo' | AssistantKey
  at: string
}

/** The pick's maker for its tag: the assistant's name, uppercase; none for Nexo's. */
function useMaker(pick: NexoPick): string | null {
  const t = useMessages(messages)
  if (!pick.recommender || pick.recommender === 'nexo') return null
  return assistantName(pick.recommender)?.toUpperCase() ?? t('unnamed')
}

/** An assistant's pick says who made it: its logo before the line; none on Nexo's. */
function MakerMark({ pick }: { pick: NexoPick }) {
  if (!pick.recommender || pick.recommender === 'nexo') return null
  return <AppLogo name={pick.recommender} />
}

export interface PickAsk {
  mood: string
  scope: PickScope
  ownedOnly: boolean
}

const MOODS = ['easy', 'short', 'relax', 'challenge'] as const
const MAX_MOOD = 120

/** One pick: the game, what the player asked, why and where to start. */
function PickBody({ pick }: { pick: NexoPick }) {
  const t = useMessages(messages)
  return (
    <>
      <Link className="nexo-pick-game" to={titleHref(pick.game.id)}>
        <Cover url={pick.game.cover_url} name={pick.game.name} className="nexo-pick-cover" />
        <b>{pick.game.name}</b>
        <Icon name="arrow" />
      </Link>
      {pick.mood && <p className="nexo-pick-asked">{t('asked', { mood: pick.mood })}</p>}
      <p>{plainText(pick.why)}</p>
      {pick.firstStep && (
        <p className="nexo-pick-first">
          <span>{t('first')}</span> {plainText(pick.firstStep)}
        </p>
      )}
    </>
  )
}

/** When a pick came and who made it: an assistant's name, or where Nexo looked. */
function PickMeta({ pick: p }: { pick: NexoPick }) {
  const t = useMessages(messages)
  const maker = useMaker(p)
  return (
    <span className="nexo-pick-meta nexo-pick-by">
      <MakerMark pick={p} />
      {fmtWhen(p.at)} · {maker ?? (p.scope ? t(p.scope) : '')}
      {p.ownedOnly ? ` · ${t('ownedTag')}` : ''}
    </span>
  )
}

/** The earlier picks, the latest first, in a dialog. */
function PickHistory({ picks, onClose }: { picks: NexoPick[]; onClose: () => void }) {
  const t = useMessages(messages)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
  }, [])
  return (
    <dialog
      ref={ref}
      className="nexo-pick-history"
      aria-labelledby="nexo-pick-history-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <header>
        <h2 id="nexo-pick-history-title">{t('historyTitle')}</h2>
        <button type="button" className="icon-button" aria-label={t('close')} onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <ol>
        {picks.map((p) => (
          <li key={p.id}>
            <PickMeta pick={p} />
            <PickBody pick={p} />
          </li>
        ))}
      </ol>
    </dialog>
  )
}

/** Under the question: a few moods to tap, where to look and whether to keep to games the player has. */
function PickFilters({
  mood,
  onMood,
  scope,
  onScope,
  ownedOnly,
  onOwnedOnly,
}: {
  mood: string
  onMood: (mood: string) => void
  scope: PickScope
  onScope: (scope: PickScope) => void
  ownedOnly: boolean
  onOwnedOnly: (on: boolean) => void
}) {
  const t = useMessages(messages)
  return (
    <div className="nexo-pick-filters" id="nexo-pick-options">
      <input
        type="text"
        value={mood}
        maxLength={MAX_MOOD}
        aria-label={t('mood')}
        placeholder={t('moodPlaceholder')}
        onChange={(e) => onMood(e.target.value)}
      />
      <div className="chips">
        {MOODS.map((m) => {
          const text = t(`moods.${m}`)
          const on = mood.trim() === text
          return (
            <button
              key={m}
              type="button"
              className={`chip${on ? ' active' : ''}`}
              aria-pressed={on}
              onClick={() => onMood(on ? '' : text)}
            >
              {text}
            </button>
          )
        })}
      </div>
      <fieldset className="segmented" aria-label={t('where')}>
        {(['interests', 'any'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={scope === s}
            data-tip={t(`${s}Hint`)}
            onClick={() => onScope(s)}
          >
            {t(s)}
          </button>
        ))}
      </fieldset>
      <label className="nexo-pick-owned" data-tip={t('ownedHint')}>
        <input
          type="checkbox"
          checked={ownedOnly}
          onChange={(e) => onOwnedOnly(e.target.checked)}
        />
        {t('ownedOnly')}
      </label>
    </div>
  )
}

/** Arrived here to ask: the panel comes to the middle of the screen, briefly lit, with the focus on
 * the button. */
function useSpotlight(spotlight: boolean) {
  const section = useRef<HTMLElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const [lit, setLit] = useState(spotlight)
  useEffect(() => {
    if (!spotlight) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // After the shell's own effect, which sends every new page to the top.
    const frame = requestAnimationFrame(() => {
      section.current?.scrollIntoView?.({ block: 'center', behavior: still ? 'auto' : 'smooth' })
      button.current?.focus({ preventScroll: true })
    })
    const off = setTimeout(() => setLit(false), 1600)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(off)
    }
  }, [spotlight])
  return { section, button, lit }
}

/** The latest pick: when it came, the pick itself, a way past the interests when nothing fit, and
 * the earlier ones a tap away. */
function LatestPick({
  pick,
  earlier,
  disabled,
  onBeyond,
  onHistory,
}: {
  pick: NexoPick
  earlier: number
  disabled: boolean
  onBeyond: () => void
  onHistory: () => void
}) {
  const t = useMessages(messages)
  const maker = useMaker(pick)
  const when = fmtWhen(pick.at)
  return (
    <div className="nexo-pick-latest">
      <span className="eyebrow nexo-pick-by">
        <MakerMark pick={pick} />
        {maker ? t('latestBy', { name: maker, when }) : t('latest', { when })}
      </span>
      <PickBody pick={pick} />
      {!pick.fits && pick.scope === 'interests' && (
        <p className="nexo-pick-nofit">
          {t('noFit')}{' '}
          <button type="button" className="text-link" disabled={disabled} onClick={onBeyond}>
            {t('lookBeyond')}
          </button>
        </p>
      )}
      {earlier > 0 && (
        <button type="button" className="ghost sm" onClick={onHistory}>
          <Icon name="history" /> {t('history', { count: earlier })}
        </button>
      )}
    </div>
  )
}

/** Under the ask: Nexo at work, the stored picks loading, the latest pick, or what went wrong. */
function PickResult({
  picks,
  asking,
  failed,
  none,
  disabled,
  onBeyond,
  onHistory,
}: {
  picks: NexoPick[] | null
  asking: boolean
  failed: boolean
  none: boolean
  disabled: boolean
  onBeyond: (latest: NexoPick) => void
  onHistory: () => void
}) {
  const t = useMessages(messages)
  const latest = picks?.[0]
  return (
    <div className="nexo-pick-result" aria-live="polite" aria-busy={asking || picks === null}>
      {asking ? (
        <div className="nexo-pick-wait">
          <img className="nexo-pick-nexo" src="/nexo-avatar.svg" alt="" />
          <div>
            <span>{t('thinking')}</span>
            <Sk w="80%" h={10} style={{ marginTop: 8 }} />
            <Sk w="55%" h={10} style={{ marginTop: 6 }} />
          </div>
        </div>
      ) : picks === null ? (
        <div className="nexo-pick-wait">
          <Sk w={64} h={36} />
          <div>
            <Sk w="40%" h={12} />
            <Sk w="75%" h={10} style={{ marginTop: 8 }} />
          </div>
        </div>
      ) : latest ? (
        <LatestPick
          pick={latest}
          earlier={picks.length - 1}
          disabled={disabled}
          onBeyond={() => onBeyond(latest)}
          onHistory={onHistory}
        />
      ) : null}
      {failed && (
        <p className="nexo-pick-error" role="alert">
          {t('failed')}
        </p>
      )}
      {none && !asking && <p className="nexo-pick-none">{t('none')}</p>}
    </div>
  )
}

/** The question and what it is for; how Nexo picks opens under it on a tap. */
function PickCopy() {
  const t = useMessages(messages)
  const [how, setHow] = useState(false)
  return (
    <div className="nexo-pick-copy">
      <h2 id="nexo-pick-title">{t('title')}</h2>
      <p>
        {t('lead')}{' '}
        <button
          type="button"
          className="text-link nexo-pick-how"
          aria-expanded={how}
          aria-controls="nexo-pick-how"
          onClick={() => setHow(!how)}
        >
          {t('howLink')}
        </button>
      </p>
      {how && (
        <p id="nexo-pick-how" className="nexo-pick-how-text">
          {t('how')}
        </p>
      )}
    </div>
  )
}

/** The panel: what the player asks, Nexo at work, and the latest pick. `picks` is null while the
 * stored ones load. */
export function NexoPickPanel({
  picks,
  asking = false,
  failed = false,
  none = false,
  disabled = false,
  initialScope = 'any',
  spotlight = false,
  onAsk,
}: {
  picks: NexoPick[] | null
  asking?: boolean
  failed?: boolean
  /** The last ask had nothing to choose from. */
  none?: boolean
  disabled?: boolean
  initialScope?: PickScope
  /** Arrived here to ask (from the interests): the panel comes to the middle of the screen, briefly
   * lit, with the cursor in the mood. */
  spotlight?: boolean
  onAsk: (ask: PickAsk) => void
}) {
  const t = useMessages(messages)
  const { section, button, lit } = useSpotlight(spotlight)
  // Folded, unless the player came from their interests: then where it looks shows at once.
  const [open, setOpen] = useState(initialScope === 'interests')
  const [mood, setMood] = useState('')
  const [scope, setScope] = useState<PickScope>(initialScope)
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [history, setHistory] = useState(false)
  const latest = picks?.[0]
  const earlier = picks?.slice(1) ?? []
  const ask = (over?: Partial<PickAsk>) => onAsk({ mood: mood.trim(), scope, ownedOnly, ...over })
  return (
    <section
      ref={section}
      className={`nexo-pick${lit ? ' lit' : ''}`}
      aria-labelledby="nexo-pick-title"
    >
      <form
        className="nexo-pick-form"
        onSubmit={(e) => {
          e.preventDefault()
          ask()
        }}
      >
        {/* Nexo, the question and the button: one tap is enough. Giving a direction is optional and
            folded under it. */}
        <div className="nexo-pick-top">
          <img className="nexo-pick-nexo" src="/nexo-avatar.svg" alt="" />
          <div className="nexo-pick-main">
            <PickCopy />
            <button
              type="button"
              className="nexo-pick-tune"
              aria-expanded={open}
              aria-controls="nexo-pick-options"
              onClick={() => setOpen(!open)}
            >
              {t('tune')} <span>{t('optional')}</span>
              <Icon name={open ? 'chevron-up' : 'chevron-down'} />
            </button>
            {open && (
              <PickFilters
                mood={mood}
                onMood={setMood}
                scope={scope}
                onScope={setScope}
                ownedOnly={ownedOnly}
                onOwnedOnly={setOwnedOnly}
              />
            )}
          </div>
          <button ref={button} type="submit" className="button" disabled={disabled || asking}>
            <Icon name="nexo" /> {t(latest ? 'again' : 'ask')}
          </button>
        </div>
      </form>
      <PickResult
        picks={picks}
        asking={asking}
        failed={failed}
        none={none}
        disabled={disabled}
        onBeyond={(latest) => {
          setScope('any')
          setOpen(true)
          onAsk({ mood: latest.mood ?? '', scope: 'any', ownedOnly: latest.ownedOnly })
        }}
        onHistory={() => setHistory(true)}
      />
      {history && <PickHistory picks={earlier} onClose={() => setHistory(false)} />}
    </section>
  )
}

/** The panel with its requests: the stored picks once per visit (no model), and a new one on the
 * button. A pick among the interests also marks that row as the next platinum, as the server did. */
export function NexoPickBox({
  initialScope,
  spotlight,
}: {
  initialScope?: PickScope
  spotlight?: boolean
}) {
  const { cache, me, setData } = useApp()
  const [picks, setPicks] = useState<NexoPick[] | null>(
    () => (cache.picks as NexoPick[] | undefined) ?? null,
  )
  const [asking, setAsking] = useState(false)
  const [failed, setFailed] = useState(false)
  const [none, setNone] = useState(false)
  // The request in flight is cached too, so coming back mid-load waits for it.
  useEffect(() => {
    if (cache.picks) return
    const load =
      (cache.picksLoad as Promise<{ picks: NexoPick[] }> | undefined) ??
      api<{ picks: NexoPick[] }>('/api/picks')
    cache.picksLoad = load
    load
      .then(({ picks }) => {
        cache.picks = picks
        setPicks(picks)
      })
      .catch(() => setPicks([]))
      .finally(() => {
        if (cache.picksLoad === load) delete cache.picksLoad
      })
  }, [cache])
  const ask = async (body: PickAsk) => {
    setAsking(true)
    setFailed(false)
    setNone(false)
    try {
      const { pick } = await api<{ pick: NexoPick | null }>('/api/picks', body)
      if (pick) {
        const next = [pick, ...((cache.picks as NexoPick[] | undefined) ?? [])]
        cache.picks = next
        setPicks(next)
        if (pick.scope === 'interests') {
          setData((d) =>
            d?.goals
              ? {
                  ...d,
                  goals: {
                    ...d.goals,
                    interests: d.goals.interests.map((i) => ({
                      ...i,
                      nextPickAt: i.game.id === pick.game.id ? pick.at : null,
                    })),
                  },
                }
              : d,
          )
        }
      } else setNone(true)
      modelWorkDone()
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) setFailed(true)
    } finally {
      setAsking(false)
    }
  }
  return (
    <NexoPickPanel
      picks={picks}
      asking={asking}
      failed={failed}
      none={none}
      disabled={me.demo}
      initialScope={initialScope}
      spotlight={spotlight}
      onAsk={ask}
    />
  )
}
