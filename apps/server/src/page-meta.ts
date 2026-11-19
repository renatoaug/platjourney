import type { IncomingMessage } from 'node:http'
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
  },
})

export interface PageMeta {
  title: string
  description: string
  /** A full or site-relative image address; none keeps the app's own picture. */
  image?: string
}

const GAME_PAGE = /^\/title\/game\/((?:game:)?[\w-]{1,60})\/?$/
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

async function gamePage(t: T, id: string): Promise<PageMeta | null> {
  const found = await getGame(id.startsWith('game:') ? id : `game:${id}`)
  if (!found) return null
  return {
    title: t('guideTitle', { name: found.name }),
    description: guideFacts(t, found.name, await getGuide<Partial<Guide>>(found.id)),
    image: found.art_url ?? found.cover_url?.replace('/t_cover_big/', '/t_1080p/') ?? undefined,
  }
}

async function profilePage(t: T, name: string): Promise<PageMeta | null> {
  const player = await userByOnlineId(name)
  if (!player || player.demo || player.community_visible === false) return null
  const shown = player.psn_online_id ?? name
  return {
    title: t('profileTitle', { name: shown }),
    description: t('profileDescription', { name: shown }),
  }
}

/** The preview of a public page, or null for any other address. */
export async function pageMeta(req: IncomingMessage, path: string): Promise<PageMeta | null> {
  const t = translator(messages, fromAcceptLanguage(req.headers['accept-language']) ?? undefined)
  if (/^\/guides\/?$/.test(path))
    return { title: t('guidesTitle'), description: t('guidesDescription') }
  const game = path.match(GAME_PAGE)?.[1]
  if (game) return gamePage(t, game)
  const name = path.match(PROFILE_PAGE)?.[1]
  return name ? profilePage(t, name) : null
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )

/** The app shell with a page's own title, description and picture in place of the general ones. */
export function withPageMeta(html: string, meta: PageMeta | null): string {
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
  return out
}
