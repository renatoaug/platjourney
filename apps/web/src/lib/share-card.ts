/** A platinum's share card, drawn on a canvas: the game's art over a game-HUD frame, the player,
 * which platinum it was, the platinum trophy, the day-by-day climb to it and its numbers, in
 * PlatJourney's lime. The result is a PNG the player posts wherever they like. Images come
 * through /api/share/image, on the app's own address, so the canvas can be saved. */
import { defineMessages, getLocale, Language, translator } from '../i18n/i18n'
import { api } from './api'

export interface PlatinumCard {
  game: { id: string; name: string; artUrl: string | null; coverUrl: string | null }
  player: { onlineId: string; avatarUrl: string | null }
  platform: string
  earnedAt: string
  number: number
  trophy: { name: string; detail: string }
  firstAt: string | null
  hours: number | null
  trophies: { earned: number; total: number; gold: number; silver: number; bronze: number }
  rarity: number
  journey: number[]
}

export const fetchPlatinumCard = (gameId: string) =>
  api<PlatinumCard>(`/api/share/platinum?game=${encodeURIComponent(gameId)}`)

const messages = defineMessages({
  [Language.PtBR]: {
    kicker: 'PLATINA CONQUISTADA',
    journey: 'A jornada',
    days: { one: 'DIA', other: 'DIAS' },
    sameDay: 'NO MESMO DIA',
    toPlatinum: 'ATÉ A PLATINA',
    played: 'JOGADAS',
    trophies: 'TROFÉUS',
    goldSilver: 'OURO · PRATA',
    players: 'DOS JOGADORES TÊM',
    ultraRare: 'ULTRA RARA',
    veryRare: 'MUITO RARA',
    rare: 'RARA',
    common: 'COMUM',
    cta: 'ACOMPANHE A SUA EM',
  },
  [Language.En]: {
    kicker: 'PLATINUM EARNED',
    journey: 'The journey',
    days: { one: 'DAY', other: 'DAYS' },
    sameDay: 'SAME DAY',
    toPlatinum: 'TO PLATINUM',
    played: 'PLAYED',
    trophies: 'TROPHIES',
    goldSilver: 'GOLD · SILVER',
    players: 'OF PLAYERS HAVE IT',
    ultraRare: 'ULTRA RARE',
    veryRare: 'VERY RARE',
    rare: 'RARE',
    common: 'COMMON',
    cta: 'TRACK YOURS AT',
  },
})

/** Where the card sends people. */
export const SHARE_HOST = 'platjourney.app'

const WIDTH = 1200
const HEIGHT = 675
export const SCALE = 2

// The card's colors: PlatJourney's lime on its olive dark, as on the app's default look. They are
// pixels in an image, not page styles, so they live here and not in theme.css.
export const LIME = '#c6f36b'
export const LIME_DARK = '#7fa64a'
export const INK = '#10120f'
export const TEXT = '#f1f3eb'
const MUTED = '#a0a697'
export const PANEL = 'rgba(16, 18, 15, 0.72)'
export const EDGE = 'rgba(198, 243, 107, 0.38)'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Saira+Condensed:ital,wght@0,800;1,800;1,900&family=Chakra+Petch:wght@500;600;700&family=Space+Grotesk:wght@700&display=swap'
const FACES = [
  'italic 900 60px "Saira Condensed"',
  '800 30px "Saira Condensed"',
  '700 16px "Chakra Petch"',
  '500 16px "Chakra Petch"',
  '600 16px "Chakra Petch"',
  '700 26px "Space Grotesk"',
]

