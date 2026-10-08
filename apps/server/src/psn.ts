import {
  type AuthTokensResponse,
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getBasicPresence,
  getProfileFromAccountId,
  getProfileFromUserName,
  getTitleTrophies,
  getTitleTrophyGroups,
  getUserPlayedGames,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  getUserTrophyGroupEarningsForTitle,
  getUserTrophyProfileSummary,
  makeUniversalSearch,
  type TrophyCounts,
} from 'psn-api'
import { config } from './config.ts'
import { currentTag } from './costs.ts'

// One service account authenticates; it reads any public profile.
let tokens: AuthTokensResponse | null = null
let expiresAt = 0

async function auth(): Promise<AuthTokensResponse> {
  // A last guard: the demo player has no PSN account, so nothing done for it may reach PSN.
  if (currentTag().demo) throw new Error('psn: not for the demo player')
  const now = Date.now()
  if (tokens && now < expiresAt - 60_000) return tokens
  if (tokens) {
    tokens = await exchangeRefreshTokenForAuthTokens(tokens.refreshToken)
  } else {
    const code = await exchangeNpssoForAccessCode(config.psnNpsso)
    tokens = await exchangeAccessCodeForAuthTokens(code)
  }
  expiresAt = now + tokens.expiresIn * 1000
  return tokens
}

// The player hid their trophies (or games) from everyone; nothing can be read
// until they make them public again.
export class PrivateProfile extends Error {
  constructor() {
    super('trophies are private')
  }
}
const NOT_PERMITTED = 2240526

// PSN answers some reads with 200 and an error body instead of throwing.
function checked<T extends object>(res: T): T {
  const error = (res as { error?: { code?: number; message?: string } }).error
  if (!error) return res
  if (error.code === NOT_PERMITTED) throw new PrivateProfile()
  throw new Error(`psn: ${error.message ?? error.code}`)
}

// Whether the trophy list can be read, checked before an account is created.
export async function trophiesVisible(accountId: string): Promise<boolean> {
  try {
    checked(await getUserTitles(await auth(), accountId, { limit: 1 }))
    return true
  } catch (e) {
    if (e instanceof PrivateProfile) return false
    throw e
  }
}

export interface PsnProfile {
  accountId: string
  onlineId: string
  avatarUrl: string | null
}

// Exact match of a PSN online id (case-insensitive), or null when nobody has it. The search
// leaves out some accounts (the one this server signs in with, new ones not indexed yet), so
// without an exact hit the id is asked for directly.
// Sign-in screens look the same id up several times in a minute; PSN is asked once.
const PROFILE_TTL_MS = 5 * 60_000
const profiles = new Map<string, { at: number; profile: PsnProfile | null }>()

export async function lookupProfile(onlineId: string): Promise<PsnProfile | null> {
  const key = onlineId.toLowerCase()
  const hit = profiles.get(key)
  if (hit && Date.now() - hit.at < PROFILE_TTL_MS) return hit.profile
  const profile = await findProfile(onlineId)
  if (profiles.size > 5_000) profiles.clear()
  profiles.set(key, { at: Date.now(), profile })
  return profile
}

/** For tests: forgets looked-up profiles. */
export const forgetProfiles = () => profiles.clear()

async function findProfile(onlineId: string): Promise<PsnProfile | null> {
  const a = await auth()
  const search = await makeUniversalSearch(a, onlineId, 'SocialAllAccounts')
  const hit = (search.domainResponses[0]?.results ?? []).find(
    (r) => r.socialMetadata.onlineId.toLowerCase() === onlineId.toLowerCase(),
  )
  if (hit)
    return {
      accountId: hit.socialMetadata.accountId,
      onlineId: hit.socialMetadata.onlineId,
      avatarUrl: hit.socialMetadata.avatarUrl ?? null,
    }
  const direct = await getProfileFromUserName(a, onlineId).catch(() => null)
  const p = direct?.profile
  if (!p?.accountId || p.onlineId.toLowerCase() !== onlineId.toLowerCase()) return null
  const avatars = p.avatarUrls ?? []
  return {
    accountId: p.accountId,
    onlineId: p.onlineId,
    avatarUrl:
      (avatars.find((v) => v.size === 'l') ?? avatars[0])?.avatarUrl?.replace(/^http:/, 'https:') ??
      null,
  }
}

// The profile's "About me" text, or null when the profile cannot be read.
export async function aboutMe(accountId: string): Promise<string | null> {
  try {
    const p = await getProfileFromAccountId(await auth(), accountId)
    return p.aboutMe ?? ''
  } catch {
    return null
  }
}

