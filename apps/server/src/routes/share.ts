/** Sharing a platinum: the facts its card shows, and the card's images through the app's own
 * address, so the browser can draw them on a canvas and save the result. */

import type { IncomingMessage } from 'node:http'
import { config } from '../config.ts'
import { trophiesFor } from '../demo.ts'
import { json, SECURITY_HEADERS } from '../http.ts'
import { ownCopy } from '../mcp-tools/shared.ts'
import { origin } from '../oauth.ts'
import { hours, playtimes } from '../playtime.ts'
import { secureUrl } from '../psn.ts'
import { listPlatinums } from '../repository/platinum.ts'
import { collectionCard, isPeriod, platinumCard, shareableImage } from '../share.ts'
import type { ApiHandler } from './api.ts'

const MAX_IMAGE = 8 * 1024 * 1024

// The app's address for the card's link: APP_URL, or the one the request came in on.
const base = (req: IncomingMessage) => config.appUrl ?? origin(req)

const card: ApiHandler = async ({ req, res, url, me, titles }) => {
  const gameId = url.searchParams.get('game') ?? ''
  if (!/^game:\w+$/.test(gameId)) return json(res, 400, { error: 'invalid' })
  const [rows, library, played] = await Promise.all([listPlatinums(me.id), titles(), playtimes(me)])
  const row = rows.find((r) => r.game.id === gameId)
  const title = row && ownCopy(library, row.game)
  if (!row || !title) return json(res, 404, { error: 'not_found' })
  const result = platinumCard({
    gameId,
    platinums: rows.map((r) => ({
      game: r.game,
      earnedAt: r.earned_at,
      rarity: r.rarity_rate,
      hours: hours(played.get(r.game.id)),
    })),
    title,
    trophies: await trophiesFor(title, me),
    player: { onlineId: me.psn_online_id ?? '', avatarUrl: secureUrl(me.avatar_url) },
    base: base(req),
  })
  return result ? json(res, 200, result) : json(res, 404, { error: 'not_found' })
}

// ?period=month|year|all: the player's platinums of this month, this year or all of them.
const collection: ApiHandler = async ({ req, res, url, me, titles }) => {
  const period = url.searchParams.get('period')
  if (!isPeriod(period)) return json(res, 400, { error: 'invalid' })
  const [rows, library, played] = await Promise.all([listPlatinums(me.id), titles(), playtimes(me)])
  const platformOf = new Map(library.map((t) => [t.npCommunicationId, t.platform]))
  return json(
    res,
    200,
    collectionCard({
      period,
      now: new Date(),
      platinums: rows.map((r) => ({
        game: r.game,
        platform: platformOf.get(r.np_communication_id) ?? '',
        earnedAt: r.earned_at,
        rarity: r.rarity_rate,
        hours: hours(played.get(r.game.id)),
      })),
      player: { onlineId: me.psn_online_id ?? '', avatarUrl: secureUrl(me.avatar_url) },
      base: base(req),
    }),
  )
}

// ?u=<image url>: the bytes of one of the hosts the app's art comes from.
const image: ApiHandler = async ({ res, url }) => {
  const target = shareableImage(url.searchParams.get('u'))
  if (!target) return json(res, 400, { error: 'invalid' })
  const answer = await fetch(target, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  const type = answer?.headers.get('content-type') ?? ''
  if (!answer?.ok || !type.startsWith('image/')) return json(res, 502, { error: 'unavailable' })
  const body = Buffer.from(await answer.arrayBuffer())
  if (body.length > MAX_IMAGE) return json(res, 502, { error: 'unavailable' })
  res
    .writeHead(200, {
      'content-type': type,
      'cache-control': 'private, max-age=86400',
      ...SECURITY_HEADERS,
    })
    .end(body)
}

export const SHARE_ROUTES: Record<string, ApiHandler> = {
  'GET /api/share/platinum': card,
  'GET /api/share/platinums': collection,
  'GET /api/share/image': image,
}
