import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA, SAMPLE_ME } from '../../src/app/app-state'
import { LibraryCard } from '../../src/components/game-cards'
import { rankingData } from '../../src/components/game-cards.stories'
import { SaveToInterests } from '../../src/components/save-to-interests'
import { SimilarGames } from '../../src/components/similar-games'
import { similarGamesData } from '../../src/components/similar-games.stories'
import { similarData } from '../../src/components/similar-picks.stories'
import type { Game } from '../../src/lib/types'
import { Discover } from '../../src/pages/discover'
import { mockApi, renderApp } from '../support/web'

afterEach(() => mock.restore())

// The interests after a save: the game in them.
const savedGoals = (game: Pick<Game, 'id' | 'name'>) => ({
  ...SAMPLE_DATA.goals,
  interests: [{ id: 'interest:1', game, position: 1, progress: 0, done: false }],
})

/** Saves with the bookmark named for `name`, then checks the command sent and the filled bookmark. */
async function saves(name: string, command: string, calls: { body: unknown }[]) {
  fireEvent.click(screen.getByRole('button', { name: `Salvar ${name} nos interesses` }))
  const saved = await screen.findByRole('button', { name: `Remover ${name} dos interesses` })
  await waitFor(() => expect(saved.hasAttribute('disabled')).toBe(false))
  expect(saved.className).toContain('saved')
  expect(calls.at(-1)?.body).toEqual({ command })
}

test('the bookmark saves a game and takes it out again, without opening it', async () => {
  const game = { id: 'game:20', name: 'Astro’s Playroom' }
  const calls = mockApi({
    'POST /api/goals': (c) =>
      String((c.body as { command: string }).command).startsWith('add')
        ? savedGoals(game)
        : SAMPLE_DATA.goals,
  })
  renderApp(<SaveToInterests game={game} source="recommendations" />, { path: '/discover' })
  await saves(game.name, 'add game:20 from:recommendations', calls)
  fireEvent.click(screen.getByRole('button', { name: `Remover ${game.name} dos interesses` }))
  expect(
    await screen.findByRole('button', { name: `Salvar ${game.name} nos interesses` }),
  ).toBeTruthy()
  expect(calls.at(-1)?.body).toEqual({ command: 'remove interest:1' })
  expect(screen.getByTestId('location').textContent).toBe('/discover')
})

test('short platinums and the same series can be saved from Discover', async () => {
  const [astro] = similarData.quick
  const [forbidden] = similarData.series
  const calls = mockApi({
    'POST /api/goals': (c) =>
      String((c.body as { command: string }).command).includes(astro.game.id)
        ? savedGoals(astro.game)
        : savedGoals(forbidden.game),
  })
  renderApp(<Discover releases={null} />, {
    value: { data: SAMPLE_DATA, cache: { similar: similarData, recsChecked: true } },
  })
  const quick = screen.getByRole('region', { name: 'Platina relâmpago' })
  expect(
    within(quick).getByRole('button', { name: `Salvar ${astro.game.name} nos interesses` }),
  ).toBeTruthy()
  // Dismiss stays with Nexo's and the similar games' cards.
  expect(within(quick).queryByRole('button', { name: /Não recomendar/ })).toBeNull()
  await saves(astro.game.name, `add ${astro.game.id} from:similar`, calls)
  const series = screen.getByRole('region', { name: 'Na mesma série' })
  expect(within(series).queryByRole('button', { name: /Não recomendar/ })).toBeNull()
  await saves(forbidden.game.name, `add ${forbidden.game.id} from:similar`, calls)
})

test('a library card can be saved', async () => {
  const [daysGone] = rankingData
  const calls = mockApi({
    'POST /api/goals': savedGoals({ id: daysGone.game, name: daysGone.name }),
  })
  renderApp(<LibraryCard item={daysGone} index={0} />)
  await saves(daysGone.name, `add ${daysGone.game} from:similar`, calls)
})

test('a similar game on the game page can be saved, as a suggestion', async () => {
  const [ghost] = similarGamesData
  const calls = mockApi({ 'POST /api/goals': savedGoals(ghost.game) })
  renderApp(<SimilarGames state={{ status: 'ok', items: [ghost] }} />)
  await saves(ghost.game.name, `add ${ghost.game.id} from:similar`, calls)
})

test('the demo has no bookmark on any card', () => {
  mockApi({})
  const demo = { ...SAMPLE_ME, demo: true }
  renderApp(<Discover releases={null} />, {
    value: {
      me: demo,
      data: { ...SAMPLE_DATA, ranking: rankingData },
      cache: { similar: similarData, recsChecked: true },
    },
  })
  expect(document.querySelectorAll('.band-card')).not.toHaveLength(0)
  expect(screen.queryByRole('button', { name: /nos interesses/ })).toBeNull()
})
