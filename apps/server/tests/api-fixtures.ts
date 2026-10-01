import type { GameContext } from '../src/nexo.ts'
import type { TitleProgress, TrophyStatus } from '../src/psn.ts'
import type { Game } from '../src/repository/game.ts'
import type { User } from '../src/repository/user.ts'

export const makeUser = (over: Partial<User> = {}): User => ({
  id: 'user:1',
  psn_online_id: 'Kratos',
  psn_account_id: 'acc-1',
  password_hash: null,
  avatar_url: null,
  telegram_chat_id: null,
  telegram_link_code: null,
  goal_targets: {},
  taste_profile: null,
  play_session: null,
  session_plan: null,
  created_at: '2026-01-01T00:00:00Z',
  last_seen_at: '2026-01-01T00:00:00Z',
  ...over,
})

export const makeGame = (over: Partial<Game> = {}): Game => ({
  id: 'game:1',
  name: 'Days Gone',
  slug: 'days-gone',
  aliases: [],
  platforms: ['PS4', 'PS5'],
  igdb_id: null,
  np_communication_ids: ['NPWR1'],
  cover_url: 'cover.png',
  genres: [],
  themes: [],
  modes: [],
  summary: null,
  release_year: null,
  rating: null,
  ...over,
})

const counts = (n: number) => ({ bronze: n, silver: 0, gold: 0, platinum: 0 as const })

export const makeTitle = (over: Partial<TitleProgress> = {}): TitleProgress => ({
  npCommunicationId: 'NPWR1',
  name: 'Days Gone',
  platform: 'PS5',
  iconUrl: 'icon.png',
  progress: 50,
  earned: 5,
  total: 10,
  earnedByType: counts(5),
  definedByType: counts(10),
  lastUpdated: '2026-01-01T00:00:00Z',
  ...over,
})

export const makeTrophy = (over: Partial<TrophyStatus> = {}): TrophyStatus => ({
  id: 1,
  name: 'Leitor',
  detail: 'Leia a carta',
  nameEn: 'Reader',
  detailEn: 'Read the letter',
  type: 'bronze',
  rarity: 'Comum',
  earnedRate: 50,
  earned: false,
  hidden: false,
  groupId: 'default',
  ...over,
})

export const makeContext = (over: Partial<GameContext> = {}): GameContext => ({
  game: makeGame(),
  title: makeTitle(),
  trophies: [makeTrophy()],
  ...over,
})
