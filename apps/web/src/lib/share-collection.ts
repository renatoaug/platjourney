/** The share card of a collection: the platinums of a month, a year or all of them, as a grid of
 * covers in the platinum card's game-HUD frame, the rarest one marked. It grows taller with the
 * number of platinums; past MAX_COLLECTION the server stops listing and the last tile counts the
 * rest. */
import { defineMessages, getLocale, Language, translator } from '../i18n/i18n'
import { api } from './api'
import {
  brandFooter,
  chamfer,
  cover,
  EDGE,
  INK,
  LIME,
  LIME_DARK,
  label,
  loadFonts,
  loadImage,
  PANEL,
  playerPill,
  proxied,
  SCALE,
  skewed,
  TEXT,
} from './share-card'

export type Period = 'month' | 'year' | 'all'

export interface CollectionCard {
  player: { onlineId: string; avatarUrl: string | null }
  /** Where the shared card's link opens: the player's public profile on this app. */
  link: string
  period: Period
  month: number | null
  year: number | null
  total: number
  overall: number
  hours: number | null
  platinums: {
    game: { id: string; name: string; coverUrl: string | null }
    platform: string
    earnedAt: string
    rarity: number
  }[]
}

export const fetchCollectionCard = (period: Period) =>
  api<CollectionCard>(`/api/share/platinums?period=${period}`)

const messages = defineMessages({
  [Language.PtBR]: {
    kicker: {
      month: 'PLATINAS DE {when}',
      year: 'PLATINAS DE {when}',
      all: 'TODAS AS MINHAS PLATINAS',
    },
    count: { one: '{count} PLATINA', other: '{count} PLATINAS' },
    hours: 'JOGADAS',
    rarest: 'A MAIS RARA',
    overall: 'NO TOTAL',
    rarestTag: 'MAIS RARA',
    cta: 'MONTE A SUA EM',
  },
  [Language.En]: {
    kicker: {
      month: '{when} PLATINUMS',
      year: '{when} PLATINUMS',
      all: 'ALL MY PLATINUMS',
    },
    count: { one: '{count} PLATINUM', other: '{count} PLATINUMS' },
    hours: 'PLAYED',
    rarest: 'THE RAREST',
    overall: 'IN TOTAL',
    rarestTag: 'RAREST',
    cta: 'BUILD YOURS AT',
  },
})

const WIDTH = 1200
const PAD = 30
const GAP = 12
const HEAD = 250
const FOOT = 90

/** How many covers fit across, for this many platinums: few get big tiles, many get small ones. */
export function columnsFor(count: number): number {
  if (count <= 3) return 3
  if (count <= 8) return 4
  if (count <= 18) return 6
  if (count <= 40) return 8
  return 10
}

const percent = (rate: number) =>
  `${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(rate)}%`

function when(card: CollectionCard): string {
  if (card.period === 'year') return String(card.year)
  if (card.period === 'month' && card.month && card.year)
    return new Intl.DateTimeFormat(getLocale(), { month: 'long' })
      .format(new Date(Date.UTC(card.year, card.month - 1, 15)))
      .toUpperCase()
  return ''
}

// A big tile asks IGDB for a bigger cover, so it stays sharp at twice the card's size.
const sharp = (url: string, width: number) =>
  width > 180 ? url.replace('/t_cover_big/', '/t_720p/') : url

