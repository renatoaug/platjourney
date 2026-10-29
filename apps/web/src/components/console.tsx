/** The top of the home screen, the way a console shows a library: the focused game's art fills the
 * stage, with its progress and Nexo's word on it, over a shelf of covers to move through. The game
 * being played comes first, then the radar, then the platinums. A second press on the focused cover
 * opens the game, the art and the title carried over to its page. */
import { type CSSProperties, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useProfile } from '../app/use-profile'
import { defineMessages, getLocale, Language, useMessages } from '../i18n/i18n'
import { fmtHours, fmtPlayTime, fmtRate, pct } from '../lib/format'
import { tintStyle } from '../lib/tint'
import type { AppStateData } from '../lib/types'
import type { Platinum } from '../pages/profile'
import { BoldText } from '../ui/bold-text'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { DifficultyMeter } from './difficulty-meter'
import { titleHref } from './tip'
import './console.css'

const messages = defineMessages({
  [Language.PtBR]: {
    shelf: 'Seus jogos',
    platinumed: 'Platinados',
    label: {
      current: 'Jogando agora',
      radar: 'No radar da platina',
      platinum: 'Platinado',
    },
    ofTotal: '<b>{earned}</b> de {total} troféus',
    platinumAhead: 'Platina no fim da barra',
    played: '{hours} jogadas',
    guideTime: '~{time} até a platina',
    rarity: 'Platina de {rate}% dos jogadores',
    earnedOn: 'Conquistada em {date}',
    nexo: {
      remaining: {
        one: 'Falta <b>1 troféu</b> para a platina. Abra o jogo e veja qual.',
        other: 'Faltam <b>{count} troféus</b> para a platina. O guia diz por onde começar.',
      },
      platinum: 'Sua <b>{ordinal}ª platina</b>, de {count}.',
      noTip: 'Abra o jogo para ver o caminho até a platina, fase por fase.',
    },
    open: 'Abrir jogo',
    askNexo: 'Perguntar ao Nexo',
    hint: '← → para navegar · Enter para abrir',
    empty: 'Jogue algo na PSN e ele aparece aqui, com a arte do jogo.',
    explore: 'Explorar minha biblioteca',
  },
  [Language.En]: {
    shelf: 'Your games',
    platinumed: 'Platinumed',
    label: {
      current: 'Playing now',
      radar: 'On the platinum radar',
      platinum: 'Platinumed',
    },
    ofTotal: '<b>{earned}</b> of {total} trophies',
    platinumAhead: 'Platinum at the end of the bar',
    played: '{hours} played',
    guideTime: '~{time} to the platinum',
    rarity: 'Platinum held by {rate}% of players',
    earnedOn: 'Earned on {date}',
    nexo: {
      remaining: {
        one: '<b>1 trophy</b> left for the platinum. Open the game to see which.',
        other: '<b>{count} trophies</b> left for the platinum. The guide says where to start.',
      },
      platinum: 'Your <b>platinum #{ordinal}</b> of {count}.',
      noTip: 'Open the game to see the road to the platinum, phase by phase.',
    },
    open: 'Open game',
    askNexo: 'Ask Nexo',
    hint: '← → to move · Enter to open',
    empty: 'Play something on PSN and it shows up here, with its art.',
    explore: 'Explore my library',
  },
})

type Kind = 'current' | 'radar' | 'platinum'

interface Item {
  key: string
  kind: Kind
  name: string
  cover?: string | null
  art?: string | null
  /** The art is the cover stretched: blurred, so it reads as a color and not as a blown-up picture. */
  blur: boolean
  tint?: string | null
  to: string
  earned: number
  total: number
  progress: number
  remaining: number
  difficulty?: number | null
  hours?: number | null
  guideHours?: number | null
  platform?: string
  rarity?: number
  earnedAt?: string
  ordinal?: number
  tip?: string
}

const bigCover = (url?: string | null) => url?.replace('/t_cover_big/', '/t_1080p/') ?? null

// The catalog's wide pictures are screenshots or artwork; a cover blown up is not one.
const isCover = (art?: string | null, cover?: string | null) =>
  !art || (!!cover && art === bigCover(cover)) || art.includes('/t_cover')

