import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as api from 'psn-api'
import {
  aboutMe,
  allTitles,
  catalogTrophies,
  forgetProfiles,
  forgetTrophyLists,
  lookupProfile,
  nowPlaying,
  PrivateProfile,
  playedGames,
  profileSummary,
  recentTitles,
  titleGroups,
  titleTrophies,
  trophiesVisible,
} from '../src/psn.ts'
import { counts, makeTitle } from './fixtures.ts'

const tokens = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }

beforeEach(() => {
  forgetProfiles()
  forgetTrophyLists()
  spyOn(api, 'exchangeNpssoForAccessCode').mockResolvedValue('code')
  spyOn(api, 'exchangeAccessCodeForAuthTokens').mockResolvedValue(tokens as never)
  spyOn(api, 'exchangeRefreshTokenForAuthTokens').mockResolvedValue(tokens as never)
})

afterEach(() => mock.restore())

const psnTitle = (id: string, over: Record<string, unknown> = {}) => ({
  npCommunicationId: id,
  trophyTitleName: `Game ${id}`,
  trophyTitlePlatform: 'PS5',
  trophyTitleIconUrl: 'icon.png',
  progress: 40,
  earnedTrophies: counts(3, 1, 0, 0),
  definedTrophies: counts(10, 4, 2, 1),
  lastUpdatedDateTime: '2026-05-01T00:00:00Z',
  ...over,
})

test('an expired session token is refreshed before the next call', async () => {
  const expired = { ...tokens, expiresIn: 0 }
  spyOn(api, 'exchangeAccessCodeForAuthTokens').mockResolvedValue(expired as never)
  const refresh = spyOn(api, 'exchangeRefreshTokenForAuthTokens').mockResolvedValue(
    expired as never,
  )
  spyOn(api, 'getUserTitles').mockResolvedValue({ trophyTitles: [], totalItemCount: 0 } as never)
  await recentTitles('acc')
  await recentTitles('acc')
  expect(refresh).toHaveBeenCalledWith('r')
})

test('recent titles are mapped to progress with trophy totals', async () => {
  const titles = spyOn(api, 'getUserTitles').mockResolvedValue({
    trophyTitles: [psnTitle('NP1')],
    totalItemCount: 1,
  } as never)
  expect(await recentTitles('acc', 5)).toEqual([
    {
      npCommunicationId: 'NP1',
      name: 'Game NP1',
      platform: 'PS5',
      iconUrl: 'icon.png',
      progress: 40,
      earned: 4,
      total: 17,
      earnedByType: counts(3, 1, 0, 0),
      definedByType: counts(10, 4, 2, 1),
      lastUpdated: '2026-05-01T00:00:00Z',
    },
  ])
  expect(titles.mock.calls[0].slice(1)).toEqual(['acc', { limit: 5 }])
})

test('trophies are visible unless PSN says the profile is private', async () => {
  const titles = spyOn(api, 'getUserTitles')
    .mockResolvedValueOnce({ trophyTitles: [], totalItemCount: 0 } as never)
    .mockResolvedValueOnce({ error: { code: 2240526, message: 'Not permitted' } } as never)
    .mockResolvedValueOnce({ error: { code: 1, message: 'Bad request' } } as never)
  expect(await trophiesVisible('acc')).toBe(true)
  expect(await trophiesVisible('acc')).toBe(false)
  await expect(trophiesVisible('acc')).rejects.toThrow('psn: Bad request')
  expect(titles).toHaveBeenCalledTimes(3)
})

test('a private profile raises PrivateProfile on reads', async () => {
  spyOn(api, 'getUserTitles').mockResolvedValue({ error: { code: 2240526 } } as never)
  await expect(recentTitles('acc')).rejects.toBeInstanceOf(PrivateProfile)
})

test('every page of a big library is fetched', async () => {
  const titles = spyOn(api, 'getUserTitles').mockImplementation((async (
    _a: unknown,
    _acc: string,
    opts: { offset?: number },
  ) => ({
    trophyTitles: [psnTitle(`NP${opts.offset ?? 0}`)],
    totalItemCount: 1700,
  })) as never)
  const all = await allTitles('acc')
  expect(all.map((t) => t.npCommunicationId)).toEqual(['NP0', 'NP800', 'NP1600'])
  expect(titles.mock.calls.map((c) => c[2])).toEqual([
    { limit: 800 },
    { limit: 800, offset: 800 },
    { limit: 800, offset: 1600 },
  ])
})

