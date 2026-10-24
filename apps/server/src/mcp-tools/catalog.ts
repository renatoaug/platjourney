/** The reads about games outside the player: the catalog, the guides, the deep guide's passages,
 * similar games and the releases. */
import { ai } from '../ai.ts'
import { browseGuides } from '../browse.ts'
import { tagged } from '../costs.ts'
import { isDemo } from '../demo.ts'
import { RELEASES_AFTER_DAYS, RELEASES_BEFORE_DAYS } from '../releases.ts'
import { releasesBetween } from '../repository/game.ts'
import { getGuide } from '../repository/guide.ts'
import { similarToGame } from '../similar.ts'
import { gameArg, gameFrom, gameRow, SAVE_PICK, type Tool, ToolError } from './shared.ts'

export const searchGames: Tool = {
  name: 'search_games',
  description:
    'Finds games in the PlatJourney catalog by name, with whether each has a platinum guide and its difficulty and hours.',
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Part of the game name.' } },
    required: ['query'],
  },
  run: async (_user, args) => {
    const query = typeof args.query === 'string' ? args.query.trim().slice(0, 100) : ''
    if (query.length < 2) throw new ToolError('Type at least two letters of the name.')
    const page = await browseGuides({ query })
    return {
      games: page.items.slice(0, 10).map((g) => ({
        id: g.id,
        name: g.name,
        platforms: g.platforms,
        guide: g.guide
          ? { difficulty: g.guide.difficulty ?? null, hours: g.guide.hours ?? null }
          : null,
      })),
    }
  },
}

export const getGuideTool: Tool = {
  name: 'get_guide',
  description:
    "A game's platinum guide researched by PlatJourney: difficulty, hours, playthroughs, roadmap, missable trophies, online trophies, key trophies and known bugs.",
  inputSchema: { type: 'object', properties: { game: gameArg }, required: ['game'] },
  run: async (_user, args) => {
    const game = await gameFrom(args)
    const guide = await getGuide<Record<string, unknown>>(game.id)
    return { game: gameRow(game), guide: guide ?? null }
  },
}

export const searchDeepGuide: Tool = {
  name: 'search_deep_guide',
  description:
    'Passages from the full guides PlatJourney indexed for a game, the ones that answer a question (where a collectible is, how a trophy unlocks). Each passage names its source page.',
  inputSchema: {
    type: 'object',
    properties: {
      game: gameArg,
      question: { type: 'string', description: 'The question, in any language.' },
    },
    required: ['game', 'question'],
  },
  run: async (user, args) => {
    if (isDemo(user)) throw new ToolError('The deep guide is not part of the demo.')
    const game = await gameFrom(args)
    const question = typeof args.question === 'string' ? args.question.trim().slice(0, 500) : ''
    if (!question) throw new ToolError('Ask a question.')
    const found = await tagged({ user: user.id, action: 'mcp_deep_guide' }, () =>
      ai<{ passages: { source: string; url: string; heading: string; content: string }[] }>(
        '/deep-guide/retrieve',
        { game, question, terms: [], limit: 6 },
      ),
    )
    return {
      game: gameRow(game),
      passages: found.passages.map((p) => ({
        source: p.source,
        url: p.url,
        heading: p.heading,
        content: p.content,
      })),
    }
  },
}

export const getSimilarGames: Tool = {
  name: 'get_similar_games',
  description:
    'Games like one game: its expansions, base game and series first, then similar games, each with its guide difficulty and hours.',
  inputSchema: { type: 'object', properties: { game: gameArg }, required: ['game'] },
  next: SAVE_PICK,
  run: async (_user, args) => {
    const game = await gameFrom(args)
    return {
      game: gameRow(game),
      similar: (await similarToGame(game.id)).slice(0, 15).map((s) => ({
        game: gameRow(s.game),
        relation: s.relation,
        difficulty: s.difficulty,
        hours: s.hours,
      })),
    }
  },
}

export const getReleases: Tool = {
  name: 'get_releases',
  description:
    'PS4 and PS5 games that just came out or are coming out in the next weeks, the most awaited first, with the guide difficulty and hours when there is one.',
  inputSchema: { type: 'object', properties: {} },
  run: async () => {
    const day = 86_400_000
    const now = Date.now()
    const releases = await releasesBetween(
      new Date(now - RELEASES_BEFORE_DAYS * day),
      new Date(now + RELEASES_AFTER_DAYS * day),
    )
    return { releases }
  },
}
