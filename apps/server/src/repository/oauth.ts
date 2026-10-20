import { one, plain, q } from '../db.ts'
import { userRef } from './user.ts'

export interface OauthClient {
  id: string
  client_id: string
  name: string
  redirect_uris: string[]
}

export interface Connection {
  id: string
  name: string
  created_at: string
  used_at: string | null
}

export async function createClient(c: {
  client_id: string
  name: string
  redirect_uris: string[]
}): Promise<void> {
  await q('CREATE oauth_client CONTENT $c RETURN NONE', { c })
}

export async function getClient(clientId: string): Promise<OauthClient | undefined> {
  return plain(
    await one<OauthClient>('SELECT * FROM oauth_client WHERE client_id = $id LIMIT 1', {
      id: clientId,
    }),
  )
}

export async function saveCode(c: {
  code_hash: string
  client: string
  user: string
  redirect_uri: string
  challenge: string
  minutes: number
}): Promise<void> {
  await q(
    `CREATE oauth_code SET code_hash = $hash, client = type::record($client), user = $user,
       redirect_uri = $redirect, challenge = $challenge, expires_at = time::now() + <duration> $ttl`,
    {
      hash: c.code_hash,
      client: c.client,
      user: userRef(c.user),
      redirect: c.redirect_uri,
      challenge: c.challenge,
      ttl: `${c.minutes}m`,
    },
  )
}

/** The code, once: it is deleted as it is read, so a second exchange finds nothing. */
export async function takeCode(
  codeHash: string,
): Promise<{ client: string; user: string; redirect_uri: string; challenge: string } | undefined> {
  const rows = plain(
    await q<
      {
        client: string
        user: string
        redirect_uri: string
        challenge: string
        expires_at: string
      }[]
    >('DELETE oauth_code WHERE code_hash = $hash RETURN BEFORE', { hash: codeHash }),
  )
  const row = rows?.[0]
  return row && new Date(row.expires_at).getTime() > Date.now() ? row : undefined
}

interface Hashes {
  access_hash: string
  refresh_hash: string
  access_minutes: number
  refresh_days: number
}

export async function createToken(client: string, user: string, h: Hashes): Promise<void> {
  await q(
    `CREATE oauth_token SET client = type::record($client), user = $user, access_hash = $access_hash,
       access_expires_at = time::now() + <duration> $attl, refresh_hash = $refresh_hash,
       refresh_expires_at = time::now() + <duration> $rttl`,
    {
      client,
      user: userRef(user),
      access_hash: h.access_hash,
      refresh_hash: h.refresh_hash,
      attl: `${h.access_minutes}m`,
      rttl: `${h.refresh_days}d`,
    },
  )
}

/** Swaps a live refresh token for new tokens; false when it is unknown, expired or not this client's. */
export async function rotateToken(
  refreshHash: string,
  client: string,
  h: Hashes,
): Promise<boolean> {
  const rows = await q<unknown[]>(
    `UPDATE oauth_token SET access_hash = $access_hash, access_expires_at = time::now() + <duration> $attl,
       refresh_hash = $refresh_hash, refresh_expires_at = time::now() + <duration> $rttl
     WHERE refresh_hash = $old AND client = type::record($client) AND refresh_expires_at > time::now()`,
    {
      old: refreshHash,
      client,
      access_hash: h.access_hash,
      refresh_hash: h.refresh_hash,
      attl: `${h.access_minutes}m`,
      rttl: `${h.refresh_days}d`,
    },
  )
  return Array.isArray(rows) && rows.length > 0
}

/** Ends the connection one of its tokens (access or refresh) belongs to; true when there was one. */
export async function revokeToken(tokenHash: string): Promise<boolean> {
  const rows = await q<unknown[]>(
    'DELETE oauth_token WHERE access_hash = $hash OR refresh_hash = $hash RETURN BEFORE',
    { hash: tokenHash },
  )
  return Array.isArray(rows) && rows.length > 0
}

/** Ends the player's earlier connections of the same assistant (same name), so connecting it again
 * replaces the old one instead of listing it twice. */
export async function replaceConnections(user: string, name: string): Promise<void> {
  await q('DELETE oauth_token WHERE user = $user AND client.name = $name', {
    user: userRef(user),
    name,
  })
}

/** The connection a live access token belongs to, marked as used now. */
export async function tokenOwner(
  accessHash: string,
): Promise<{ id: string; user: string; client: string } | undefined> {
  return plain(
    await one<{ id: string; user: string; client: string }>(
      `UPDATE oauth_token SET used_at = time::now()
       WHERE access_hash = $hash AND access_expires_at > time::now()
       RETURN id, user, client.name AS client`,
      { hash: accessHash },
    ),
  )
}

export async function connectionsOf(user: string): Promise<Connection[]> {
  return plain(
    await q<Connection[]>(
      `SELECT id, client.name AS name, created_at, used_at ?? NONE AS used_at FROM oauth_token
       WHERE user = $user ORDER BY created_at DESC`,
      { user: userRef(user) },
    ),
  ).map((c) => ({ ...c, used_at: c.used_at ?? null }))
}

/** Ends one connection; false when it is not the player's. */
export async function deleteConnection(user: string, id: string): Promise<boolean> {
  const rows = await q<unknown[]>(
    'DELETE oauth_token WHERE id = type::record($id) AND user = $user RETURN BEFORE',
    { id, user: userRef(user) },
  )
  return Array.isArray(rows) && rows.length > 0
}

export async function deleteConnectionsOf(user: string): Promise<void> {
  await q('DELETE oauth_token WHERE user = $user; DELETE oauth_code WHERE user = $user;', {
    user: userRef(user),
  })
}

/** Codes and connections past their expiry: nothing reads them, so they go. */
export async function pruneOauth(): Promise<void> {
  await q(
    'DELETE oauth_code WHERE expires_at < time::now(); DELETE oauth_token WHERE refresh_expires_at < time::now();',
  )
}