export interface TitleProgress {
  npCommunicationId: string
  name: string
  platform: string
  iconUrl: string
  progress: number
  earned: number
  total: number
  earnedByType: TrophyCounts
  definedByType: TrophyCounts
  lastUpdated: string
}

const sum = (c: TrophyCounts) => c.bronze + c.silver + c.gold + c.platinum

function toProgress(
  t: Awaited<ReturnType<typeof getUserTitles>>['trophyTitles'][number],
): TitleProgress {
  return {
    npCommunicationId: t.npCommunicationId,
    name: t.trophyTitleName,
    platform: t.trophyTitlePlatform,
    iconUrl: t.trophyTitleIconUrl,
    progress: t.progress,
    earned: sum(t.earnedTrophies),
    total: sum(t.definedTrophies),
    earnedByType: t.earnedTrophies,
    definedByType: t.definedTrophies,
    lastUpdated: t.lastUpdatedDateTime,
  }
}

export async function recentTitles(accountId: string, limit = 10): Promise<TitleProgress[]> {
  const { trophyTitles } = checked(await getUserTitles(await auth(), accountId, { limit }))
  return trophyTitles.map(toProgress)
}

// The game the player has open right now, by its name on the console, or null when they are
// offline, not in a game or hide their online status.
export async function nowPlaying(accountId: string): Promise<string | null> {
  try {
    const { basicPresence } = checked(await getBasicPresence(await auth(), accountId))
    return basicPresence?.gameTitleInfoList?.[0]?.titleName ?? null
  } catch {
    return null
  }
}

// Every title on the profile, most recently played first.
export async function allTitles(accountId: string): Promise<TitleProgress[]> {
  const a = await auth()
  const PAGE = 800
  const first = checked(await getUserTitles(a, accountId, { limit: PAGE }))
  const out = first.trophyTitles.map(toProgress)
  // Big libraries span many pages; the rest are fetched a few at a time.
  const offsets: number[] = []
  for (let offset = PAGE; offset < first.totalItemCount; offset += PAGE) offsets.push(offset)
  for (let i = 0; i < offsets.length; i += 4) {
    const pages = await Promise.all(
      offsets
        .slice(i, i + 4)
        .map(async (offset) => checked(await getUserTitles(a, accountId, { limit: PAGE, offset }))),
    )
    for (const page of pages) out.push(...page.trophyTitles.map(toProgress))
  }
  return out
}

export interface TrophyStatus {
  id: number
  name: string
  detail: string
  nameEn: string
  detailEn: string
  type: string
  // PSN's label in pt-BR, what the model reads; pages show rarityTier in the player's language.
  rarity: string
  // 0 ultra rare, 1 very rare, 2 rare, 3 common; absent on a catalog list (no player).
  rarityTier?: number
  earnedRate: number
  earned: boolean
  earnedAt?: string
  iconUrl?: string
  hidden: boolean
  // "default" is the base game; "001", "002"... are DLC groups.
  groupId: string
  // PS5 titles expose per-trophy progress (e.g. 3/10 collectibles) when the game tracks it.
  progressValue?: number
  progressTarget?: number
  progressRate?: number
}

// Present in the PSN payload for PS5 progress-tracked trophies, but not typed by psn-api.
interface ProgressFields {
  progress?: string
  progressRate?: string
}
// The target lives on the title definition, also untyped there.
interface TargetFields {
  trophyProgressTargetValue?: string
}

const rarityLabel = ['Ultra rara', 'Muito rara', 'Rara', 'Comum']

// A screen and the questions on it ask for the same list within seconds; PSN is asked once a minute.
const TROPHIES_TTL_MS = 60_000
const trophyLists = new Map<string, { at: number; list: Promise<TrophyStatus[]> }>()

export function titleTrophies(title: TitleProgress, accountId: string): Promise<TrophyStatus[]> {
  const key = `${accountId}|${title.npCommunicationId}`
  const hit = trophyLists.get(key)
  if (hit && Date.now() - hit.at < TROPHIES_TTL_MS) return hit.list
  const list = fetchTitleTrophies(title, accountId)
  if (trophyLists.size > 5_000) trophyLists.clear()
  trophyLists.set(key, { at: Date.now(), list })
  // A failure is not kept: the next ask tries again.
  list.catch(() => trophyLists.delete(key))
  return list
}

/** For tests: forgets cached trophy lists. */
export const forgetTrophyLists = () => trophyLists.clear()

