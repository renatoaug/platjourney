// The community's answers from the server (routes/community.ts), and the calls that change it.
import { api } from './api'

export type ReactionKind = 'like' | 'gg' | 'fire' | 'wow' | 'skull'
export const REACTIONS: ReactionKind[] = ['like', 'gg', 'fire', 'wow', 'skull']

export type MedalKind = 'rare_hunter' | 'quick_platinum' | 'no_day_off' | 'year_goal'

export interface CommunityGame {
  np: string
  name: string
  iconUrl: string | null
  id: string | null
  /** The catalog's box art and wide art, when the catalog knows the game. */
  coverUrl?: string | null
  artUrl?: string | null
}

export interface Reactions {
  counts: Record<ReactionKind, number>
  mine: ReactionKind[]
}

export type CommunityEvent = {
  key: string
  user: string
  at: string
  game: CommunityGame | null
  reactions: Reactions
} & (
  | { kind: 'platinum'; rate: number }
  | { kind: 'rare'; trophy: string; trophyEn: string; type?: string; rate: number }
  | { kind: 'start' }
  | { kind: 'medal'; medal: MedalKind }
)

export interface Person {
  id: string
  onlineId: string
  avatarUrl: string | null
}

export type FeedScope = 'all' | 'following' | 'me'

export interface FeedPage {
  events: CommunityEvent[]
  people: Record<string, Person>
  following: string[]
  next: string | null
  visible: boolean
}

export interface RankRow {
  user: string
  value: number
  game?: CommunityGame | null
}

export type Board = 'platinums' | 'rare' | 'fastest'

export interface Rankings {
  platinums: RankRow[]
  rare: RankRow[]
  fastest: RankRow[]
  /** The reader's own place on each board, wherever it falls; none when not on it. */
  mine?: Record<Board, (RankRow & { place: number }) | null>
  people: Record<string, Person>
  me: string
}

interface GameCount {
  game: CommunityGame
  players: number
}

export interface CommunityGames {
  playing: GameCount[]
  platinumed: GameCount[]
  wanted: { game: string; name: string; coverUrl: string | null; players: number }[]
}

export const fetchFeed = (scope: FeedScope, before?: string | null) =>
  api<FeedPage>(
    `/api/community/feed?scope=${scope}${before ? `&before=${encodeURIComponent(before)}` : ''}`,
  )

export const fetchRankings = (period: 'month' | 'year') =>
  api<Rankings>(`/api/community/rankings?period=${period}`)

export const fetchCommunityGames = () => api<CommunityGames>('/api/community/games')

export const react = (event: string, kind: ReactionKind, on: boolean) =>
  api<Reactions>('/api/community/react', { event, kind, on })

export const follow = (user: string, on: boolean) =>
  api<{ following: string[] }>('/api/community/follow', { user, on })

/** A game's page in the app: its catalog page when the catalog knows it. */
export const gameLink = (game: CommunityGame | null) =>
  game?.id ? `/title/game/${encodeURIComponent(game.id.replace(/^game:/, ''))}` : null

/** The PSN rarity tier of a share of players: under 5% ultra rare, under 15% very rare, under 50%
 * rare, otherwise common. */
export type RarityTier = 'ultra' | 'very' | 'rare' | 'common'
export const rarityTier = (rate: number): RarityTier =>
  rate < 5 ? 'ultra' : rate < 15 ? 'very' : rate < 50 ? 'rare' : 'common'

/** A player's profile, opened from their name in the community. */
export const playerLink = (onlineId: string) => `/profiles/${encodeURIComponent(onlineId)}`
