/** The trophy room: the player's records among their platinums, each a large glass card on its game's
 * art (the rarest, the fastest, the longest and the first). The whole collection is listed further
 * down the profile; this is the showcase. */
import { Link } from 'react-router'
import { defineMessages, getLocale, Language, useMessages } from '../i18n/i18n'
import { fmtHours, fmtRate } from '../lib/format'
import type { Platinum } from '../pages/profile'
import { image } from './game-showcase'
import { titleHref } from './tip'
import './trophy-room.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'Sala de troféus',
    title: 'Seus recordes',
    rarest: 'A mais rara',
    rarestStat: '{rate}% dos jogadores têm',
    fastest: 'A mais rápida',
    fastestStat: 'em {hours}',
    longest: 'A mais longa',
    longestStat: '{hours} de jogo',
    first: 'A primeira',
    firstStat: 'em {date}',
  },
  [Language.En]: {
    eyebrow: 'Trophy room',
    title: 'Your records',
    rarest: 'The rarest',
    rarestStat: '{rate}% of players have it',
    fastest: 'The fastest',
    fastestStat: 'in {hours}',
    longest: 'The longest',
    longestStat: '{hours} played',
    first: 'The first',
    firstStat: 'on {date}',
  },
})

type Record = { key: 'rarest' | 'fastest' | 'longest' | 'first'; p: Platinum; stat: string }

/** The records, each from a different game when the list allows it; a record with no data is left out. */
function recordsOf(platinums: Platinum[], t: ReturnType<typeof useMessages<typeof messages>>) {
  const used = new Set<string>()
  const pick = (sorted: Platinum[]) => {
    const p = sorted.find((x) => !used.has(x.game.id)) ?? sorted[0]
    if (p) used.add(p.game.id)
    return p
  }
  const timed = platinums.filter((p) => p.hours)
  const out: (Record | null)[] = []
  const rarest = pick([...platinums].sort((a, b) => a.rarity - b.rarity))
  out.push(
    rarest
      ? { key: 'rarest', p: rarest, stat: t('rarestStat', { rate: fmtRate(rarest.rarity) }) }
      : null,
  )
  const fastest =
    timed.length > 1 ? pick([...timed].sort((a, b) => (a.hours ?? 0) - (b.hours ?? 0))) : null
  out.push(
    fastest
      ? { key: 'fastest', p: fastest, stat: t('fastestStat', { hours: fmtHours(fastest.hours) }) }
      : null,
  )
  const longest =
    timed.length > 1 ? pick([...timed].sort((a, b) => (b.hours ?? 0) - (a.hours ?? 0))) : null
  out.push(
    longest
      ? { key: 'longest', p: longest, stat: t('longestStat', { hours: fmtHours(longest.hours) }) }
      : null,
  )
  const first = pick([...platinums].sort((a, b) => a.earnedAt.localeCompare(b.earnedAt)))
  out.push(
    first
      ? {
          key: 'first',
          p: first,
          stat: t('firstStat', {
            date: new Date(first.earnedAt).toLocaleDateString(getLocale(), {
              month: 'long',
              year: 'numeric',
            }),
          }),
        }
      : null,
  )
  return out.filter((r): r is Record => r !== null)
}

function RecordCard({ record: { key, p, stat } }: { record: Record }) {
  const t = useMessages(messages)
  const shot = p.game.screenshot_ids?.[0]
  const art = shot ? image(shot, 't_screenshot_big') : p.game.cover_url
  return (
    <Link className={`room-record ${key}`} to={titleHref(p.game.id)}>
      {art && <img className="room-record-art" src={art} alt="" loading="lazy" />}
      <span className="room-record-body">
        <span className="eyebrow">{t(key)}</span>
        <b>{p.game.name}</b>
        <span className="room-record-stat">{stat}</span>
      </span>
    </Link>
  )
}

export function TrophyRoom({ platinums }: { platinums: Platinum[] }) {
  const t = useMessages(messages)
  if (!platinums.length) return null
  const records = recordsOf(platinums, t)
  return (
    <section className="trophy-room" aria-labelledby="trophy-room-title">
      <header>
        <span className="eyebrow">{t('eyebrow')}</span>
        <h2 id="trophy-room-title">{t('title')}</h2>
      </header>
      <div className="room-records">
        {records.map((r) => (
          <RecordCard key={r.key} record={r} />
        ))}
      </div>
    </section>
  )
}
