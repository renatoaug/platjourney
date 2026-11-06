import { plain, q } from '../db.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

// A request is a player who opened the game while it had no guide: opening it again, or
// reloading the page, is the same request.
export async function requestGuide(game: string, user: string): Promise<void> {
  await q(
    `IF (SELECT id FROM guide_request WHERE game = $game) {
       UPDATE guide_request SET users = array::union(users ?? [], [$user]), requests = array::len(array::union(users ?? [], [$user])) WHERE game = $game
     } ELSE {
       CREATE guide_request SET game = $game, users = [$user], requests = 1
     }`,
    { game: gameRef(game), user: userRef(user) },
  )
}

/** A question Nexo could not answer and told the player it would look into. */
export interface WaitingQuestion {
  game: string
  /** The game's name, for whoever answers it. */
  name?: string
  user: string
  question: string
  asked_at: string
}

/**
 * The questions Nexo told a player it would look into (`answered: false`, with who asked) and has
 * not answered since, oldest first. Older questions, from before this was recorded, carry neither
 * field and stay out.
 */
export async function waitingQuestions(): Promise<WaitingQuestion[]> {
  const rows = plain(
    await q<{ game: string; name: string | null; questions: WaitingQuestion[] }[]>(
      `SELECT game, game.name AS name,
         questions[WHERE answered = false AND notified_at = NONE AND user != NONE] AS questions
       FROM guide_request WHERE questions != NONE`,
    ),
  )
  return rows
    .flatMap((r) =>
      (r.questions ?? []).map((x) => ({
        ...x,
        game: String(r.game),
        name: r.name ?? undefined,
        user: String(x.user),
      })),
    )
    .sort((a, b) => Date.parse(a.asked_at) - Date.parse(b.asked_at))
}

/** Marks a waiting question once the player got its answer. */
export async function markAnswered(w: WaitingQuestion): Promise<void> {
  await q(
    `UPDATE guide_request SET users = users ?? [], questions = questions.map(|$x|
       IF $x.asked_at = <datetime> $at AND $x.question = $question AND $x.user = $user
       THEN $x + { notified_at: time::now() } ELSE $x END)
     WHERE game = $game`,
    { game: gameRef(w.game), at: w.asked_at, question: w.question, user: userRef(w.user) },
  )
}
