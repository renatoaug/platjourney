import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import { currentTag } from '../src/costs.ts'
import type { RankedTitle } from '../src/ranking.ts'
import * as ranking from '../src/ranking.ts'
import * as activity from '../src/repository/activity.ts'
import type { ServerStatus } from '../src/repository/server-status.ts'
import * as statuses from '../src/repository/server-status.ts'
import { checkServers, serverReport } from '../src/servers.ts'
import { makeGame, makeTitle, makeUser } from './fixtures.ts'

const user = makeUser()
const fresh = makeGame({ id: 'game:1', name: 'Fresh' })
const stale = makeGame({ id: 'game:2', name: 'Stale' })
const unknown = makeGame({ id: 'game:3', name: 'Unknown' })
const ranked = (game: RankedTitle['game']): RankedTitle => ({
  game,
  title: makeTitle(),
  groups: null,
  remaining: 1,
  effort: 1,
  baseProgress: 90,
})
const status = (
  game: ServerStatus['game'],
  state: ServerStatus['status'],
  over: Partial<ServerStatus> = {},
): ServerStatus => ({
  id: `server_status:${game.id}`,
  game,
  status: state,
  date: null,
  note: null,
  checked_at: new Date().toISOString(),
  ...over,
})

afterEach(() => mock.restore())

test('stale and unknown games are checked and only new closings are warned', async () => {
  spyOn(console, 'log').mockImplementation(() => {})
  spyOn(ranking, 'rankNextPlatinum').mockResolvedValue([
    ranked(fresh),
    ranked(stale),
    ranked(unknown),
  ])
  const list = spyOn(statuses, 'listServerStatuses')
    .mockResolvedValueOnce([
      status(fresh, 'closed'),
      status(stale, 'active', { checked_at: '2020-01-01T00:00:00Z' }),
    ])
    .mockResolvedValueOnce([
      status(fresh, 'closed'),
      status(stale, 'announced', { date: '2026-12-01', note: 'Fim do online.' }),
      status(unknown, 'closed', { note: 'Já era.' }),
    ])
  let tag: unknown
  const ai = spyOn(aiModule, 'ai').mockImplementation((async () => {
    tag = currentTag()
    return {
      games: [
        { name: 'Stale', status: 'announced', date: '2026-12-01', note: 'Fim do online.' },
        { name: 'Unknown', status: 'closed', date: null, note: null },
        { name: 'Stray', status: 'closed', date: null, note: null },
      ],
    }
  }) as never)
  const save = spyOn(statuses, 'saveServerStatus').mockResolvedValue(undefined)
  spyOn(activity, 'serverWarnedGames').mockResolvedValue(new Set(['game:1']))
  const log = spyOn(activity, 'logTip').mockResolvedValue(undefined)

  const warnings = await checkServers(user, [])
  expect(ai).toHaveBeenCalledWith('/servers/check', { names: ['Stale', 'Unknown'] })
  expect(tag).toEqual({ user: 'user:u1', action: 'server_check' })
  expect(save.mock.calls).toEqual([
    [{ game: 'game:2', status: 'announced', date: '2026-12-01', note: 'Fim do online.' }],
    [{ game: 'game:3', status: 'closed', date: null, note: null }],
  ])
  expect(list.mock.calls[1]).toEqual([['game:1', 'game:2', 'game:3']])
  expect(warnings).toEqual([
    '⚠️ **Stale**: servidor fecha em 2026-12-01. Fim do online. Se quiser a platina, prioriza o online agora.',
    '⚠️ **Unknown**: servidores já fechados. Já era.',
  ])
  expect(log.mock.calls.map((c) => c.slice(1, 2).concat(c[3] as string))).toEqual([
    ['server', 'game:2'],
    ['server', 'game:3'],
  ])
})

test('fresh statuses need no web search', async () => {
  spyOn(ranking, 'rankNextPlatinum').mockResolvedValue([ranked(fresh)])
  spyOn(statuses, 'listServerStatuses').mockResolvedValue([status(fresh, 'announced')])
  const ai = spyOn(aiModule, 'ai')
  spyOn(activity, 'serverWarnedGames').mockResolvedValue(new Set())
  spyOn(activity, 'logTip').mockResolvedValue(undefined)
  expect(await checkServers(user, [])).toEqual([
    '⚠️ **Fresh**: servidor fecha.  Se quiser a platina, prioriza o online agora.',
  ])
  expect(ai).not.toHaveBeenCalled()
})

test('the report lists known statuses of the games in progress', async () => {
  spyOn(ranking, 'rankNextPlatinum').mockResolvedValue([ranked(fresh)])
  spyOn(statuses, 'listServerStatuses').mockResolvedValue([
    status(fresh, 'active'),
    status(stale, 'announced', { note: 'Fim' }),
    status(unknown, 'unknown'),
    status(makeGame({ name: 'Closed' }), 'closed'),
  ])
  expect(await serverReport(user, [])).toBe(
    ['• Fresh: online ok', '• Stale: fecha em ? (Fim)', '• Closed: fechado'].join('\n'),
  )
})

test('an empty report says there are no alerts', async () => {
  spyOn(ranking, 'rankNextPlatinum').mockResolvedValue([])
  spyOn(statuses, 'listServerStatuses').mockResolvedValue([])
  expect(await serverReport(user, [])).toBe(
    'Nenhum alerta de servidor nos seus jogos próximos da platina.',
  )
})