function items(data: AppStateData, platinums: Platinum[] | null): Item[] {
  const list: Item[] = []
  const c = data.current
  if (c && c.owned !== false) {
    const base = c.groups?.base
    const tip = data.tips.find(
      (tip) =>
        tip.game?.id === c.game.id && ['start', 'unlock', 'session', 'route'].includes(tip.kind),
    )
    list.push({
      key: `c:${c.game.id}`,
      kind: 'current',
      name: c.name,
      cover: c.game.cover_url,
      art: c.icon,
      blur: isCover(c.icon, c.game.cover_url),
      tint: c.game.tint,
      to: '/game',
      earned: base?.earned ?? c.earned,
      total: base?.total ?? c.total,
      progress: base ? Math.round((base.earned / base.total) * 100) : c.progress,
      remaining: base?.remaining ?? Math.max(0, c.total - c.earned - 1),
      difficulty: c.guide?.difficulty,
      hours: c.hoursPlayed,
      guideHours: c.guide?.hours,
      platform: c.platform,
      tip: tip?.content.split(/\n\s*\n/)[0],
    })
  }
  for (const r of data.ranking) {
    if (c && r.game === c.game.id) continue
    list.push({
      key: `r:${r.game}`,
      kind: 'radar',
      name: r.name,
      cover: r.cover,
      art: r.art,
      blur: isCover(r.art, r.cover),
      tint: r.tint,
      to: titleHref(r.game),
      earned: r.earned,
      total: r.total,
      progress: r.progress,
      remaining: r.remaining,
      difficulty: r.difficulty,
      hours: r.hours,
      guideHours: r.guideHours,
      platform: r.platform,
    })
  }
  const plats = [...(platinums ?? [])].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
  plats.forEach((p, i) => {
    const art = p.game.art_url ?? bigCover(p.game.cover_url)
    list.push({
      key: `p:${p.game.id}`,
      kind: 'platinum',
      name: p.game.name,
      cover: p.game.cover_url,
      art,
      blur: !p.game.art_url,
      tint: p.game.tint,
      to: titleHref(p.game.id),
      earned: 1,
      total: 1,
      progress: 100,
      remaining: 0,
      hours: p.hours,
      platform: p.platform,
      rarity: p.rarity,
      earnedAt: p.earnedAt,
      ordinal: plats.length - i,
    })
  })
  return list
}

