import type { IncomingMessage } from 'node:http'
import { config } from './config.ts'
import type { Guide } from './guide.ts'
import { defineMessages, fromAcceptLanguage, Language, translator } from './i18n.ts'
import { getGame } from './repository/game.ts'
import { getGuide } from './repository/guide.ts'
import { userByOnlineId } from './repository/user.ts'

// What a link preview and a search engine read before the app runs: a public page's own title,
// description and picture, in the app shell's head. Read from the database only; a page that is
// not public, or not found, keeps the app's general ones.

const messages = defineMessages({
  [Language.PtBR]: {
    guideTitle: 'Guia de platina de {name} · PlatJourney',
    guideFacts: 'Dificuldade {difficulty}/10, cerca de {hours}h, {runs}.',
    runs: { one: '{count} jogatina', other: '{count} jogatinas' },
    missables: { one: '{count} troféu perdível.', other: '{count} troféus perdíveis.' },
    noMissables: 'Sem troféus perdíveis.',
    guideNone: 'Os troféus de {name} e o caminho até a platina no PlatJourney.',
    profileTitle: '{name} · PlatJourney',
    profileDescription: 'As platinas, a coleção e o que {name} está jogando agora.',
    guidesTitle: 'Guias de platina · PlatJourney',
    guidesDescription:
      'Dificuldade, horas, troféus perdíveis e o caminho até a platina de mais de mil jogos de PlayStation.',
    guideHeading: 'Guia de platina de {name}',
    guides: 'Guias de platina',
    missablesHeading: 'Troféus perdíveis',
    roadmapHeading: 'Roteiro até a platina',
    tipsHeading: 'Antes de começar',
    keyHeading: 'Troféus que mais pesam',
    easiest: 'Mais fácil',
    hardest: 'Mais difícil',
    mostTedious: 'Mais demorado',
  },
  [Language.En]: {
    guideTitle: '{name} platinum guide · PlatJourney',
    guideFacts: 'Difficulty {difficulty}/10, about {hours}h, {runs}.',
    runs: { one: '{count} playthrough', other: '{count} playthroughs' },
    missables: { one: '{count} missable trophy.', other: '{count} missable trophies.' },
    noMissables: 'No missable trophies.',
    guideNone: "{name}'s trophies and the way to the platinum on PlatJourney.",
    profileTitle: '{name} · PlatJourney',
    profileDescription: 'The platinums, the collection and what {name} is playing now.',
    guidesTitle: 'Platinum guides · PlatJourney',
    guidesDescription:
      'Difficulty, hours, missable trophies and the way to the platinum for over a thousand PlayStation games.',
    guideHeading: '{name} platinum guide',
    guides: 'Platinum guides',
    missablesHeading: 'Missable trophies',
    roadmapHeading: 'Roadmap to the platinum',
    tipsHeading: 'Before you start',
    keyHeading: 'The trophies that weigh most',
    easiest: 'Easiest',
    hardest: 'Hardest',
    mostTedious: 'Most tedious',
  },
})

export interface PageMeta {
  title: string
  description: string
  /** A full or site-relative image address; none keeps the app's own picture. */
  image?: string
  /** The page's one address (`/title/game/52189`), for search engines: the same page reached as
   * `game%3A52189` or with a `?view=` counts as this one. */
  canonical?: string
  /** What the page says, as plain HTML, for readers that do not run the app (a crawler, an AI
   * assistant): the app replaces it when it starts. */
  content?: string
  /** Where the page sits, from the top (`Guias de platina › Astro Bot`), as site-relative links. */
  trail?: { name: string; path: string }[]
}

const GAME_PAGE = /^\/title\/game\/(?:game:)?([\w-]{1,60})\/?$/
const PROFILE_PAGE = /^\/profiles\/([A-Za-z0-9_-]{3,16})\/?$/

type T = ReturnType<typeof translator<typeof messages>>

// What the guide tells before opening it: difficulty, hours, playthroughs and missables.
function guideFacts(t: T, name: string, guide: Partial<Guide> | undefined): string {
  if (!guide?.difficulty || !guide.hours) return t('guideNone', { name })
  const facts = t('guideFacts', {
    difficulty: guide.difficulty,
    hours: guide.hours,
    runs: t('runs', { count: guide.playthroughs || 1 }),
  })
  const missables = guide.missables?.length
    ? t('missables', { count: guide.missables.length })
    : t('noMissables')
  return `${facts} ${missables}`
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )

const section = (heading: string, items: string[], tag: 'ul' | 'ol' = 'ul') =>
  items.length
    ? `<h2>${escapeHtml(heading)}</h2><${tag}>${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`
    : ''

// The guide's text is light Markdown: bold names and lines of steps.
const md = (s: string) =>
  escapeHtml(s.trim())
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n+/g, '<br>')