async function fetchTitleTrophies(
  title: TitleProgress,
  accountId: string,
): Promise<TrophyStatus[]> {
  const a = await auth()
  const npServiceName = title.platform.includes('PS5') ? 'trophy2' : 'trophy'
  // pt-BR names are what the player sees on the console; English ones match the guides.
  const [defs, defsEn, earned] = await Promise.all([
    getTitleTrophies(a, title.npCommunicationId, 'all', {
      npServiceName,
      headerOverrides: { 'Accept-Language': 'pt-BR' },
    }),
    getTitleTrophies(a, title.npCommunicationId, 'all', {
      npServiceName,
      headerOverrides: { 'Accept-Language': 'en-US' },
    }),
    getUserTrophiesEarnedForTitle(a, accountId, title.npCommunicationId, 'all', {
      npServiceName,
    }).then(checked),
  ])
  const earnedById = new Map(earned.trophies.map((t) => [t.trophyId, t]))
  const enById = new Map(defsEn.trophies.map((t) => [t.trophyId, t]))
  return defs.trophies.map((t) => {
    const e = earnedById.get(t.trophyId)
    const en = enById.get(t.trophyId)
    const p = e as (typeof e & ProgressFields) | undefined
    const progressTarget =
      Number((t as typeof t & TargetFields).trophyProgressTargetValue) || undefined
    return {
      iconUrl: t.trophyIconUrl,
      hidden: t.trophyHidden,
      groupId: t.trophyGroupId ?? 'default',
      progressTarget,
      progressValue: progressTarget && p?.progress != null ? Number(p.progress) : undefined,
      progressRate: progressTarget && p?.progressRate != null ? Number(p.progressRate) : undefined,
      id: t.trophyId,
      name: t.trophyName ?? '',
      detail: t.trophyDetail ?? '',
      nameEn: en?.trophyName ?? t.trophyName ?? '',
      detailEn: en?.trophyDetail ?? t.trophyDetail ?? '',
      type: t.trophyType,
      rarity: rarityLabel[Number(e?.trophyRare ?? 3)] ?? '',
      rarityTier: Number(e?.trophyRare ?? 3),
      earnedRate: Number(e?.trophyEarnedRate ?? 0),
      earned: e?.earned ?? false,
      earnedAt: e?.earnedDateTime,
    }
  })
}

// The trophy list of a game the player does not have, from the ids the catalog
// knows. PS5 lists live on trophy2 and older ones on trophy; a PS5 list wins.
// Kept for a day, since the title page polls while its guide is being built.
const listCache = new Map<string, { at: number; list: CatalogTrophies | null }>()
const LIST_TTL = 24 * 60 * 60_000

export interface CatalogTrophies {
  np: string
  platform: 'PS5' | 'PS4'
  trophies: TrophyStatus[]
}

async function listFor(np: string): Promise<CatalogTrophies | null> {
  const a = await auth()
  for (const npServiceName of ['trophy2', 'trophy'] as const) {
    const [defs, defsEn] = await Promise.all(
      (['pt-BR', 'en-US'] as const).map((lang) =>
        getTitleTrophies(a, np, 'all', {
          npServiceName,
          headerOverrides: { 'Accept-Language': lang },
        }).catch(() => null),
      ),
    )
    if (!defs?.trophies?.length) continue
    const enById = new Map((defsEn?.trophies ?? []).map((t) => [t.trophyId, t]))
    return {
      np,
      platform: npServiceName === 'trophy2' ? 'PS5' : 'PS4',
      trophies: defs.trophies.map((t) => {
        const en = enById.get(t.trophyId)
        return {
          iconUrl: t.trophyIconUrl,
          hidden: t.trophyHidden,
          groupId: t.trophyGroupId ?? 'default',
          progressTarget:
            Number((t as typeof t & TargetFields).trophyProgressTargetValue) || undefined,
          id: t.trophyId,
          name: t.trophyName ?? '',
          detail: t.trophyDetail ?? '',
          nameEn: en?.trophyName ?? t.trophyName ?? '',
          detailEn: en?.trophyDetail ?? t.trophyDetail ?? '',
          type: t.trophyType,
          rarity: '',
          earnedRate: 0,
          earned: false,
        }
      }),
    }
  }
  return null
}

export async function catalogTrophies(nps: string[]): Promise<CatalogTrophies | null> {
  let best: CatalogTrophies | null = null
  for (const np of nps) {
    const hit = listCache.get(np)
    const list =
      hit && Date.now() - hit.at < LIST_TTL ? hit.list : await listFor(np).catch(() => null)
    if (!hit || hit.list !== list) listCache.set(np, { at: Date.now(), list })
    if (list && (!best || (list.platform === 'PS5' && best.platform !== 'PS5'))) best = list
    if (best?.platform === 'PS5') break
  }
  return best
}

export interface ProfileSummary {
  onlineId: string
  avatarUrl?: string
  level: number
  levelProgress: number
  earned: TrophyCounts
}