// Nexo's own words are markdown; the stage shows the first paragraph as plain text.
const plain = (text: string) => text.replace(/[*_`#>]/g, '').trim()

/** The focused game's facts: difficulty, time, rarity and when it was platinumed. */
function Meta({ item }: { item: Item }) {
  const t = useMessages(messages)
  return (
    <div className="console-meta">
      {item.difficulty ? <DifficultyMeter value={item.difficulty} look="compact" /> : null}
      {item.hours != null && (
        <span>
          <Icon name="clock" /> {t('played', { hours: fmtHours(item.hours) })}
        </span>
      )}
      {item.kind !== 'platinum' && item.guideHours ? (
        <span>{t('guideTime', { time: fmtPlayTime(item.guideHours) })}</span>
      ) : null}
      {item.rarity != null && <span>{t('rarity', { rate: fmtRate(item.rarity) })}</span>}
      {item.earnedAt && (
        <span>
          {t('earnedOn', {
            date: new Date(item.earnedAt).toLocaleDateString(getLocale(), {
              month: 'long',
              year: 'numeric',
            }),
          })}
        </span>
      )}
      {item.platform && <span>{item.platform.replaceAll(',', '/')}</span>}
    </div>
  )
}

/** Nexo's word on the focused game: its last note for the game played, else a line from the numbers. */
function NexoLine({ item, platinums }: { item: Item; platinums: number }) {
  const t = useMessages(messages)
  return (
    <p className="console-nexo">
      <span className="dot" aria-hidden="true" />
      <span>
        <b>Nexo:</b>{' '}
        {item.tip ? (
          plain(item.tip)
        ) : item.kind === 'platinum' ? (
          <BoldText
            text={t('nexo.platinum', {
              ordinal: item.ordinal ?? 1,
              count: platinums,
            })}
          />
        ) : item.remaining > 0 ? (
          <BoldText text={t('nexo.remaining', { count: item.remaining })} />
        ) : (
          t('nexo.noTip')
        )}
      </span>
    </p>
  )
}

/** What the stage says about the focused game, replayed in when the focus moves. */
function Focus({ item, platinums, onOpen }: { item: Item; platinums: number; onOpen: () => void }) {
  const t = useMessages(messages)
  return (
    <div className="console-focus">
      <span className="eyebrow">{t(`label.${item.kind}`)}</span>
      <h2 className="console-title" style={{ '--title-chars': item.name.length } as CSSProperties}>
        {item.name}
      </h2>
      <Meta item={item} />
      {item.kind !== 'platinum' && (
        <div className="console-progress">
          <div className="console-progress-label">
            <span>
              <BoldText text={t('ofTotal', { earned: item.earned, total: item.total })} />
            </span>
            <span>{item.progress}%</span>
          </div>
          <div className="bar-row">
            <div className="bar">
              <i style={{ width: `${pct(item.progress)}%` }} />
            </div>
            <span className="plat-mark" title={t('platinumAhead')}>
              <Icon name="trophy" />
            </span>
          </div>
        </div>
      )}
      <NexoLine item={item} platinums={platinums} />
      <div className="console-actions">
        <button className="button" type="button" onClick={onOpen}>
          {t('open')} <Icon name="arrow" />
        </button>
        {item.kind !== 'platinum' && (
          <Link className="button secondary" to="/nexo">
            {t('askNexo')}
          </Link>
        )}
      </div>
    </div>
  )
}

export function Console({ data }: { data: AppStateData }) {
  const t = useMessages(messages)
  const navigate = useNavigate()
  const profile = useProfile()
  const list = useMemo(() => items(data, profile?.platinums ?? null), [data, profile])
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const index = Math.max(
    0,
    list.findIndex((i) => i.key === focusKey),
  )
  const item = list[index]
  const shelf = useRef<HTMLElement>(null)
  // With nothing focused, the arrows move along the shelf too, the way a console's pad does.
  const onKeyRef = useRef<(e: globalThis.KeyboardEvent) => void>(() => {})
  useEffect(() => {
    const listen = (e: globalThis.KeyboardEvent) => {
      if (document.activeElement === document.body) onKeyRef.current(e)
    }
    window.addEventListener('keydown', listen)
    return () => window.removeEventListener('keydown', listen)
  }, [])
  // Every picture shown so far stays mounted, so moving back crossfades instead of loading again.
  const [seen, setSeen] = useState<string[]>([])
  const art = item?.art ?? null
  useEffect(() => {
    if (art) setSeen((s) => (s.includes(art) ? s : [...s, art].slice(-8)))
  }, [art])

  useEffect(() => {
    const el = shelf.current?.querySelector<HTMLElement>(
      `[data-key="${CSS.escape(item?.key ?? '')}"]`,
    )
    if (!el || !shelf.current) return
    const s = shelf.current
    s.scrollTo({ left: el.offsetLeft - s.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [item?.key])

  if (!item)
    return (
      <div className="console tinted empty-console">
        <div className="console-focus">
          <span className="eyebrow">{t('label.current')}</span>
          <p>{t('empty')}</p>
          <div className="console-actions">
            <Link className="button" to="/discover">
              {t('explore')} <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </div>
    )

  const open = (target: Item) => navigate(target.to, { viewTransition: true })
  const move = (by: number) => {
    const next = list[Math.max(0, Math.min(list.length - 1, index + by))]
    setFocusKey(next.key)
    shelf.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(next.key)}"]`)?.focus()
  }
  const onKey = (e: Pick<KeyboardEvent, 'key' | 'preventDefault'>) => {
    if (e.key === 'ArrowRight') move(1)
    else if (e.key === 'ArrowLeft') move(-1)
    else return
    e.preventDefault()
  }
  onKeyRef.current = onKey
  const firstPlatinum = list.findIndex((i) => i.kind === 'platinum')

  return (
    <div className="console tinted" style={tintStyle(item.tint)}>
      <div className="console-art" aria-hidden="true">
        {seen.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            className={[src === art ? 'on' : '', src === art && item.blur ? 'blur' : '']
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
      <Focus
        key={item.key}
        item={item}
        platinums={profile?.platinums.length ?? 1}
        onOpen={() => open(item)}
      />
      <section className="console-shelf" ref={shelf} aria-label={t('shelf')}>
        {list.map((it, i) => (
          <div key={it.key} className="console-slot">
            {i === firstPlatinum && <span className="console-sep">{t('platinumed')}</span>}
            <button
              type="button"
              data-key={it.key}
              aria-label={it.name}
              aria-current={it.key === item.key}
              tabIndex={it.key === item.key ? 0 : -1}
              onClick={() => (it.key === item.key ? open(it) : setFocusKey(it.key))}
              onKeyDown={onKey}
            >
              <Cover url={it.cover} name={it.name} className="console-cover" />
              {it.kind === 'platinum' ? (
                <span className="console-plat">
                  <Icon name="trophy" />
                </span>
              ) : (
                <span className="console-mini">
                  <i style={{ width: `${pct(it.progress)}%` }} />
                </span>
              )}
              <span className="console-name">{it.name}</span>
            </button>
          </div>
        ))}
      </section>
      <span className="console-hint">{t('hint')}</span>
    </div>
  )
}

export function ConsoleSkeleton() {
  return (
    <div className="console tinted">
      <div className="console-focus">
        <Sk w="120px" h={10} />
        <Sk w="60%" h={56} />
        <Sk w="40%" h={12} />
        <Sk w="420px" h={9} />
      </div>
    </div>
  )
}
