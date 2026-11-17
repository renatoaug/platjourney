/** Reacting to a community event: a small pill with the reactions given and their total. A tap
 * opens a bar of the reactions over it; pressing and holding opens it too, and sliding the finger
 * across lights each one up with its name, choosing the one under the finger on release. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import { type CommunityEvent, REACTIONS, type ReactionKind } from '../../lib/community'
import { Icon } from '../../ui/icon'
import './community-reactions.css'

const messages = defineMessages({
  [Language.PtBR]: {
    react: 'Reagir',
    reactOn: 'Reagir a {event}: {count}',
    choose: 'Escolha uma reação',
    like: 'Curti',
    gg: 'GG',
    fire: 'Fogo',
    wow: 'Uau',
    skull: 'Sofrido',
    people: { one: '{count} pessoa', other: '{count} pessoas' },
    option: '{reaction}: {count}',
  },
  [Language.En]: {
    react: 'React',
    reactOn: 'React to {event}: {count}',
    choose: 'Pick a reaction',
    like: 'Like',
    gg: 'GG',
    fire: 'Fire',
    wow: 'Wow',
    skull: 'Hard-won',
    people: { one: '{count} person', other: '{count} people' },
    option: '{reaction}: {count}',
  },
})

const ICON: Record<ReactionKind, string> = {
  like: 'thumbs-up',
  gg: 'trophy',
  fire: 'flame',
  wow: 'sparkles',
  skull: 'skull',
}
// How long a press waits before it counts as holding.
const HOLD_MS = 220

export function CommunityReactions({
  event: e,
  name,
  onReact,
  readOnly = false,
}: {
  event: CommunityEvent
  name: string
  onReact: (kind: ReactionKind) => void
  /** The demo looks without taking part. */
  readOnly?: boolean
}) {
  const t = useMessages(messages)
  const [open, setOpen] = useState(false)
  const [hot, setHot] = useState<ReactionKind | null>(null)
  const [plus, setPlus] = useState(0)
  const [bump, setBump] = useState(false)
  const held = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const root = useRef<HTMLSpanElement>(null)
  const counts = e.reactions.counts
  const total = REACTIONS.reduce((n, k) => n + counts[k], 0)
  // The pill shows at most the three most given, so the faces never pile up.
  const given = REACTIONS.filter((k) => counts[k] > 0)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 3)
  const mine = e.reactions.mine.length > 0

  const close = useCallback(() => {
    setOpen(false)
    setHot(null)
  }, [])
  const choose = (kind: ReactionKind) => {
    if (!e.reactions.mine.includes(kind)) {
      setPlus((n) => n + 1)
      setBump(true)
      setTimeout(() => setBump(false), 450)
    }
    onReact(kind)
    close()
  }

  // Open: a tap or a press outside closes it, and so does Escape.
  useEffect(() => {
    if (!open) return
    const outside = (ev: PointerEvent) => {
      if (!root.current?.contains(ev.target as Node)) close()
    }
    const key = (ev: KeyboardEvent) => ev.key === 'Escape' && close()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
    }
  }, [open, close])

  // Holding: the reaction under the finger lights up, and letting go picks it.
  const under = (x: number, y: number) =>
    (document.elementFromPoint(x, y)?.closest('[data-reaction]') as HTMLElement | null)?.dataset
      .reaction as ReactionKind | undefined
  const onDown = (ev: React.PointerEvent) => {
    if (readOnly) return
    held.current = false
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      held.current = true
      setOpen(true)
    }, HOLD_MS)
    ;(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId)
  }
  const onMove = (ev: React.PointerEvent) => {
    if (held.current) setHot(under(ev.clientX, ev.clientY) ?? null)
  }
  const onUp = (ev: React.PointerEvent) => {
    clearTimeout(timer.current)
    if (!held.current) return
    held.current = false
    const kind = under(ev.clientX, ev.clientY)
    if (kind) choose(kind)
  }
  const onClick = () => {
    // A hold already opened it; a plain tap toggles it.
    if (readOnly || held.current) return
    setOpen((o) => !o)
  }

  return (
    <span className="community-reactions" ref={root}>
      <button
        type="button"
        className={`community-react${mine ? ' mine' : ''}`}
        data-bump={bump || undefined}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t('reactOn', { event: `${name} ${e.game?.name ?? ''}`.trim(), count: total })}
        disabled={readOnly && total === 0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => clearTimeout(timer.current)}
        onClick={onClick}
        onContextMenu={(ev) => ev.preventDefault()}
      >
        <span className="community-react-faces" aria-hidden="true">
          {(given.length ? given : REACTIONS).map((k) => (
            <span key={k} className={`community-react-face is-${k}${given.length ? '' : ' idle'}`}>
              <Icon name={ICON[k]} />
            </span>
          ))}
        </span>
        <span className="community-react-count">{total > 0 ? total : t('react')}</span>
        {plus > 0 && (
          <span key={plus} className="community-react-plus" aria-hidden="true">
            +1
          </span>
        )}
      </button>
      {open && (
        <fieldset className="community-react-bar" aria-label={t('choose')}>
          {REACTIONS.map((k, i) => (
            <button
              key={k}
              type="button"
              data-reaction={k}
              className={`community-react-option is-${k}${hot === k ? ' hot' : ''}`}
              style={{ '--i': i } as React.CSSProperties}
              aria-pressed={e.reactions.mine.includes(k)}
              aria-label={t('option', { reaction: t(k), count: counts[k] })}
              onPointerEnter={() => setHot(k)}
              onPointerLeave={() => setHot((h) => (h === k ? null : h))}
              onClick={() => choose(k)}
            >
              <Icon name={ICON[k]} />
              {/* On a touch screen, with no hover, each reaction says its name under it. */}
              <span className="community-react-label" aria-hidden="true">
                {t(k)}
              </span>
              {e.reactions.mine.includes(k) && (
                <span className="community-react-mine" aria-hidden="true">
                  <Icon name="check" />
                </span>
              )}
              {hot === k && (
                <span className="community-react-tip" aria-hidden="true">
                  <b>{t(k)}</b>
                  <small>{t('people', { count: counts[k] })}</small>
                </span>
              )}
            </button>
          ))}
        </fieldset>
      )}
    </span>
  )
}