/** Draws the collection and returns it as a PNG. */
export async function drawCollectionCard(card: CollectionCard): Promise<Blob> {
  const t = translator(messages)
  const list = card.platinums
  const cols = columnsFor(list.length)
  const cellW = (WIDTH - PAD * 2 - GAP * (cols - 1)) / cols
  const cellH = cellW * (4 / 3)
  const rows = Math.max(1, Math.ceil(list.length / cols))
  const height = Math.round(HEAD + rows * cellH + (rows - 1) * GAP + FOOT)
  const [, avatar, logo, crown, ...covers] = await Promise.all([
    loadFonts(),
    loadImage(card.player.avatarUrl ? proxied(card.player.avatarUrl) : null),
    loadImage('/logo.png'),
    loadImage('/trophies/platinum.webp'),
    ...list.map((p) => loadImage(p.game.coverUrl ? proxied(sharp(p.game.coverUrl, cellW)) : null)),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.scale(SCALE, SCALE)

  // The latest platinum's cover, blurred, behind everything.
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, WIDTH, height)
  const backdrop = covers.find(Boolean)
  if (backdrop) {
    const filters = typeof (ctx as { filter?: unknown }).filter === 'string'
    ctx.save()
    ctx.filter = 'blur(40px) saturate(0.9) brightness(0.32)'
    cover(ctx, backdrop, -60, -60, WIDTH + 120, height + 120, 0.5, 0.5)
    ctx.restore()
    if (!filters) {
      ctx.fillStyle = 'rgba(16, 18, 15, 0.82)'
      ctx.fillRect(0, 0, WIDTH, height)
    }
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
  for (let y = 0; y < height; y += 3) ctx.fillRect(0, y, WIDTH, 1)

  drawHead(ctx, card, t, avatar, crown)
  drawGrid(ctx, card, t, covers, { cols, cellW, cellH })
  brandFooter(ctx, logo, t('cta'), card.link, WIDTH, height - 62)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'),
  )
}

type Text = ReturnType<typeof translator<typeof messages>>

function drawHead(
  ctx: CanvasRenderingContext2D,
  card: CollectionCard,
  t: Text,
  avatar: HTMLImageElement | null,
  crown: HTMLImageElement | null,
) {
  playerPill(ctx, card.player.onlineId, avatar)
  if (crown) {
    ctx.save()
    ctx.shadowColor = 'rgba(143, 211, 255, 0.6)'
    ctx.shadowBlur = 22
    ctx.drawImage(crown, WIDTH - PAD - 96, 18, 96, 96)
    ctx.restore()
  }
  // The period, on a lime tab, and how many platinums it has.
  ctx.font = '700 15px "Chakra Petch"'
  ctx.letterSpacing = '4px'
  const kicker = t(`kicker.${card.period}`, { when: when(card) })
  const kW = ctx.measureText(kicker).width + 26
  skewed(ctx, PAD + 4, 112, kW, 28, 6)
  ctx.fillStyle = LIME
  ctx.fill()
  ctx.fillStyle = INK
  ctx.fillText(kicker, PAD + 16, 132)
  ctx.letterSpacing = '0px'
  ctx.font = 'italic 900 76px "Saira Condensed"'
  ctx.fillStyle = TEXT
  ctx.shadowColor = 'rgba(198, 243, 107, 0.45)'
  ctx.shadowBlur = 20
  ctx.fillText(t('count', { count: card.total }), PAD - 2, 214)
  ctx.shadowBlur = 0

  // Two numbers at the right: the hours and the rarest, or the whole collection's count.
  const rarest = card.platinums.reduce<number | null>(
    (best, p) => (best === null || p.rarity < best ? p.rarity : best),
    null,
  )
  // The number, a unit after it in lime (as the platinum card writes its hours) and the name.
  const stats: [string, string, string][] = []
  if (card.hours !== null) stats.push([card.hours.toLocaleString(getLocale()), ' H', t('hours')])
  if (rarest !== null) stats.push([percent(rarest), '', t('rarest')])
  if (card.period !== 'all') stats.push([String(card.overall), '', t('overall')])
  let x = WIDTH - PAD
  for (const [value, unit, name] of stats.slice(0, 2).reverse()) {
    ctx.font = '700 13px "Chakra Petch"'
    ctx.letterSpacing = '3px'
    const nameWidth = ctx.measureText(name).width
    ctx.letterSpacing = '0px'
    ctx.font = 'italic 900 40px "Saira Condensed"'
    const valueWidth = ctx.measureText(value).width + (unit ? 40 : 0)
    const w = Math.max(nameWidth, valueWidth, 90) + 32
    x -= w
    chamfer(ctx, x, 150, w, 78)
    ctx.fillStyle = PANEL
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.font = 'italic 900 40px "Saira Condensed"'
    ctx.fillStyle = TEXT
    ctx.fillText(value, x + 16, 194)
    if (unit) {
      const vw = ctx.measureText(value).width
      ctx.font = 'italic 900 24px "Saira Condensed"'
      ctx.fillStyle = LIME
      ctx.fillText(unit, x + 16 + vw + 2, 194)
    }
    label(ctx, name, x + 16, 216)
    x -= 10
  }
}

interface Tile {
  x: number
  y: number
  w: number
  h: number
  small: boolean
}

function tileImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  c: Tile,
) {
  if (img) {
    cover(ctx, img, c.x, c.y, c.w, c.h, 0.5, 0.3)
    return
  }
  ctx.fillStyle = PANEL
  ctx.fillRect(c.x, c.y, c.w, c.h)
  ctx.font = `800 ${c.small ? 13 : 18}px "Saira Condensed"`
  ctx.fillStyle = TEXT
  ctx.fillText(name.toUpperCase().slice(0, 18), c.x + 8, c.y + c.h / 2)
}

