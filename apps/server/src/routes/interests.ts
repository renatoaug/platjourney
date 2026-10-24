import { json, readBody } from '../http.ts'
import { defineMessages, Language, translator } from '../i18n.ts'
import { handleInterestCommand, yearProgress } from '../interests.ts'
import { ownedGames } from '../library.ts'
import { MAX_MOOD, nextPick, pickHistory } from '../next-pick.ts'
import { playtimes } from '../playtime.ts'
import { dismissRecommendation, readPrefs, recommendations } from '../recommend.ts'
import { getGame } from '../repository/game.ts'
import { isDismissReason } from '../repository/recommendation.ts'
import { updateUser } from '../repository/user.ts'
import { similarPicks } from '../similar.ts'
import { type Api, type ApiHandler, requestLocale } from './api.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    pickCatalogGame: 'Selecione um jogo do catálogo.',
  },
  [Language.En]: {
    pickCatalogGame: 'Pick a game from the catalog.',
  },
})

async function goals({ req, res, me, locale, titles }: Api) {
  const t = translator(messages, locale)
  const { command } = await readBody(req)
  if (typeof command !== 'string') return json(res, 400, { error: 'command required' })
  if (command.startsWith('add ')) {
    // The game's id, without where it was saved from ("add game:12 from:releases").
    const id = command.slice(4).trim().split(/\s+/)[0]
    if (!id.startsWith('game:') || !(await getGame(id)))
      return json(res, 400, { error: t('pickCatalogGame') })
  }
  await handleInterestCommand(me, command, await titles())
  return json(res, 200, await yearProgress(me, await titles(), undefined, await playtimes(me)))
}

async function dismissPick({ req, res, me, titles }: Api) {
  const { game, reason } = await readBody(req)
  if (typeof game !== 'string' || !game.startsWith('game:'))
    return json(res, 400, { error: 'game required' })
  if (reason !== undefined && !isDismissReason(reason))
    return json(res, 400, { error: 'invalid reason' })
  await dismissRecommendation(me, game, reason)
  return json(
    res,
    200,
    await recommendations(me, await titles(), await ownedGames(me.psn_account_id)),
  )
}

// The player's changes to the taste profile and their rules; the stored batch answers, and a new
// one (model work) waits for the refresh button.
async function tastePreferences({ req, res, me, titles }: Api) {
  const prefs = readPrefs(await readBody(req))
  if (!prefs) return json(res, 400, { error: 'invalid' })
  await updateUser(me.id, { taste_prefs: prefs })
  return json(
    res,
    200,
    await recommendations(
      { ...me, taste_prefs: prefs },
      await titles(),
      await ownedGames(me.psn_account_id),
      false,
      true,
    ),
  )
}

// The interests and goals, Nexo's picks and the recommendations.
export const INTEREST_ROUTES: Record<string, ApiHandler> = {
  'POST /api/goals': goals,
  // The picks the player asked Nexo for, the latest first: read only, so the demo has them too.
  'GET /api/picks': async ({ res, me }) => json(res, 200, { picks: await pickHistory(me) }),
  // Model work: Nexo picks one game to platinum now, with the player's mood and where to look.
  'POST /api/picks': async ({ req, res, me, titles }) => {
    const { mood, scope, ownedOnly } = await readBody(req)
    if (mood !== undefined && typeof mood !== 'string') return json(res, 400, { error: 'invalid' })
    if (scope !== undefined && scope !== 'interests' && scope !== 'any')
      return json(res, 400, { error: 'invalid' })
    const pick = await nextPick(me, await titles(), requestLocale(req, me), {
      mood: mood?.slice(0, MAX_MOOD),
      scope,
      ownedOnly: ownedOnly === true,
    })
    json(res, 200, { pick })
  },
  'POST /api/recommendations/dismiss': dismissPick,
  'POST /api/recommendations/preferences': tastePreferences,
  // Recommendations by similar games: graph reads only, no model, so the demo has them too.
  'GET /api/recommendations/similar': async ({ res, me, titles }) =>
    json(res, 200, await similarPicks(me, await titles(), await ownedGames(me.psn_account_id))),
  'GET /api/recommendations': async ({ res, url, me, titles }) => {
    const force = url.searchParams.get('refresh') === '1'
    // stored=1 answers the batch already saved, never a new one: the page shows it on every visit
    // without asking the model.
    const storedOnly = url.searchParams.get('stored') === '1'
    return json(
      res,
      200,
      await recommendations(
        me,
        await titles(),
        await ownedGames(me.psn_account_id),
        force,
        storedOnly,
      ),
    )
  },
}
