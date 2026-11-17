import { plain, q } from '../db.ts'
import { userRef } from './user.ts'

/** A player who shows up in the community: everyone but the demo and who turned it off. */
export interface Member {
  id: string
  onlineId: string
  avatarUrl: string | null
}

export async function members(): Promise<Member[]> {
  const rows = plain(
    await q<{ id: string; psn_online_id: string; avatar_url: string | null }[]>(
      'SELECT id, psn_online_id, avatar_url FROM user WHERE community_visible != false AND demo != true',
    ),
  )
  return rows.map((r) => ({
    id: r.id.replace(/^user:/, ''),
    onlineId: r.psn_online_id,
    avatarUrl: r.avatar_url ?? null,
  }))
}

const ids = (users: string[]) => users.map(userRef)

export interface PlatinumEvent {
  user: string
  np: string
  game: string | null
  trophy: string
  at: string
  rate: number
}

export async function platinumsSince(users: string[], since: Date): Promise<PlatinumEvent[]> {
  const rows = plain(
    await q<
      {
        user: string
        np_communication_id: string
        game: string | null
        trophy_name: string
        earned_at: string
        rarity_rate: number
      }[]
    >(
      'SELECT record::id(user) AS user, np_communication_id, record::id(game) AS game, trophy_name, earned_at, rarity_rate FROM platinum WHERE user IN $users AND earned_at > $since',
      { users: ids(users), since },
    ),
  )
  return rows.map((r) => ({
    user: String(r.user),
    np: r.np_communication_id,
    game: r.game === null || r.game === undefined ? null : String(r.game),
    trophy: r.trophy_name,
    at: new Date(r.earned_at).toISOString(),
    rate: r.rarity_rate,
  }))
}

export interface UnlockRow {
  user: string
  np: string
  trophyId: number
  at: string
}

export async function unlocksSince(users: string[], since: Date): Promise<UnlockRow[]> {
  const rows = plain(
    await q<{ user: string; np_communication_id: string; trophy_id: number; earned_at: string }[]>(
      'SELECT record::id(user) AS user, np_communication_id, trophy_id, earned_at FROM unlock WHERE user IN $users AND earned_at > $since',
      { users: ids(users), since },
    ),
  )
  return rows.map((r) => ({
    user: String(r.user),
    np: r.np_communication_id,
    trophyId: r.trophy_id,
    at: new Date(r.earned_at).toISOString(),
  }))
}

// PlayStation trophies began in 2008: an earlier unlock time is a placeholder PSN sends, not a date.
const TROPHIES_BEGAN = new Date('2008-01-01T00:00:00Z')

/** Each player's first unlock on each of the given lists, to tell a new game from one going on. */
export async function firstUnlocks(users: string[], nps: string[]): Promise<Map<string, string>> {
  if (!users.length || !nps.length) return new Map()
  const rows = plain(
    await q<{ user: string; np_communication_id: string; first: string }[]>(
      'SELECT record::id(user) AS user, np_communication_id, math::min(earned_at) AS first FROM unlock WHERE user IN $users AND np_communication_id IN $nps AND earned_at > $since GROUP BY user, np_communication_id',
      { users: ids(users), nps, since: TROPHIES_BEGAN },
    ),
  )
  return new Map(
    rows.map((r) => [`${r.user}|${r.np_communication_id}`, new Date(r.first).toISOString()]),
  )
}

export interface Rarity {
  np: string
  trophyId: number
  type: string
  name: string
  nameEn: string
  rate: number
}

export async function raritiesOn(nps: string[]): Promise<Map<string, Rarity>> {
  if (!nps.length) return new Map()
  const rows = plain(
    await q<
      {
        np_communication_id: string
        trophy_id: number
        type: string
        name: string
        name_en: string
        earned_rate: number
      }[]
    >(
      'SELECT np_communication_id, trophy_id, type, name, name_en, earned_rate FROM trophy_rarity WHERE np_communication_id IN $nps',
      { nps },
    ),
  )
  return new Map(
    rows.map((r) => [
      `${r.np_communication_id}|${r.trophy_id}`,
      {
        np: r.np_communication_id,
        trophyId: r.trophy_id,
        type: r.type,
        name: r.name,
        nameEn: r.name_en,
        rate: r.earned_rate,
      },
    ]),
  )
}

/** Keeps the share of players of every trophy on a list a player who owns the game opened. */
export async function saveRarities(np: string, trophies: Omit<Rarity, 'np'>[]): Promise<void> {
  if (!trophies.length) return
  await q(
    `FOR $t IN $rows {
       UPSERT trophy_rarity SET np_communication_id = $np, trophy_id = $t.trophy_id, type = $t.type,
         name = $t.name, name_en = $t.name_en, earned_rate = $t.earned_rate
       WHERE np_communication_id = $np AND trophy_id = $t.trophy_id;
     }`,
    {
      np,
      rows: trophies.map((t) => ({
        trophy_id: t.trophyId,
        type: t.type,
        name: t.name,
        name_en: t.nameEn,
        earned_rate: t.rate,
      })),
    },
  )
}

