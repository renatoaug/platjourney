import type { Locale } from '../i18n/locale'
/** Shapes of the /api payloads the screens share. Screen-specific payloads are typed next to their screen. */

export type TrophyType = 'bronze' | 'silver' | 'gold' | 'platinum'
export type ByType = Record<TrophyType, number>

export interface Me {
  id: string
  onlineId: string
  avatarUrl?: string
  telegramLinked: boolean
  includeDlcProgress: boolean
  /** The PS Plus tier the player says they have. */
  psPlus?: 'none' | 'essential' | 'extra' | 'deluxe'
  /** Nexo writes this player's automatic notices; off, they are plain and free. */
  aiNotices?: boolean
  /** Whether this instance lets Nexo write notices at all. */
  aiNoticesAvailable?: boolean
  /** The language the player chose; null until they pick one. */
  locale?: Locale | null
  telegramBot?: { username: string; name: string } | null
  /** The shared, read-only demo player. */
  demo?: boolean
  /** The first-visit introduction was finished or skipped (always false for the demo). */
  onboarded?: boolean
}

/** Where a game was saved to the interests from. */
export type InterestSource = 'releases' | 'recommendations' | 'title' | 'search'

/** A catalog game (IGDB row). */
export interface Game {
  id: string
  name: string
  slug?: string
  cover_url?: string
  /** A wide artwork of the game, for backgrounds. */
  art_url?: string | null
  summary?: string
  genres?: string[]
  themes?: string[]
  modes?: string[]
  platforms?: string[]
  rating?: number
  release_year?: number
  aliases?: string[]
  igdb_id?: number
  np_communication_ids?: string[]
  /** IGDB image ids of the game's scenes, for the gallery. */
  screenshot_ids?: string[]
  developers?: string[]
  website?: string | null
  released_at?: string | null
}

export interface ProfileSummary {
  onlineId: string
  avatarUrl?: string
  level: number
  levelProgress: number
  earned: ByType
}

export interface Trophy {
  id: number
  name: string
  detail: string
  nameEn?: string
  detailEn?: string
  iconUrl?: string
  hidden?: boolean
  groupId: string
  type: TrophyType
  /** PSN's label in pt-BR (what the model reads); the page shows `rarityTier` in its own language. */
  rarity?: string
  /** 0 ultra rare, 1 very rare, 2 rare, 3 common. */
  rarityTier?: number
  earnedRate?: number
  earned: boolean
  earnedAt?: string
  progressTarget?: number | null
  progressValue?: number | null
  progressRate?: number | null
}

export interface ProgressGroup {
  earned: number
  total: number
  remaining?: number
  definedByType?: ByType
  earnedByType?: ByType
}

export interface KeyTrophy {
  trophy: string
  why: string
}

/** A platinum guide as the API sends it. */
export interface GuideDetail {
  version?: number
  overview: string
  difficulty: number
  hours: number
  playthroughs: number
  hasMissables: boolean
  hasOnline: boolean
  earlyTips: string[]
  missables: { trophy: string; how: string; when: string }[]
  onlineTrophies: { trophy: string; what: string; boostable: boolean }[]
  easiest?: KeyTrophy | null
  hardest?: KeyTrophy | null
  mostTedious?: KeyTrophy | null
  tricks?: { trophy: string; trick: string; source?: string | null }[]
  buggy?: {
    trophy: string
    issue: string
    workaround?: string | null
    reported?: string | null
    status?: string | null
  }[]
  roadmap: { phase: string; goal: string; trophies: string[] }[]
  glossary: { term: string; meaning: string }[]
  collectibles?: string | null
  pointOfNoReturn?: string | null
  autopop?: string | null
  difficultyTrophy?: string | null
  postgame?: string | null
  unobtainable?: string | null
  sources: string[]
}

export interface DeepGuideStats {
  chunks: number
  sources: { source: string; url: string }[]
  indexing: boolean
  indexedAt?: string
}

/** The game being played now, as /api/state and /api/title send it. */
export interface CurrentGame {
  game: Game
  name: string
  platform: string
  icon?: string
  progress: number
  earned: number
  total: number
  np: string
  /** False for a game outside the library, picked in the chat to talk about before buying. */
  owned?: boolean
  groups?: { base: ProgressGroup; dlc?: ProgressGroup | null; dlcNames?: string[] } | null
  guide?: GuideDetail | null
  deepGuide?: DeepGuideStats | null
  trophies: Trophy[]
  hoursPlayed?: number | null
  /** No guide and nothing researching it: it waits to be written. */
  queued?: boolean
}

export interface Tip {
  id: string
  kind: string
  content: string
  created_at: string
  game?: Game | null
  tip?: string
  read?: boolean
}

export interface RankingItem {
  game: string
  name: string
  platform: string
  icon?: string
  cover?: string
  progress: number
  remaining: number
  hours?: number
  total: number
  earned: number
  dlc: { earned: number; total: number } | null
}

export interface Interest {
  id: string
  game: Game
  position: number
  /** Null for a game never started. */
  progress: number | null
  hours?: number | null
  done: boolean
  /** When Nexo recommended it, for a game saved from its recommendations. */
  recommendedAt?: string | null
  /** When "Nexo decide" picked it as the next platinum; one interest at a time. */
  nextPickAt?: string | null
  /** Where the player saved it from, and when. */
  source?: InterestSource | null
  savedAt?: string | null
  /** Its PS Store price when on sale or in PS Plus (cents). */
  deal?: {
    price: number
    base: number
    discount: number
    endsAt: string | null
    plus: boolean
    plusPrice?: number | null
    /** The PS Plus tier whose catalog includes the game. */
    plusTier?: 'essential' | 'extra' | 'deluxe' | null
    /** The player's own tier includes it: they play it without paying. */
    mine?: boolean
    currency: string
    storeUrl: string | null
  } | null
}

export interface YearGoals {
  year: number
  target: number
  done: number
  platinumed: { game: Game; at: string; hours?: number }[]
  interests: Interest[]
}

export interface ServerStatus {
  id: string
  game: Game
  status: string
  checked_at: string
  date?: string
  note?: string
}

export interface AppStateData {
  /** Null while PSN has not answered for this player yet. */
  profile: ProfileSummary | null
  current: CurrentGame | null
  /** The chat's own game, when the player picked another one there; the game played stays in current. */
  chat?: CurrentGame | null
  tips: Tip[]
  unread: number
  ranking: RankingItem[]
  goals: YearGoals
  servers: ServerStatus[]
}

/** A game the chat's game switch lists: the player's own titles first (by their PSN list), then
 * catalog games outside the library (by their game id), to talk about one before buying it. */
export interface LibraryGame {
  np?: string
  game?: string
  name: string
  platform: string
  icon: string | null
  progress: number | null
  current: boolean
  /** False for a catalog game the player does not have. */
  owned?: boolean
}