export async function profileSummary(
  accountId: string,
  onlineId?: string,
): Promise<ProfileSummary> {
  const a = await auth()
  const [s, p] = await Promise.all([
    getUserTrophyProfileSummary(a, accountId).then(checked),
    getProfileFromAccountId(a, accountId),
  ])
  const avatar = [...p.avatars].sort((x, y) => Number(y.size === 'xl') - Number(x.size === 'xl'))[0]
  return {
    onlineId: p.onlineId ?? onlineId ?? '',
    avatarUrl: avatar?.url,
    level: Number(s.trophyLevel),
    levelProgress: s.progress,
    earned: s.earnedTrophies,
  }
}

export interface GroupCounts {
  earned: number
  total: number
  // Trophies still missing, not counting the platinum itself.
  remaining: number
  earnedByType: TrophyCounts
  definedByType: TrophyCounts
}

export interface TitleGroups {
  base: GroupCounts
  dlc: GroupCounts | null
  dlcNames: string[]
}

function counts(defined: TrophyCounts, earned: TrophyCounts): GroupCounts {
  const remaining =
    defined.bronze - earned.bronze + (defined.silver - earned.silver) + (defined.gold - earned.gold)
  return {
    earned: sum(earned),
    total: sum(defined),
    remaining,
    earnedByType: earned,
    definedByType: defined,
  }
}

const zero: TrophyCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0 }
const add = (a: TrophyCounts, b: TrophyCounts): TrophyCounts => ({
  bronze: a.bronze + b.bronze,
  silver: a.silver + b.silver,
  gold: a.gold + b.gold,
  platinum: (a.platinum + b.platinum > 0 ? 1 : 0) as TrophyCounts['platinum'],
})

// Splits a title into base game vs DLC so "trophies left for the platinum" only
// counts what the platinum actually requires.
export async function titleGroups(title: TitleProgress, accountId: string): Promise<TitleGroups> {
  const a = await auth()
  const npServiceName = title.platform.includes('PS5') ? 'trophy2' : 'trophy'
  const [defs, earned] = await Promise.all([
    getTitleTrophyGroups(a, title.npCommunicationId, {
      npServiceName,
      headerOverrides: { 'Accept-Language': 'pt-BR' },
    }),
    getUserTrophyGroupEarningsForTitle(a, accountId, title.npCommunicationId, {
      npServiceName,
    }).then(checked),
  ])
  const earnedById = new Map(earned.trophyGroups.map((g) => [g.trophyGroupId, g.earnedTrophies]))
  const base = defs.trophyGroups.find((g) => g.trophyGroupId === 'default') ?? defs.trophyGroups[0]
  const dlcGroups = defs.trophyGroups.filter((g) => g !== base)
  let dlcDefined = zero
  let dlcEarned = zero
  for (const g of dlcGroups) {
    dlcDefined = add(dlcDefined, g.definedTrophies)
    dlcEarned = add(dlcEarned, earnedById.get(g.trophyGroupId) ?? zero)
  }
  return {
    base: counts(base.definedTrophies, earnedById.get(base.trophyGroupId) ?? zero),
    dlc: dlcGroups.length ? counts(dlcDefined, dlcEarned) : null,
    dlcNames: dlcGroups.map((g) => g.trophyGroupName),
  }
}

export interface PlayedGame {
  titleId: string
  name: string
  platform: string
  seconds: number
  playCount: number
  firstPlayed: string | null
  lastPlayed: string | null
}

// "PT28H57M42S" -> seconds
function durationSeconds(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '')
  if (!m) return 0
  const [, d, h, min, sec] = m
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(sec ?? 0)
}

// Every game the account has launched, with total play time.
export async function playedGames(accountId: string): Promise<PlayedGame[]> {
  const a = await auth()
  const out: PlayedGame[] = []
  for (let offset = 0; ; offset += 200) {
    // Games can be hidden while trophies are public; play time is then just unknown.
    const page = await getUserPlayedGames(a, accountId, { limit: 200, offset }).catch(
      (e: Error) => {
        if (/hidden/i.test(e.message)) return null
        throw e
      },
    )
    if (!page) return out
    for (const t of page.titles) {
      if (!t.category.endsWith('_game')) continue
      out.push({
        titleId: t.titleId,
        name: t.name,
        platform: t.category.startsWith('ps5') ? 'PS5' : 'PS4',
        seconds: durationSeconds(t.playDuration),
        playCount: t.playCount,
        firstPlayed: t.firstPlayedDateTime ?? null,
        lastPlayed: t.lastPlayedDateTime ?? null,
      })
    }
    if (offset + page.titles.length >= page.totalItemCount || page.titles.length === 0) break
  }
  return out
}