test('a profile is found only by an exact online id, ignoring case', async () => {
  const result = (onlineId: string, avatarUrl?: string) => ({
    socialMetadata: { onlineId, accountId: `id-${onlineId}`, avatarUrl },
  })
  spyOn(api, 'makeUniversalSearch').mockResolvedValue({
    domainResponses: [{ results: [result('PlayerOne'), result('player', 'a.png')] }],
  } as never)
  expect(await lookupProfile('PLAYER')).toEqual({
    accountId: 'id-player',
    onlineId: 'player',
    avatarUrl: 'a.png',
  })
  expect(await lookupProfile('playerone')).toEqual({
    accountId: 'id-PlayerOne',
    onlineId: 'PlayerOne',
    avatarUrl: null,
  })
  spyOn(api, 'getProfileFromUserName').mockRejectedValue(new Error('Not Found'))
  expect(await lookupProfile('nobody')).toBeNull()
})

test('a looked-up profile is reused for a few minutes', async () => {
  const search = spyOn(api, 'makeUniversalSearch').mockResolvedValue({
    domainResponses: [
      { results: [{ socialMetadata: { onlineId: 'Kratos', accountId: 'acc-k' } }] },
    ],
  } as never)
  await lookupProfile('Kratos')
  await lookupProfile('kratos')
  expect(search).toHaveBeenCalledTimes(1)
})

test('an id the search leaves out is asked for directly', async () => {
  spyOn(api, 'makeUniversalSearch').mockResolvedValue({ domainResponses: [] } as never)
  const direct = spyOn(api, 'getProfileFromUserName').mockResolvedValue({
    profile: {
      onlineId: 'arielle_ames',
      accountId: '894',
      avatarUrls: [
        { size: 's', avatarUrl: 's.png' },
        { size: 'l', avatarUrl: 'http://x/l.png' },
      ],
    },
  } as never)
  expect(await lookupProfile('Arielle_Ames')).toEqual({
    accountId: '894',
    onlineId: 'arielle_ames',
    avatarUrl: 'https://x/l.png',
  })
  expect(direct).toHaveBeenCalledWith(expect.anything(), 'Arielle_Ames')
  direct.mockResolvedValue({ profile: { onlineId: 'other', accountId: '1' } } as never)
  expect(await lookupProfile('x')).toBeNull()
  direct.mockRejectedValue(new Error('Not Found'))
  expect(await lookupProfile('x')).toBeNull()
})

test('about me is the text, empty when unset, null when unreadable', async () => {
  spyOn(api, 'getProfileFromAccountId')
    .mockResolvedValueOnce({ aboutMe: 'PJ-123' } as never)
    .mockResolvedValueOnce({} as never)
    .mockRejectedValueOnce(new Error('nope'))
  expect(await aboutMe('acc')).toBe('PJ-123')
  expect(await aboutMe('acc')).toBe('')
  expect(await aboutMe('acc')).toBeNull()
})

const def = (id: number, over: Record<string, unknown> = {}) => ({
  trophyId: id,
  trophyName: `Troféu ${id}`,
  trophyDetail: `Detalhe ${id}`,
  trophyType: 'bronze',
  trophyIconUrl: `t${id}.png`,
  trophyHidden: false,
  ...over,
})

test('title trophies merge pt-BR and English names with what the player earned', async () => {
  const defs = spyOn(api, 'getTitleTrophies').mockImplementation((async (
    _a: unknown,
    _np: string,
    _g: string,
    opts: { headerOverrides: { 'Accept-Language': string } },
  ) =>
    opts.headerOverrides['Accept-Language'] === 'pt-BR'
      ? {
          trophies: [
            def(1, { trophyGroupId: '001' }),
            def(2, { trophyProgressTargetValue: '10' }),
            def(3, { trophyName: undefined, trophyDetail: undefined }),
          ],
        }
      : { trophies: [def(1, { trophyName: 'Trophy 1', trophyDetail: 'Detail 1' })] }) as never)
  const earned = spyOn(api, 'getUserTrophiesEarnedForTitle').mockResolvedValue({
    trophies: [
      {
        trophyId: 1,
        earned: true,
        earnedDateTime: '2026-01-01',
        trophyRare: 0,
        trophyEarnedRate: '1.5',
      },
      { trophyId: 2, earned: false, progress: '3', progressRate: '30', trophyRare: 2 },
    ],
  } as never)
  const list = await titleTrophies(makeTitle({ platform: 'PS5', npCommunicationId: 'NPT' }), 'acc')
  expect(defs.mock.calls[0][3]).toMatchObject({ npServiceName: 'trophy2' })
  expect(earned.mock.calls[0].slice(1)).toEqual(['acc', 'NPT', 'all', { npServiceName: 'trophy2' }])
  expect(list[0]).toEqual({
    iconUrl: 't1.png',
    hidden: false,
    groupId: '001',
    progressTarget: undefined,
    progressValue: undefined,
    progressRate: undefined,
    id: 1,
    name: 'Troféu 1',
    detail: 'Detalhe 1',
    nameEn: 'Trophy 1',
    detailEn: 'Detail 1',
    type: 'bronze',
    rarity: 'Ultra rara',
    rarityTier: 0,
    earnedRate: 1.5,
    earned: true,
    earnedAt: '2026-01-01',
  })
  expect(list[1]).toMatchObject({
    groupId: 'default',
    progressTarget: 10,
    progressValue: 3,
    progressRate: 30,
    rarity: 'Rara',
    nameEn: 'Troféu 2',
    earned: false,
  })
  expect(list[2]).toMatchObject({
    name: '',
    detail: '',
    nameEn: '',
    rarity: 'Comum',
    earnedRate: 0,
  })
})