export async function loadFonts(): Promise<void> {
  if (!document.querySelector(`link[href="${FONTS}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONTS
    document.head.append(link)
    await new Promise((resolve) => {
      link.onload = resolve
      link.onerror = resolve
    })
  }
  await Promise.all(FACES.map((f) => document.fonts.load(f).catch(() => [])))
}

export const proxied = (url: string) => `/api/share/image?u=${encodeURIComponent(url)}`

export function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** The rarity's name, by PSN's own bands. */
export function rarityKey(rate: number): 'ultraRare' | 'veryRare' | 'rare' | 'common' {
  if (rate <= 5) return 'ultraRare'
  if (rate <= 15) return 'veryRare'
  if (rate <= 50) return 'rare'
  return 'common'
}

/** Whole days from the first trophy to the platinum; 0 when both fell on the same day. */
export function daysToPlatinum(firstAt: string | null, earnedAt: string): number | null {
  if (!firstAt) return null
  const day = (iso: string) => Math.floor(Date.parse(iso) / 86_400_000)
  return Math.max(0, day(earnedAt) - day(firstAt))
}

// A box with its top-left and bottom-right corners cut, the frame of every panel.
export function chamfer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c = 14,
) {
  ctx.beginPath()
  ctx.moveTo(x + c, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h - c)
  ctx.lineTo(x + w - c, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + c)
  ctx.closePath()
}

// A box leaning right, like a racing game's labels.
export function skewed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  k = 10,
) {
  ctx.beginPath()
  ctx.moveTo(x + k, y)
  ctx.lineTo(x + w + k, y)
  ctx.lineTo(x + w - k, y + h)
  ctx.lineTo(x - k, y + h)
  ctx.closePath()
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  chamfer(ctx, x, y, w, h)
  ctx.fillStyle = PANEL
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.5
  ctx.stroke()
}

// Draws `img` so it covers the box, cropped around (fx, fy) of the image.
export function cover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fx = 0.5,
  fy = 0.35,
) {
  const s = Math.max(w / img.width, h / img.height)
  const sw = w / s
  const sh = h / s
  ctx.drawImage(img, (img.width - sw) * fx, (img.height - sh) * fy, sw, sh, x, y, w, h)
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (px: number) => string,
  max: number,
  start: number,
  min: number,
) {
  let px = start
  ctx.font = font(px)
  while (px > min && ctx.measureText(text).width > max) {
    px -= 2
    ctx.font = font(px)
  }
  return px
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

// A big number with a small unit after it, as the stats show them.
function figure(ctx: CanvasRenderingContext2D, value: string, unit: string, x: number, y: number) {
  ctx.font = 'italic 900 42px "Saira Condensed"'
  ctx.fillStyle = TEXT
  ctx.shadowColor = 'rgba(198, 243, 107, 0.35)'
  ctx.shadowBlur = 16
  ctx.fillText(value, x, y)
  const w = ctx.measureText(value).width
  ctx.font = 'italic 900 24px "Saira Condensed"'
  ctx.fillStyle = LIME
  ctx.fillText(unit, x + w + 4, y)
  ctx.shadowBlur = 0
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = MUTED,
) {
  ctx.font = '700 13px "Chakra Petch"'
  ctx.fillStyle = color
  ctx.letterSpacing = '3px'
  ctx.fillText(text, x, y)
  ctx.letterSpacing = '0px'
}

type Text = ReturnType<typeof translator<typeof messages>>

interface Draw {
  ctx: CanvasRenderingContext2D
  card: PlatinumCard
  im: Images
  t: Text
}

interface Images {
  art: HTMLImageElement | null
  cover: HTMLImageElement | null
  avatar: HTMLImageElement | null
  platinum: HTMLImageElement | null
  gold: HTMLImageElement | null
  silver: HTMLImageElement | null
  logo: HTMLImageElement | null
}

// The two columns under the art: the trophy and journey on the left, the numbers on the right.
const LEFT_W = WIDTH - 60 - 380 - 18
const SX = WIDTH - 30 - 380
const CW = (380 - 10) / 2

function drawBackdrop({ ctx, im }: Draw) {
  // The art, blurred and dimmed, behind everything; the olive dark when there is none.
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  if (im.art) {
    const filters = typeof (ctx as { filter?: unknown }).filter === 'string'
    ctx.save()
    ctx.filter = 'blur(28px) saturate(0.9) brightness(0.38)'
    cover(ctx, im.art, -40, -40, WIDTH + 80, HEIGHT + 80, 0.5, 0.5)
    ctx.restore()
    // A browser without canvas filters draws the art sharp: a veil keeps the text readable.
    if (!filters) {
      ctx.fillStyle = 'rgba(16, 18, 15, 0.78)'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
    }
    // The art itself across the top, fading into the blur.
    const hero = document.createElement('canvas')
    hero.width = WIDTH * SCALE
    hero.height = 340 * SCALE
    const h = hero.getContext('2d') as CanvasRenderingContext2D
    h.scale(SCALE, SCALE)
    cover(h, im.art, 0, 0, WIDTH, 340)
    h.globalCompositeOperation = 'destination-in'
    const fade = h.createLinearGradient(0, 0, 0, 340)
    fade.addColorStop(0.55, '#000')
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
    h.fillStyle = fade
    h.fillRect(0, 0, WIDTH, 340)
    ctx.drawImage(hero, 0, 0, WIDTH, 340)
  }
  // Scan lines, faint.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
  for (let y = 0; y < HEIGHT; y += 3) ctx.fillRect(0, y, WIDTH, 1)
}

/** The player in a pill, top left: their PSN picture (or initial) and name. */
export function playerPill(
  ctx: CanvasRenderingContext2D,
  name: string,
  avatar: HTMLImageElement | null,
) {
  // The player, top left.
  ctx.font = '600 21px "Chakra Petch"'
  const pillW = 8 + 42 + 12 + ctx.measureText(name).width + 22
  chamfer(ctx, 30, 26, pillW, 58)
  ctx.fillStyle = PANEL
  ctx.fill()
  // The lime edge follows the cut corner, inside the box.
  ctx.save()
  ctx.clip()
  ctx.fillStyle = LIME
  ctx.fillRect(30, 26, 3, 58)
  ctx.restore()
  ctx.save()
  chamfer(ctx, 38, 34, 42, 42, 8)
  ctx.clip()
  if (avatar) cover(ctx, avatar, 38, 34, 42, 42, 0.5, 0.5)
  else {
    const g = ctx.createLinearGradient(38, 34, 80, 76)
    g.addColorStop(0, '#d2ff86')
    g.addColorStop(1, LIME_DARK)
    ctx.fillStyle = g
    ctx.fillRect(38, 34, 42, 42)
    ctx.fillStyle = INK
    ctx.font = '700 20px "Chakra Petch"'
    ctx.textAlign = 'center'
    ctx.fillText(name.slice(0, 1).toUpperCase(), 59, 62)
    ctx.textAlign = 'left'
  }
  ctx.restore()
  ctx.font = '600 21px "Chakra Petch"'
  ctx.fillStyle = TEXT
  ctx.fillText(name, 92, 62)
}

function drawPlayer({ ctx, card, im }: Draw) {
  playerPill(ctx, card.player.onlineId, im.avatar)
}

function drawNumber({ ctx, card, im }: Draw) {
  // Which platinum it is, and the platinum itself, top right.
  ctx.font = 'italic 900 60px "Saira Condensed"'
  const num = `#${card.number}`
  const numW = ctx.measureText(num).width + 80
  const numX = WIDTH - 30 - 112 - numW + 6
  skewed(ctx, numX, 30, numW, 86, 8)
  const badge = ctx.createLinearGradient(numX, 0, numX + numW, 0)
  badge.addColorStop(0, 'rgba(198, 243, 107, 0.22)')
  badge.addColorStop(1, 'rgba(16, 18, 15, 0.72)')
  ctx.fillStyle = badge
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.stroke()
  ctx.fillStyle = TEXT
  ctx.shadowColor = 'rgba(198, 243, 107, 0.55)'
  ctx.shadowBlur = 18
  ctx.fillText(num, numX + 36, 96)
  ctx.shadowBlur = 0
  if (im.platinum) {
    ctx.save()
    ctx.shadowColor = 'rgba(143, 211, 255, 0.6)'
    ctx.shadowBlur = 22
    ctx.drawImage(im.platinum, WIDTH - 30 - 112, 18, 112, 112)
    ctx.restore()
  }
}

function drawTitle({ ctx, card, t }: Draw) {
  // "Platinum earned" and the game's name, over the art.
  ctx.font = '700 15px "Chakra Petch"'
  ctx.letterSpacing = '4px'
  const kicker = t('kicker')
  const kW = ctx.measureText(kicker).width + 26
  skewed(ctx, 34, 192, kW, 28, 6)
  ctx.fillStyle = LIME
  ctx.fill()
  ctx.fillStyle = INK
  ctx.fillText(kicker, 46, 212)
  ctx.letterSpacing = '0px'
  const title = card.game.name.toUpperCase()
  const titleFont = (px: number) => `italic 900 ${px}px "Saira Condensed"`
  const px = fitText(ctx, title, titleFont, WIDTH - 60, 76, 40)
  ctx.font = titleFont(px)
  ctx.fillStyle = TEXT
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 4
  ctx.fillText(title, 28, 298)
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

function drawTrophy({ ctx, card, im }: Draw) {
  // The platinum trophy.
  panel(ctx, 30, 326, LEFT_W, 122)
  if (im.cover) {
    ctx.save()
    chamfer(ctx, 48, 350, 74, 74, 8)
    ctx.clip()
    cover(ctx, im.cover, 48, 350, 74, 74, 0.5, 0.3)
    ctx.restore()
  }
  if (im.platinum) ctx.drawImage(im.platinum, 136, 354, 66, 66)
  ctx.font = '800 34px "Saira Condensed"'
  ctx.fillStyle = TEXT
  ctx.fillText(ellipsis(ctx, card.trophy.name.toUpperCase(), LEFT_W - 230), 220, 372)
  ctx.font = '500 16px "Chakra Petch"'
  ctx.fillStyle = MUTED
  ctx.fillText(ellipsis(ctx, card.trophy.detail, LEFT_W - 230), 220, 398)
  const date = new Intl.DateTimeFormat(getLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(new Date(card.earnedAt))
    .replaceAll('/', '.')
  const chip = `${card.platform.split(',')[0]} · ${date}`
  ctx.font = '700 13px "Chakra Petch"'
  ctx.letterSpacing = '2px'
  const chipW = ctx.measureText(chip).width + 22
  ctx.fillStyle = 'rgba(198, 243, 107, 0.1)'
  ctx.fillRect(220, 410, chipW, 24)
  ctx.strokeStyle = EDGE
  ctx.strokeRect(220, 410, chipW, 24)
  ctx.fillStyle = TEXT
  ctx.fillText(chip, 231, 427)
  ctx.letterSpacing = '0px'
}

function drawJourney({ ctx, card, t }: Draw) {
  // The journey: base-game trophies earned by the end of each day.
  panel(ctx, 30, 460, LEFT_W, 120)
  const first = card.firstAt
    ? new Intl.DateTimeFormat(getLocale(), { day: '2-digit', month: '2-digit' })
        .format(new Date(card.firstAt))
        .replaceAll('/', '.')
    : ''
  const last = new Intl.DateTimeFormat(getLocale(), { day: '2-digit', month: '2-digit' })
    .format(new Date(card.earnedAt))
    .replaceAll('/', '.')
  label(ctx, t('journey').toUpperCase(), 52, 488)
  ctx.font = '700 13px "Chakra Petch"'
  ctx.letterSpacing = '3px'
  const jW = ctx.measureText(`${t('journey').toUpperCase()} · `).width
  ctx.fillStyle = LIME
  ctx.fillText(first ? `· ${first} → ${last}` : `· ${last}`, 52 + jW - 14, 488)
  ctx.letterSpacing = '0px'
  const points = card.journey
  if (points.length) {
    const gx = 60
    const gy = 506
    const gw = LEFT_W - 60
    const gh = 56
    const top = Math.max(card.trophies.total, ...points, 1)
    const at = (i: number) =>
      [
        points.length === 1 ? gx + gw : gx + (i * gw) / (points.length - 1),
        gy + gh - ((points[i] as number) / top) * gh,
      ] as const
    const area = ctx.createLinearGradient(0, gy, 0, gy + gh)
    area.addColorStop(0, 'rgba(198, 243, 107, 0.4)')
    area.addColorStop(1, 'rgba(198, 243, 107, 0)')
    ctx.beginPath()
    points.forEach((_, i) => {
      const [x, y] = at(i)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.lineTo(at(points.length - 1)[0], gy + gh)
    ctx.lineTo(at(0)[0], gy + gh)
    ctx.closePath()
    ctx.fillStyle = area
    ctx.fill()
    ctx.beginPath()
    points.forEach((_, i) => {
      const [x, y] = at(i)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = LIME
    ctx.lineWidth = 3.5
    ctx.lineJoin = 'round'
    ctx.shadowColor = LIME
    ctx.shadowBlur = 8
    ctx.stroke()
    // A dot on each day something was earned, and the platinum's at the end.
    ctx.fillStyle = '#d2ff86'
    points.forEach((v, i) => {
      if (i > 0 && v === points[i - 1]) return
      const [x, y] = at(i)
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })
    const [ex, ey] = at(points.length - 1)
    ctx.fillStyle = TEXT
    ctx.shadowColor = LIME
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.arc(ex, ey, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

function drawStats({ ctx, card, im, t }: Draw) {
  // The numbers, right.
  const days = daysToPlatinum(card.firstAt, card.earnedAt)
  panel(ctx, SX, 326, CW, 80)
  if (days === null || days === 0) {
    figure(
      ctx,
      days === 0 ? '1' : '—',
      days === 0 ? ` ${t('days', { count: 1 })}` : '',
      SX + 18,
      370,
    )
    label(ctx, days === 0 ? t('sameDay') : t('toPlatinum'), SX + 18, 394)
  } else {
    figure(ctx, String(days), ` ${t('days', { count: days })}`, SX + 18, 370)
    label(ctx, t('toPlatinum'), SX + 18, 394)
  }
  panel(ctx, SX + CW + 10, 326, CW, 80)
  figure(
    ctx,
    card.hours === null ? '—' : String(Math.round(card.hours)),
    card.hours === null ? '' : ' H',
    SX + CW + 28,
    370,
  )
  label(ctx, t('played'), SX + CW + 28, 394)
  panel(ctx, SX, 416, CW, 80)
  figure(ctx, String(card.trophies.earned), `/${card.trophies.total}`, SX + 18, 460)
  label(ctx, t('trophies'), SX + 18, 484)
  panel(ctx, SX + CW + 10, 416, CW, 80)
  let tx = SX + CW + 28
  for (const [n, img] of [
    [card.trophies.gold, im.gold],
    [card.trophies.silver, im.silver],
  ] as const) {
    ctx.font = 'italic 900 42px "Saira Condensed"'
    ctx.fillStyle = TEXT
    ctx.fillText(String(n), tx, 460)
    tx += ctx.measureText(String(n)).width + 4
    if (img) ctx.drawImage(img, tx, 430, 30, 30)
    tx += 44
  }
  label(ctx, t('goldSilver'), SX + CW + 28, 484)
}

function drawRarity({ ctx, card, t }: Draw) {
  // How rare it is.
  chamfer(ctx, SX, 506, 380, 74)
  const rare = ctx.createLinearGradient(SX, 0, SX + 380, 0)
  rare.addColorStop(0, 'rgba(198, 243, 107, 0.18)')
  rare.addColorStop(1, PANEL)
  ctx.fillStyle = rare
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.5
  ctx.stroke()
  const rate = `${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(card.rarity)}%`
  figure(ctx, rate, '', SX + 18, 550)
  label(ctx, t('players'), SX + 18, 572)
  const tag = t(rarityKey(card.rarity))
  ctx.font = 'italic 800 22px "Saira Condensed"'
  ctx.letterSpacing = '2px'
  const tagW = ctx.measureText(tag).width + 28
  const tagX = SX + 380 - 18 - tagW
  skewed(ctx, tagX, 524, tagW, 38, 8)
  const tg = ctx.createLinearGradient(tagX, 0, tagX + tagW, 0)
  tg.addColorStop(0, '#d2ff86')
  tg.addColorStop(1, LIME_DARK)
  ctx.fillStyle = tg
  ctx.fill()
  ctx.fillStyle = INK
  ctx.fillText(tag, tagX + 14, 551)
  ctx.letterSpacing = '0px'
}

/** The brand and where to find it, along the bottom from `y`. */
export function brandFooter(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  cta: string,
  width: number,
  y: number,
) {
  // The brand, and where to find it.
  if (logo) ctx.drawImage(logo, 30, y, 38, 38)
  ctx.font = '700 26px "Space Grotesk"'
  ctx.fillStyle = TEXT
  ctx.fillText('plat', 78, y + 28)
  const pw = ctx.measureText('plat').width
  ctx.fillStyle = LIME
  ctx.fillText('journey', 78 + pw, y + 28)
  ctx.font = '600 15px "Chakra Petch"'
  ctx.letterSpacing = '1px'
  ctx.textAlign = 'right'
  ctx.fillStyle = LIME
  ctx.fillText(SHARE_HOST.toUpperCase(), width - 30, y + 26)
  const hostW = ctx.measureText(SHARE_HOST.toUpperCase()).width
  ctx.fillStyle = MUTED
  ctx.fillText(`${cta} `, width - 30 - hostW - 6, y + 26)
  ctx.textAlign = 'left'
  ctx.letterSpacing = '0px'
}

function drawFooter({ ctx, im, t }: Draw) {
  brandFooter(ctx, im.logo, t('cta'), WIDTH, 618)
}

/** Draws the card and returns it as a PNG. */
export async function drawPlatinumCard(card: PlatinumCard): Promise<Blob> {
  const t = translator(messages)
  const artUrl = card.game.artUrl ?? card.game.coverUrl
  const [, art, cover_, avatar, platinum, gold, silver, logo] = await Promise.all([
    loadFonts(),
    loadImage(artUrl ? proxied(artUrl) : null),
    loadImage(card.game.coverUrl ? proxied(card.game.coverUrl) : null),
    loadImage(card.player.avatarUrl ? proxied(card.player.avatarUrl) : null),
    loadImage('/trophies/platinum.webp'),
    loadImage('/trophies/gold.webp'),
    loadImage('/trophies/silver.webp'),
    loadImage('/logo.png'),
  ])
  const im: Images = { art, cover: cover_, avatar, platinum, gold, silver, logo }
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * SCALE
  canvas.height = HEIGHT * SCALE
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'alphabetic'

  const d: Draw = { ctx, card, im, t }
  drawBackdrop(d)
  drawPlayer(d)
  drawNumber(d)
  drawTitle(d)
  drawTrophy(d)
  drawJourney(d)
  drawStats(d)
  drawRarity(d)
  drawFooter(d)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'),
  )
}