// The last tile, when the list was cut, says how many more there are.
function tileMore(ctx: CanvasRenderingContext2D, more: number, c: Tile) {
  ctx.fillStyle = 'rgba(16, 18, 15, 0.78)'
  ctx.fillRect(c.x, c.y, c.w, c.h)
  ctx.font = `italic 900 ${c.small ? 30 : 44}px "Saira Condensed"`
  ctx.fillStyle = LIME
  ctx.textAlign = 'center'
  ctx.fillText(`+${more}`, c.x + c.w / 2, c.y + c.h / 2 + 12)
  ctx.textAlign = 'left'
}

// The rarity in a corner tab, lime on the rarest.
function tileRate(ctx: CanvasRenderingContext2D, rarity: number, rarest: boolean, c: Tile) {
  const rate = percent(rarity)
  ctx.font = `700 ${c.small ? 11 : 13}px "Chakra Petch"`
  const rw = ctx.measureText(rate).width + 12
  const rh = c.small ? 18 : 22
  ctx.fillStyle = 'rgba(16, 18, 15, 0.82)'
  ctx.fillRect(c.x, c.y + c.h - rh, rw, rh)
  ctx.fillStyle = rarest ? LIME : TEXT
  ctx.fillText(rate, c.x + 6, c.y + c.h - (c.small ? 5 : 6))
}

function rarestTag(ctx: CanvasRenderingContext2D, tag: string, c: Tile) {
  ctx.font = `italic 800 ${c.small ? 12 : 16}px "Saira Condensed"`
  ctx.letterSpacing = '1px'
  const tw = ctx.measureText(tag).width + 16
  skewed(ctx, c.x + c.w - tw - 6, c.y + 6, tw, c.small ? 18 : 24, 5)
  const g = ctx.createLinearGradient(c.x + c.w - tw, 0, c.x + c.w, 0)
  g.addColorStop(0, '#d2ff86')
  g.addColorStop(1, LIME_DARK)
  ctx.fillStyle = g
  ctx.fill()
  ctx.fillStyle = INK
  ctx.fillText(tag, c.x + c.w - tw + 2, c.y + (c.small ? 20 : 24))
  ctx.letterSpacing = '0px'
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  card: CollectionCard,
  t: Text,
  covers: (HTMLImageElement | null)[],
  { cols, cellW, cellH }: { cols: number; cellW: number; cellH: number },
) {
  const list = card.platinums
  const rarest = list.reduce((best, p, i) => ((list[best]?.rarity ?? 101) > p.rarity ? i : best), 0)
  const more = card.total - list.length
  // A single short row sits in the middle.
  const shift = list.length < cols ? ((cols - list.length) * (cellW + GAP)) / 2 : 0
  list.forEach((p, i) => {
    const c: Tile = {
      x: PAD + shift + (i % cols) * (cellW + GAP),
      y: HEAD + Math.floor(i / cols) * (cellH + GAP),
      w: cellW,
      h: cellH,
      small: cellW < 130,
    }
    const cut = c.small ? 8 : 12
    const last = more > 0 && i === list.length - 1
    ctx.save()
    chamfer(ctx, c.x, c.y, c.w, c.h, cut)
    ctx.clip()
    tileImage(ctx, covers[i] ?? null, p.game.name, c)
    if (last) tileMore(ctx, more + 1, c)
    else tileRate(ctx, p.rarity, i === rarest, c)
    ctx.restore()
    chamfer(ctx, c.x, c.y, c.w, c.h, cut)
    ctx.lineWidth = i === rarest ? 3 : 1.5
    ctx.strokeStyle = i === rarest ? LIME : EDGE
    ctx.stroke()
    if (i === rarest && !last) rarestTag(ctx, t('rarestTag'), c)
  })
}