test('PS4 titles read their trophies from the old service', async () => {
  const defs = spyOn(api, 'getTitleTrophies').mockResolvedValue({ trophies: [] } as never)
  spyOn(api, 'getUserTrophiesEarnedForTitle').mockResolvedValue({ trophies: [] } as never)
  expect(await titleTrophies(makeTitle({ platform: 'PS4' }), 'acc')).toEqual([])
  expect(defs.mock.calls[0][3]).toMatchObject({ npServiceName: 'trophy' })
})

test('a catalog list prefers PS5 and falls back to the PS4 service', async () => {
  const defs = spyOn(api, 'getTitleTrophies').mockImplementation((async (
    _a: unknown,
    np: string,
    _g: string,
    opts: { npServiceName: string; headerOverrides: { 'Accept-Language': string } },
  ) => {
    if (np === 'NPCAT4' && opts.npServiceName === 'trophy2') throw new Error('not found')
    if (np === 'NPCATNONE') return { trophies: [] }
    const en = opts.headerOverrides['Accept-Language'] === 'en-US'
    return { trophies: [def(1, en ? { trophyName: 'One' } : {})] }
  }) as never)
  const ps4 = await catalogTrophies(['NPCAT4'])
  expect(ps4?.platform).toBe('PS4')
  expect(ps4?.trophies[0]).toMatchObject({ name: 'Troféu 1', nameEn: 'One', earned: false })
  const best = await catalogTrophies(['NPCAT4', 'NPCAT5', 'NPCATLATE'])
  expect(best).toMatchObject({ np: 'NPCAT5', platform: 'PS5' })
  expect(defs.mock.calls.some((c) => c[1] === 'NPCATLATE')).toBe(false)
  expect(await catalogTrophies(['NPCATNONE'])).toBeNull()
})

test('a cached catalog list is not fetched again', async () => {
  const defs = spyOn(api, 'getTitleTrophies').mockResolvedValue({ trophies: [def(1)] } as never)
  await catalogTrophies(['NPCACHED'])
  const calls = defs.mock.calls.length
  await catalogTrophies(['NPCACHED'])
  expect(defs.mock.calls.length).toBe(calls)
})

test('the profile summary picks the largest avatar', async () => {
  spyOn(api, 'getUserTrophyProfileSummary').mockResolvedValue({
    trophyLevel: '321',
    progress: 45,
    earnedTrophies: counts(100, 20, 5, 2 as 1),
  } as never)
  spyOn(api, 'getProfileFromAccountId').mockResolvedValue({
    onlineId: 'Player',
    avatars: [
      { size: 's', url: 's.png' },
      { size: 'xl', url: 'xl.png' },
    ],
  } as never)
  expect(await profileSummary('acc')).toEqual({
    onlineId: 'Player',
    avatarUrl: 'xl.png',
    level: 321,
    levelProgress: 45,
    earned: counts(100, 20, 5, 2 as 1),
  })
})

test('the profile summary falls back to the online id given', async () => {
  spyOn(api, 'getUserTrophyProfileSummary').mockResolvedValue({
    trophyLevel: '1',
    progress: 0,
    earnedTrophies: counts(),
  } as never)
  spyOn(api, 'getProfileFromAccountId').mockResolvedValue({ avatars: [] } as never)
  expect(await profileSummary('acc', 'Given')).toMatchObject({
    onlineId: 'Given',
    avatarUrl: undefined,
  })
  expect((await profileSummary('acc')).onlineId).toBe('')
})

