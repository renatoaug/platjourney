import { camelKeys, one, plain, q, rid, snakeKeys } from '../db.ts'
import type { TitleGroups, TitleProgress, TrophyStatus } from '../psn.ts'
import { gameForTitle, gameRef } from './game.ts'
import { userRef } from './user.ts'

export interface TitleRow {
  id: string
  user: string
  game: string
  np_communication_id: string
  name: string
  platform: string
  icon_url: string
  progress: number
  earned: number
  total: number
  earned_ids: number[]
  groups: TitleGroups | null
  // The full list with this player's unlocks; stored only for the demo player, who has no PSN account.
  trophies?: TrophyStatus[] | null
  last_updated_at: string
  last_tip_at: string | null
}

// The trophy split and the stored list are objects with snake_case keys (AGENTS.md, Database).
function fromRow<T extends TitleRow | undefined>(row: T): T {
  if (!row) return row
  return { ...row, groups: camelKeys(row.groups), trophies: camelKeys(row.trophies) }
}

export async function getTitle(user: string, np: string): Promise<TitleRow | undefined> {
  return fromRow(
    plain(
      await one<TitleRow>(
        'SELECT * FROM title WHERE user = $user AND np_communication_id = $np LIMIT 1',
        { user: userRef(user), np },
      ),
    ),
  )
}

// Every title of an account, most recently played first (the demo player's library).
export async function titlesOfAccount(accountId: string): Promise<TitleRow[]> {
  return plain(
    await q<TitleRow[]>(
      'SELECT * FROM title WHERE user.psn_account_id = $account ORDER BY last_updated_at DESC',
      { account: accountId },
    ),
  ).map(fromRow)
}

// Base/DLC split of a trophy list is the same for everyone: reuse it from any user's row.
export async function sharedGroups(np: string, total: number): Promise<TitleGroups | undefined> {
  const row = plain(
    await one<{ groups: TitleGroups | null }>(
      'SELECT groups FROM title WHERE np_communication_id = $np AND total = $total AND groups != NONE LIMIT 1',
      { np, total },
    ),
  )
  return row?.groups ? camelKeys(row.groups) : undefined
}

// Records the latest PSN summary for a title, linking it to its catalog game.
export async function upsertTitle(user: string, t: TitleProgress): Promise<TitleRow> {
  const game = await gameForTitle(t)
  const existing = await getTitle(user, t.npCommunicationId)
  const data = {
    user: userRef(user),
    game: gameRef(game.id),
    np_communication_id: t.npCommunicationId,
    name: t.name,
    platform: t.platform,
    icon_url: t.iconUrl,
    progress: t.progress,
    earned: t.earned,
    total: t.total,
    last_updated_at: new Date(t.lastUpdated),
  }
  const row = existing
    ? await one<TitleRow>('UPDATE $id MERGE $data RETURN AFTER', {
        id: rid('title', existing.id.split(':')[1]),
        data,
      })
    : await one<TitleRow>('CREATE title CONTENT $data RETURN AFTER', { data })
  return fromRow(plain(row as TitleRow))
}

export async function saveEarnedIds(user: string, np: string, ids: number[]): Promise<void> {
  await q('UPDATE title SET earned_ids = $ids WHERE user = $user AND np_communication_id = $np', {
    user: userRef(user),
    np,
    ids,
  })
}

export async function markTipSent(user: string, np: string): Promise<void> {
  await q(
    'UPDATE title SET last_tip_at = time::now() WHERE user = $user AND np_communication_id = $np',
    { user: userRef(user), np },
  )
}

export async function saveGroups(user: string, np: string, groups: TitleGroups): Promise<void> {
  await q('UPDATE title SET groups = $groups WHERE user = $user AND np_communication_id = $np', {
    user: userRef(user),
    np,
    groups: snakeKeys(groups),
  })
}
