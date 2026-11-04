import type { GameContext } from './nexo.ts'
import { getJourneyModel } from './repository/journey-model.ts'

/** Refresh at request/plan boundaries; publication and rollback never need an app restart. */
export async function withJourneyModel(ctx: GameContext): Promise<GameContext> {
  return { ...ctx, journeyModel: await getJourneyModel(ctx.game.id, ctx.title.npCommunicationId) }
}