test('groups split the base game from every DLC', async () => {
  spyOn(api, 'getTitleTrophyGroups').mockResolvedValue({
    trophyGroups: [
      { trophyGroupId: 'default', trophyGroupName: 'Base', definedTrophies: counts(10, 3, 1, 1) },
      { trophyGroupId: '001', trophyGroupName: 'DLC 1', definedTrophies: counts(4, 1) },
      { trophyGroupId: '002', trophyGroupName: 'DLC 2', definedTrophies: counts(2, 0, 1) },
    ],
  } as never)
  spyOn(api, 'getUserTrophyGroupEarningsForTitle').mockResolvedValue({
    trophyGroups: [
      { trophyGroupId: 'default', earnedTrophies: counts(5, 1) },
      { trophyGroupId: '001', earnedTrophies: counts(4, 1) },
    ],
  } as never)
  expect(await titleGroups(makeTitle({ platform: 'PS5' }), 'acc')).toEqual({
    base: {
      earned: 6,
      total: 15,
      remaining: 8,
      earnedByType: counts(5, 1),
      definedByType: counts(10, 3, 1, 1),
    },
    dlc: {
      earned: 5,
      total: 8,
      remaining: 3,
      earnedByType: counts(4, 1),
      definedByType: counts(6, 1, 1),
    },
    dlcNames: ['DLC 1', 'DLC 2'],
  })
})

test('a title without DLC has no DLC group', async () => {
  spyOn(api, 'getTitleTrophyGroups').mockResolvedValue({
    trophyGroups: [{ trophyGroupId: 'x', trophyGroupName: 'Only', definedTrophies: counts(5) }],
  } as never)
  spyOn(api, 'getUserTrophyGroupEarningsForTitle').mockResolvedValue({ trophyGroups: [] } as never)
  const groups = await titleGroups(makeTitle(), 'acc')
  expect(groups.dlc).toBeNull()
  expect(groups.base).toMatchObject({ earned: 0, total: 5, remaining: 5 })
})

const played = (name: string, over: Record<string, unknown> = {}) => ({
  titleId: `T-${name}`,
  name,
  category: 'ps5_native_game',
  playDuration: 'PT28H57M42S',
  playCount: 3,
  firstPlayedDateTime: '2026-01-01',
  lastPlayedDateTime: '2026-02-01',
  ...over,
})

test('played games are paged, parsed and limited to games', async () => {
  const pages = spyOn(api, 'getUserPlayedGames')
    .mockResolvedValueOnce({
      titles: [played('A'), played('App', { category: 'unknown' })],
      totalItemCount: 3,
    } as never)
    .mockResolvedValueOnce({
      titles: [
        played('B', {
          category: 'ps4_game',
          playDuration: 'P1DT2M',
          firstPlayedDateTime: undefined,
          lastPlayedDateTime: undefined,
        }),
        played('C', { playDuration: 'bogus' }),
      ],
      totalItemCount: 3,
    } as never)
  const games = await playedGames('acc')
  expect(pages.mock.calls.map((c) => c[2])).toEqual([
    { limit: 200, offset: 0 },
    { limit: 200, offset: 200 },
  ])
  expect(games).toEqual([
    {
      titleId: 'T-A',
      name: 'A',
      platform: 'PS5',
      seconds: 28 * 3600 + 57 * 60 + 42,
      playCount: 3,
      firstPlayed: '2026-01-01',
      lastPlayed: '2026-02-01',
    },
    {
      titleId: 'T-B',
      name: 'B',
      platform: 'PS4',
      seconds: 86400 + 120,
      playCount: 3,
      firstPlayed: null,
      lastPlayed: null,
    },
    expect.objectContaining({ name: 'C', seconds: 0 }),
  ])
})

test('hidden played games read as none, other failures propagate', async () => {
  spyOn(api, 'getUserPlayedGames')
    .mockRejectedValueOnce(new Error('Games are hidden'))
    .mockRejectedValueOnce(new Error('boom'))
  expect(await playedGames('acc')).toEqual([])
  await expect(playedGames('acc')).rejects.toThrow('boom')
})

test('an empty page ends the listing', async () => {
  spyOn(api, 'getUserPlayedGames').mockResolvedValue({ titles: [], totalItemCount: 50 } as never)
  expect(await playedGames('acc')).toEqual([])
})

test('now playing is the open game, or null when offline, hidden or failing', async () => {
  const presence = spyOn(api, 'getBasicPresence').mockResolvedValue({
    basicPresence: { gameTitleInfoList: [{ titleName: 'DAYS GONE' }] },
  } as never)
  expect(await nowPlaying('acc')).toBe('DAYS GONE')
  presence.mockResolvedValue({ basicPresence: {} } as never)
  expect(await nowPlaying('acc')).toBeNull()
  presence.mockResolvedValue({ error: { code: 2240526, message: 'Not permitted' } } as never)
  expect(await nowPlaying('acc')).toBeNull()
  presence.mockRejectedValue(new Error('down'))
  expect(await nowPlaying('acc')).toBeNull()
})