/** The name and art of the games on these lists, from any player's library. */
export async function gamesOn(
  nps: string[],
): Promise<Map<string, { name: string; iconUrl: string | null; game: string | null }>> {
  if (!nps.length) return new Map()
  const rows = plain(
    await q<
      { np_communication_id: string; name: string; icon_url: string | null; game: string | null }[]
    >(
      'SELECT np_communication_id, name, icon_url, record::id(game) AS game FROM title WHERE np_communication_id IN $nps',
      { nps },
    ),
  )
  const out = new Map<string, { name: string; iconUrl: string | null; game: string | null }>()
  for (const r of rows) {
    if (out.has(r.np_communication_id)) continue
    out.set(r.np_communication_id, {
      name: r.name,
      iconUrl: r.icon_url ?? null,
      game: r.game === null || r.game === undefined ? null : String(r.game),
    })
  }
  return out
}

export type MedalKind = 'rare_hunter' | 'quick_platinum' | 'no_day_off' | 'year_goal'

export async function medalsOf(
  users: string[],
): Promise<{ user: string; kind: MedalKind; at: string }[]> {
  const rows = plain(
    await q<{ user: string; kind: MedalKind; earned_at: string }[]>(
      'SELECT record::id(user) AS user, kind, earned_at FROM medal WHERE user IN $users',
      { users: ids(users) },
    ),
  )
  return rows.map((r) => ({
    user: String(r.user),
    kind: r.kind,
    at: new Date(r.earned_at).toISOString(),
  }))
}

/** Writes a medal the first time it is earned; an earned one stays as it is. */
export async function awardMedal(user: string, kind: MedalKind, at: string): Promise<void> {
  await q('INSERT IGNORE INTO medal { user: $user, kind: $kind, earned_at: $at }', {
    user: userRef(user),
    kind,
    at: new Date(at),
  })
}

export async function goalTargets(users: string[]): Promise<Map<string, Record<string, number>>> {
  const rows = plain(
    await q<{ id: string; goal_targets: Record<string, number> | null }[]>(
      'SELECT record::id(id) AS id, goal_targets FROM user WHERE id IN $users',
      { users: ids(users) },
    ),
  )
  return new Map(rows.map((r) => [String(r.id), r.goal_targets ?? {}]))
}

export async function following(user: string): Promise<string[]> {
  const rows = plain(
    await q<{ target: string }[]>(
      'SELECT record::id(target) AS target FROM follow WHERE user = $user',
      {
        user: userRef(user),
      },
    ),
  )
  return rows.map((r) => String(r.target))
}

export async function setFollow(user: string, target: string, on: boolean): Promise<void> {
  if (on) {
    await q('INSERT IGNORE INTO follow { user: $user, target: $target }', {
      user: userRef(user),
      target: userRef(target),
    })
  } else {
    await q('DELETE follow WHERE user = $user AND target = $target', {
      user: userRef(user),
      target: userRef(target),
    })
  }
}

export type ReactionKind = 'gg' | 'fire' | 'skull'

export async function setReaction(
  user: string,
  event: string,
  kind: ReactionKind,
  on: boolean,
): Promise<void> {
  if (on) {
    await q('INSERT IGNORE INTO reaction { user: $user, event: $event, kind: $kind }', {
      user: userRef(user),
      event,
      kind,
    })
  } else {
    await q('DELETE reaction WHERE user = $user AND event = $event AND kind = $kind', {
      user: userRef(user),
      event,
      kind,
    })
  }
}

/** How many of each reaction each event has, and which ones this player gave. */
export async function reactionsOn(
  events: string[],
  user: string,
): Promise<Map<string, { counts: Record<ReactionKind, number>; mine: ReactionKind[] }>> {
  const out = new Map<string, { counts: Record<ReactionKind, number>; mine: ReactionKind[] }>()
  if (!events.length) return out
  const rows = plain(
    await q<{ event: string; kind: ReactionKind; user: string }[]>(
      'SELECT event, kind, record::id(user) AS user FROM reaction WHERE event IN $events',
      { events },
    ),
  )
  for (const r of rows) {
    const e = out.get(r.event) ?? { counts: { gg: 0, fire: 0, skull: 0 }, mine: [] }
    e.counts[r.kind]++
    if (String(r.user) === user.replace(/^user:/, '')) e.mine.push(r.kind)
    out.set(r.event, e)
  }
  return out
}

export interface InterestCount {
  game: string
  name: string
  coverUrl: string | null
  players: number
}

export async function mostWanted(users: string[], year: number): Promise<InterestCount[]> {
  const rows = plain(
    await q<{ game: string; name: string; cover: string | null; players: number }[]>(
      'SELECT record::id(game) AS game, game.name AS name, game.cover_url AS cover, count() AS players FROM interest WHERE user IN $users AND year = $year GROUP BY game, name, cover',
      { users: ids(users), year },
    ),
  )
  return rows
    .map((r) => ({
      game: String(r.game),
      name: r.name,
      coverUrl: r.cover ?? null,
      players: r.players,
    }))
    .sort((a, b) => b.players - a.players || a.name.localeCompare(b.name))
}
