import { plain, q } from '../db.ts'
import type { Game } from './game.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

/** How long an assistant's suggestion stays on Discover. */
export const PICK_DAYS = 30

export interface AssistantPick {
  id: string
  game: Game
  reason: string
  assistant: string
  updated_at: string
}

/** Saves an assistant's suggestion; the same game again takes the new reason and date. */
export async function savePick(
  user: string,
  game: string,
  reason: string,
  assistant: string,
): Promise<void> {
  await q(
    'UPSERT assistant_pick SET user = $user, game = $game, reason = $reason, assistant = $assistant WHERE user = $user AND game = $game',
    { user: userRef(user), game: gameRef(game), reason, assistant },
  )
}

/** The suggestions still worth showing: newer than PICK_DAYS, not saved to this year's interests
 * and not dismissed. Newest first. */
export async function picksOf(user: string, year: number): Promise<AssistantPick[]> {
  return plain(
    await q<AssistantPick[]>(
      `LET $saved = SELECT VALUE game FROM interest WHERE user = $user AND year = $year;
       LET $dismissed = SELECT VALUE game FROM dismissal WHERE user = $user;
       SELECT id, game.* AS game, reason, assistant, updated_at FROM assistant_pick
       WHERE user = $user AND updated_at > time::now() - ${PICK_DAYS}d
         AND game NOTINSIDE $saved AND game NOTINSIDE $dismissed
       ORDER BY updated_at DESC;`,
      { user: userRef(user), year },
    ),
  )
}

/** Takes one suggestion off Discover; false when the player had none for that game. */
export async function dropPick(user: string, game: string): Promise<boolean> {
  const rows = await q<unknown[]>(
    'DELETE assistant_pick WHERE user = $user AND game = $game RETURN BEFORE',
    { user: userRef(user), game: gameRef(game) },
  )
  return (rows ?? []).length > 0
}

/** Deletes the suggestions older than PICK_DAYS. */
export async function prunePicks(): Promise<void> {
  await q(`DELETE assistant_pick WHERE updated_at < time::now() - ${PICK_DAYS}d`)
}
