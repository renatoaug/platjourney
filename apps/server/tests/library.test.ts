import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { library, ownedGames } from '../src/library.ts'
import * as psn from '../src/psn.ts'
import * as games from '../src/repository/game.ts'
import { makeGame, makeTitle } from './fixtures.ts'

afterEach(() => mock.restore())

test('the trophy list is cached per account until forced', async () => {
  const titles = [makeTitle()]
  const all = spyOn(psn, 'allTitles').mockResolvedValue(titles)
  expect(await library('lib-acc-1')).toBe(titles)
  expect(await library('lib-acc-1')).toBe(titles)
  expect(all).toHaveBeenCalledTimes(1)
  await library('lib-acc-1', true)
  expect(all).toHaveBeenCalledTimes(2)
  expect(all).toHaveBeenCalledWith('lib-acc-1')
})

test('owned games collapse copies of the same game and are cached', async () => {
  const a = makeGame({ id: 'game:1' })
  const b = makeGame({ id: 'game:2' })
  const titles = [makeTitle({ npCommunicationId: 'N1' }), makeTitle({ npCommunicationId: 'N2' })]
  spyOn(psn, 'allTitles').mockResolvedValue(titles)
  const resolve = spyOn(games, 'gamesForTitles').mockResolvedValue(
    new Map([
      ['N1', a],
      ['N2', a],
      ['N3', b],
    ]),
  )
  expect(await ownedGames('lib-acc-2')).toEqual([a, b])
  expect(resolve).toHaveBeenCalledWith(titles, false)
  await ownedGames('lib-acc-2')
  expect(resolve).toHaveBeenCalledTimes(1)
})
