import type { GameContext } from './nexo.ts'
import type { User } from './repository/user.ts'

// The facts about the game a player is on, as the AI service reads them.
export const aiContext = (ctx: GameContext, user: User) => ({
  game: ctx.game,
  title: ctx.title,
  trophies: ctx.trophies,
  guide: ctx.guide ?? null,
  groups: ctx.groups ?? null,
  hoursPlayed: ctx.hoursPlayed ?? null,
  includeDlcProgress: user.include_dlc_progress === true,
  owned: ctx.owned !== false,
  // Nexo writes in the app's language; an account with none set reads Portuguese.
  locale: user.locale === 'en' ? 'en' : 'pt-BR',
})
