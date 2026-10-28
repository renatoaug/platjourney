import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as lib from '../src/library.ts'
import { hours, playtimes } from '../src/playtime.ts'
import * as psn from '../src/psn.ts'
import * as games from '../src/repository/game.ts'
import { storeName } from '../src/repository/game.ts'
import * as repo from '../src/repository/playtime.ts'
import { makeGame, makeTitle, makeUser } from './fixtures.ts'

afterEach(() => mock.restore())

const played = (name: string, seconds: number, first: string | null, last: string | null) => ({
  titleId: `T-${name}`,
  name,
  platform: 'PS5',
  seconds,
  playCount: 2,
  firstPlayed: first,
  lastPlayed: last,
})

async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await Bun.sleep(1)
}

test('stored playtime answers at once while PSN is synced behind it', async () => {
  const user = makeUser({ id: 'user:pt1', psn_account_id: 'pt-acc' })
  const gone = makeGame({ id: 'game:20', name: 'Gone' })
  const other = makeGame({ id: 'game:21', name: 'Other' })
  spyOn(psn, 'playedGames').mockResolvedValue([
    played('Gone™', 3600, '2026-02-01', '2026-03-01'),
    played('Gone (PlayStation®5)', 1800, '2026-01-01', null),
    played('Other', 600, null, '2026-04-01'),
    played('Never', 0, null, null),
    played('SHAREfactory™', 900, null, null),
  ])
  spyOn(lib, 'library').mockResolvedValue([makeTitle({ name: 'GONE' })])
  const forTitle = spyOn(games, 'gameForTitle').mockResolvedValue(gone)
  const forName = spyOn(games, 'catalogGameForName').mockImplementation(async (name) =>
    name === 'Other' ? other : undefined,
  )
  const save = spyOn(repo, 'savePlaytime').mockResolvedValue(undefined)
  const stored = {
    game: 'game:20',
    seconds: 60,
    play_count: 1,
    first_played_at: null,
    last_played_at: null,
  }
  const list = spyOn(repo, 'listPlaytimes').mockResolvedValue([stored])

  const first = await playtimes(user)
  expect(first.get('game:20')).toEqual(stored)
  await until(() => list.mock.calls.length >= 2)
  await Bun.sleep(5)

  expect(forTitle).toHaveBeenCalledTimes(2)
  expect(forName).toHaveBeenCalledWith('Other')
  // A name no catalog knows is not stored as a game, and its playtime is left out.
  expect(forName).toHaveBeenCalledWith('SHAREfactory™')
  expect(save.mock.calls).toEqual([
    [
      'user:pt1',
      {
        game: 'game:20',
        seconds: 5400,
        play_count: 4,
        first_played_at: '2026-01-01',
        last_played_at: '2026-03-01',
      },
    ],
    [
      'user:pt1',
      {
        game: 'game:21',
        seconds: 600,
        play_count: 2,
        first_played_at: null,
        last_played_at: '2026-04-01',
      },
    ],
  ])
  await playtimes(user)
  expect(list).toHaveBeenCalledTimes(2)
})

test('a failed sync is logged and the stored playtime still answers', async () => {
  const user = makeUser({ id: 'user:pt2' })
  const error = spyOn(console, 'error').mockImplementation(() => {})
  spyOn(psn, 'playedGames').mockRejectedValue(new Error('psn down'))
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(repo, 'listPlaytimes').mockResolvedValue([])
  expect((await playtimes(user)).size).toBe(0)
  await until(() => error.mock.calls.length > 0)
  expect(error).toHaveBeenCalledWith('playtime sync failed:', 'psn down')
})

test('store names lose the console and edition tags', () => {
  expect(storeName('Grand Theft Auto V (PlayStation®5)')).toBe('Grand Theft Auto V')
  expect(storeName('Terraria – PlayStation®4 Edition')).toBe('Terraria')
  expect(storeName('Worms [PS1 Emulation]')).toBe('Worms')
  expect(storeName('Once Human (Gratuito para jogar)')).toBe('Once Human')
  expect(storeName('Where Winds Meet (F2P)')).toBe('Where Winds Meet')
  expect(storeName('Marvel’s Spider-Man 2')).toBe('Marvel’s Spider-Man 2')
})

test('hours are rounded to one decimal, null when unknown', () => {
  expect(
    hours({ game: 'g', seconds: 5400, play_count: 1, first_played_at: null, last_played_at: null }),
  ).toBe(1.5)
  expect(hours(undefined)).toBeNull()
})
