import type { GameContext } from '../src/nexo.ts'
import type { TitleGroups, TitleProgress, TrophyStatus } from '../src/psn.ts'
import type { Game } from '../src/repository/game.ts'
import type { User } from '../src/repository/user.ts'

type Counts = TitleProgress['earnedByType']

export const counts = (bronze = 0, silver = 0, gold = 0, platinum: 0 | 1 = 0): Counts => ({
  bronze,
  silver,
  gold,
  platinum,
})

export const makeUser = (over: Partial<User> = {}): User => ({
  id: 'user:u1',
  psn_online_id: 'Player',
  psn_account_id: 'acc1',
  password_hash: null,
  avatar_url: null,
  telegram_chat_id: null,
  telegram_link_code: null,
  goal_targets: {},
  taste_profile: null,
  play_session: null,
  session_plan: null,
  created_at: '2026-01-01T00:00:00.000Z',
  last_seen_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

export const makeTitle = (over: Partial<TitleProgress> = {}): TitleProgress => ({
  npCommunicationId: 'NPWR1_00',
  name: 'Days Gone',
  platform: 'PS4',
  iconUrl: 'icon.png',
  progress: 50,
  earned: 10,
  total: 20,
  earnedByType: counts(8, 1, 1),
  definedByType: counts(15, 3, 1, 1),
  lastUpdated: '2026-05-01T10:00:00.000Z',
  ...over,
})

export const makeGame = (over: Partial<Game> = {}): Game => ({
  id: 'game:1',
  name: 'Days Gone',
  slug: 'days-gone',
  aliases: [],
  platforms: ['PS4'],
  igdb_id: 1,
  np_communication_ids: ['NPWR1_00'],
  cover_url: null,
  genres: [],
  themes: [],
  modes: [],
  summary: null,
  release_year: 2019,
  rating: 80,
  ...over,
})

export const makeTrophy = (over: Partial<TrophyStatus> = {}): TrophyStatus => ({
  id: 1,
  name: 'Primeiro',
  detail: 'Faça algo',
  nameEn: 'First',
  detailEn: 'Do something',
  type: 'bronze',
  rarity: 'Comum',
  earnedRate: 50,
  earned: false,
  hidden: false,
  groupId: 'default',
  ...over,
})

export const makeGroups = (over: Partial<TitleGroups> = {}): TitleGroups => ({
  base: {
    earned: 5,
    total: 10,
    remaining: 4,
    earnedByType: counts(5),
    definedByType: counts(7, 2, 0, 1),
  },
  dlc: null,
  dlcNames: [],
  ...over,
})

export const makeContext = (over: Partial<GameContext> = {}): GameContext => ({
  game: makeGame(),
  title: makeTitle(),
  trophies: [makeTrophy()],
  ...over,
})
