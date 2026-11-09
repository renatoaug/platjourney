import type { Unlock } from '../../../../shared/journey/places.ts'
import { plain, q } from '../db.ts'
import { userRef } from './user.ts'

/** Keeps the unlock times of a player's earned trophies on one PSN list; known ones stay as they are. */
export async function saveUnlocks(
  user: string,
  np: string,
  earned: { id: number; earnedAt: string }[],
): Promise<void> {
  if (!earned.length) return
  await q('INSERT IGNORE INTO unlock $rows', {
    rows: earned.map((e) => ({
      user: userRef(user),
      np_communication_id: np,
      trophy_id: e.id,
      earned_at: new Date(e.earnedAt),
    })),
  })
}

/** Every player's unlocks on one PSN list, oldest first, for working out where trophies close. */
export async function unlocksOn(np: string): Promise<Unlock[]> {
  const rows = plain(
    await q<{ user: string; trophy_id: number; earned_at: string }[]>(
      'SELECT record::id(user) AS user, trophy_id, earned_at FROM unlock WHERE np_communication_id = $np',
      { np },
    ),
  )
  return rows.map((r) => ({
    user: r.user,
    trophyId: r.trophy_id,
    at: new Date(r.earned_at).toISOString(),
  }))
}