// A line that leads with a name: "<b>Trophy</b>: what to know".
const named = (name: string, text?: string | null) =>
  `<b>${escapeHtml(name)}</b>${text ? `: ${md(text)}` : ''}`

/** The guide as a page to read: its facts, overview, missables, roadmap, first tips and key
 * trophies, the same the app shows on the game's page. */
function guideContent(t: T, name: string, summary: string, guide: Partial<Guide> | undefined) {
  const keys = (['easiest', 'hardest', 'mostTedious'] as const).flatMap((k) => {
    const key = guide?.[k]
    return key?.trophy ? [`${escapeHtml(t(k))}: ${named(key.trophy, key.why)}`] : []
  })
  return [
    `<h1>${escapeHtml(t('guideHeading', { name }))}</h1>`,
    `<p>${escapeHtml(summary)}</p>`,
    guide?.overview ? `<p>${md(guide.overview)}</p>` : '',
    section(
      t('missablesHeading'),
      (guide?.missables ?? []).map((m) => named(m.trophy, m.when)),
    ),
    section(
      t('roadmapHeading'),
      (guide?.roadmap ?? []).map((r) => named(r.phase, r.goal)),
      'ol',
    ),
    section(t('tipsHeading'), (guide?.earlyTips ?? []).map(md)),
    section(t('keyHeading'), keys),
    `<p><a href="/guides">${escapeHtml(t('guides'))}</a></p>`,
  ].join('')
}

async function gamePage(t: T, id: string): Promise<PageMeta | null> {
  const found = await getGame(`game:${id}`)
  if (!found) return null
  const guide = await getGuide<Partial<Guide>>(found.id)
  const canonical = `/title/game/${encodeURIComponent(found.id.replace(/^game:/, ''))}`
  const description = guideFacts(t, found.name, guide)
  return {
    canonical,
    title: t('guideTitle', { name: found.name }),
    description,
    image: found.art_url ?? found.cover_url?.replace('/t_cover_big/', '/t_1080p/') ?? undefined,
    content: guideContent(t, found.name, description, guide),
    trail: [
      { name: t('guides'), path: '/guides' },
      { name: found.name, path: canonical },
    ],
  }
}

async function profilePage(t: T, name: string): Promise<PageMeta | null> {
  const player = await userByOnlineId(name)
  if (!player || player.demo || player.community_visible === false) return null
  const shown = player.psn_online_id ?? name
  return {
    canonical: `/profiles/${encodeURIComponent(shown)}`,
    title: t('profileTitle', { name: shown }),
    description: t('profileDescription', { name: shown }),
  }
}

/** The preview of a public page, or null for any other address. */
export async function pageMeta(req: IncomingMessage, raw: string): Promise<PageMeta | null> {
  const t = translator(messages, fromAcceptLanguage(req.headers['accept-language']) ?? undefined)
  // The app's own links once wrote the game's id encoded (`game%3A52189`): read as the same page.
  let path = raw
  try {
    path = decodeURIComponent(raw)
  } catch {}
  if (/^\/guides\/?$/.test(path))
    return { title: t('guidesTitle'), description: t('guidesDescription'), canonical: '/guides' }
  const game = path.match(GAME_PAGE)?.[1]
  if (game) return gamePage(t, game)
  const name = path.match(PROFILE_PAGE)?.[1]
  return name ? profilePage(t, name) : null
}

/** The app shell with a page's own title, description and picture in place of the general ones,
 * and its one address when `base` (the app's address) is known. */
export function withPageMeta(html: string, meta: PageMeta | null, base?: string | null): string {
  if (!meta) return html
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
  if (meta.image)
    out = out
      .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${escapeHtml(meta.image)}$2`)
      // The app's picture is 1200×630; another one has its own size.
      .replace(/<meta property="og:image:(width|height|alt)"[^>]*>\n?/g, '')
  if (meta.canonical && base) {
    const url = escapeHtml(`${base}${meta.canonical}`)
    out = out.replace(
      '</head>',
      `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n</head>`,
    )
  }
  if (meta.trail?.length && base)
    out = out.replace('</head>', `${trailBlock(meta.trail, base)}\n</head>`)
  // Hidden: a browser shows the boot screen until the app replaces both; a reader that does not run
  // the app reads it in the page.
  if (meta.content)
    out = out.replace(
      '<div id="root">',
      `<div id="root">\n<article class="page-preview" hidden>${meta.content}</article>`,
    )
  return out
}

/** Where the page sits, as structured data a search result shows above the title. `<` is escaped so
 * a name cannot close the script. */
function trailBlock(trail: NonNullable<PageMeta['trail']>, base: string) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: `${base}${step.path}`,
    })),
  }
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

/** The app's address, for a page's canonical link: APP_URL, or the one the request came in on (a
 * plain host name only). */
export function siteBase(req: IncomingMessage): string | null {
  if (config.appUrl) return config.appUrl
  const host = req.headers.host
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return null
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
  return `${proto}://${host}`
}
