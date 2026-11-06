import { plain, q } from '../db.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

// A request is a player who opened the game while it had no guide: opening it again, or
// reloading the page, is the same request.
export async function requestGuide(game: string, user: string): Promise<void> {
  await q(
    `IF (SELECT id FROM guide_request WHERE game = $game) {
       UPDATE guide_request SET users = array::union(users, [$user]), requests = array::len(array::union(users, [$user])) WHERE game = $game
     } ELSE {
       CREATE guide_request SET game = $game, users = [$user], requests = 1
     }`,
    { game: gameRef(game), user: userRef(user) },
  )
}

/** A question Nexo could not answer, still waiting for the deep guide to have it. */
export interface WaitingQuestion {
  game: string
  user: string
  question: string
  asked_at: string
  /** When it was last asked again without an answer, so the same passages are not asked twice. */
  checked_at?: string | null
}

// Followed up for this long after it was asked; after that the player has moved on.
const WAIT_DAYS = 30

/**
 * The questions Nexo told a player it would look into (`answered: false`, with who asked) and has
 * not answered since, whose game's deep guide was indexed again after it was asked, or after it was last
 * asked again. Older questions, from before this was recorded, carry neither field and stay out.
 */
export async function waitingQuestions(): Promise<WaitingQuestion[]> {
  const rows = plain(
    await q<{ game: string; newest: string | null; questions: WaitingQuestion[] }[]>(
      `SELECT game,
         (SELECT VALUE indexed_at FROM guide WHERE game = $parent.game LIMIT 1)[0] AS newest,
         questions[WHERE answered = false AND notified_at = NONE AND user != NONE
           AND asked_at > time::now() - ${WAIT_DAYS}d] AS questions
       FROM guide_request WHERE questions != NONE`,
    ),
  )
  return rows.flatMap((r) =>
    (r.questions ?? [])
      .filter((x) => r.newest && Date.parse(r.newest) > Date.parse(x.checked_at ?? x.asked_at))
      .map((x) => ({ ...x, game: String(r.game), user: String(x.user) })),
  )
}

/** Marks a waiting question: `notified_at` once the player got the answer, else `checked_at`. */
export async function markQuestion(
  w: WaitingQuestion,
  field: 'notified_at' | 'checked_at',
): Promise<void> {
  await q(
    `UPDATE guide_request SET questions = questions.map(|$x|
       IF $x.asked_at = <datetime> $at AND $x.question = $question AND $x.user = $user
       THEN $x + { ${field}: time::now() } ELSE $x END)
     WHERE game = $game`,
    { game: gameRef(w.game), at: w.asked_at, question: w.question, user: userRef(w.user) },
  )
}
