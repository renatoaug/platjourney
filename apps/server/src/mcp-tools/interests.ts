/** The changes to the player's interests, yearly goal and recommendations, through the same
 * commands the web and Telegram run. */
import { handleInterestCommand } from '../interests.ts'
import { library } from '../library.ts'
import { dismissRecommendation } from '../recommend.ts'
import type { Game } from '../repository/game.ts'
import { listInterests } from '../repository/interest.ts'
import { isDismissReason } from '../repository/recommendation.ts'
import type { User } from '../repository/user.ts'
import { gameArg, gameFrom, gameRow, type Tool, ToolError } from './shared.ts'

// The interest holding a game this year, for the tools that change one.
async function savedInterest(user: User, game: Game) {
  const found = (await listInterests(user.id, new Date().getFullYear())).find(
    (i) => i.game.id === game.id,
  )
  if (!found) throw new ToolError(`${game.name} is not in the interests. See get_interests.`)
  return found
}

// The same commands the web and Telegram run; one that answers its usage text was refused.
async function interestCommand(user: User, command: string) {
  await handleInterestCommand(user, command, await library(user.psn_account_id))
}

export const addInterest: Tool = {
  name: 'add_interest',
  description:
    "Saves a game to the player's interests (the games they want to platinum this year).",
  inputSchema: { type: 'object', properties: { game: gameArg }, required: ['game'] },
  changes: true,
  run: async (user, args) => {
    const game = await gameFrom(args)
    await interestCommand(user, `add ${game.id}`)
    return { saved: gameRow(game) }
  },
}

export const removeInterest: Tool = {
  name: 'remove_interest',
  description: "Removes a game from the player's interests.",
  inputSchema: { type: 'object', properties: { game: gameArg }, required: ['game'] },
  changes: true,
  destructive: true,
  run: async (user, args) => {
    const interest = await savedInterest(user, await gameFrom(args))
    await interestCommand(user, `remove ${interest.id}`)
    return { removed: interest.game.name }
  },
}

export const markOwned: Tool = {
  name: 'mark_owned',
  description:
    'Marks a saved game as already owned (bought but never opened, so PSN does not show it): it leaves the deals.',
  inputSchema: { type: 'object', properties: { game: gameArg }, required: ['game'] },
  changes: true,
  run: async (user, args) => {
    const interest = await savedInterest(user, await gameFrom(args))
    await interestCommand(user, `owned ${interest.id}`)
    return { owned: interest.game.name }
  },
}

export const setYearlyGoal: Tool = {
  name: 'set_yearly_goal',
  description: 'Sets how many platinums the player wants this year.',
  inputSchema: {
    type: 'object',
    properties: { target: { type: 'number', description: 'Platinums this year, 1 to 365.' } },
    required: ['target'],
  },
  changes: true,
  run: async (user, args) => {
    const target = Number(args.target)
    if (!Number.isInteger(target) || target < 1 || target > 365)
      throw new ToolError('The goal is a whole number of platinums, from 1 to 365.')
    await interestCommand(user, `set ${target}`)
    return { year: new Date().getFullYear(), goal: target }
  },
}

export const dismissRecommendationTool: Tool = {
  name: 'dismiss_recommendation',
  description:
    'Tells PlatJourney not to recommend a game again, optionally why, so similar ones weigh less.',
  inputSchema: {
    type: 'object',
    properties: {
      game: gameArg,
      reason: {
        type: 'string',
        enum: ['too_long', 'too_hard', 'genre', 'online', 'played'],
        description: 'Why, when the player said.',
      },
    },
    required: ['game'],
  },
  changes: true,
  run: async (user, args) => {
    const game = await gameFrom(args)
    const reason = isDismissReason(args.reason) ? args.reason : undefined
    await dismissRecommendation(user, game.id, reason)
    return { dismissed: game.name, reason: reason ?? null }
  },
}
