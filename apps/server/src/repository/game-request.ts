import { q } from '../db.ts'
import { normalizeName } from '../igdb.ts'
import { userRef } from './user.ts'

/** A game a player looked for that neither the catalog nor IGDB had. Each account counts once;
 * true when this account had already asked for the name, so nothing changed. */
export async function requestMissingGame(name: string, user: string): Promise<boolean> {
  const key = normalizeName(name)
  if (!key) return false
  return Boolean(
    await q<boolean>(
      `LET $row = (SELECT users FROM game_request WHERE key = $key)[0];
       IF $row AND $user IN $row.users { RETURN true }
       ELSE IF $row {
         UPDATE game_request SET users += $user, requests = array::len($row.users) + 1
           WHERE key = $key RETURN NONE;
         RETURN false
       } ELSE {
         CREATE game_request SET key = $key, name = $name, users = [$user], requests = 1
           RETURN NONE;
         RETURN false
       }`,
      { key, name, user: userRef(user) },
    ),
  )
}
