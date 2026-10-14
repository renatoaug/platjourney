import { existsSync, readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname } from 'node:path'
import { clientIp, noteAccess } from './access.ts'
import {
  AuthError,
  accountStatus,
  authenticate,
  changePassword,
  claimCookie,
  claimSecretFrom,
  deleteAccount,
  demoSession,
  finishClaim,
  login,
  logout,
  MIN_PASSWORD,
  newLinkCode,
  register,
  sessionCookie,
  startClaim,
} from './auth.ts'
import { browseGuides } from './browse.ts'
import { config } from './config.ts'
import { tagged } from './costs.ts'
import { deepGuideStats, ensureDeepGuide } from './deepguide.ts'
import { DemoReadOnly, isDemo, storedSummary, trophiesFor } from './demo.ts'
import { ensureGuide, GUIDE_VERSION, type Guide } from './guide.ts'
import { BadBody, json, PAGE_POLICY, readBody, SECURITY_HEADERS } from './http.ts'
import {
  defineMessages,
  fromAcceptLanguage,
  isLocale,
  Language,
  type Locale,
  type MessageKey,
  translator,
  userLocale,
} from './i18n.ts'
import { handleInterestCommand, storeFor, yearProgress } from './interests.ts'
import { library, ownedGames } from './library.ts'
import { reply, trophyHelp } from './nexo.ts'
import { nextPick } from './next-pick.ts'
import { currentPlan, discardPlan, planSession } from './planner.ts'
import { hours, playtimes } from './playtime.ts'
import { pluginRoute, Refused } from './plugins.ts'
import { profilePage } from './profile.ts'
import { catalogTrophies, PrivateProfile, profileSummary, secureUrl, titleTrophies } from './psn.ts'
import { loadGroups, rankNextPlatinum } from './ranking.ts'
import { allow } from './rate-limit.ts'
import { dismissRecommendation, readPrefs, recommendations } from './recommend.ts'
import { RELEASES_AFTER_DAYS, RELEASES_BEFORE_DAYS } from './releases.ts'
import {
  chatThreads,
  markNotificationsRead,
  notificationsPage,
  recentMessages,
  recentTips,
  tipsBefore,
  unreadNotifications,
} from './repository/activity.ts'
import {
  catalogGameForName,
  type Game,
  gameByName,
  gameForTitle,
  getGame,
  releasesBetween,
  searchCatalog,
} from './repository/game.ts'
import { requestMissingGame } from './repository/game-request.ts'
import { getGuide } from './repository/guide.ts'
import { requestGuide } from './repository/guide-request.ts'
import { isDismissReason } from './repository/recommendation.ts'
import { listServerStatuses } from './repository/server-status.ts'
import { setLinkCode, type User, updateUser } from './repository/user.ts'
import { botInfo, botUsername } from './telegram.ts'
import {
  chatOrCheck,
  demoContext,
  forgetUser,
  getChat,
  getCurrent,
  setChat,
  setChatFromCatalog,
  watchNow,
} from './watcher.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    invalidPsnId: 'PSN ID inválido.',
    psnNotFound: 'Não achamos esse PSN ID. Por favor, confere se digitou certo.',
    weakPassword: 'A senha precisa ter pelo menos {min} caracteres.',
    taken: 'Esse PSN ID já tem conta. Entre com a senha.',
    wrongPassword: 'Senha incorreta.',
    tooManyAttempts: 'Muitas tentativas. Espere 15 minutos ou recupere o acesso.',
    tooManyRequests: 'Muitos pedidos seguidos. Espere um minuto e tente de novo.',
    confirmationMismatch: 'O PSN ID digitado não confere.',
    trophiesPrivate:
      'Seus troféus estão privados na PSN. Deixe "Troféus" visível para "Qualquer pessoa" nas configurações de privacidade e tente de novo.',
    noPendingVerification: 'O código expirou. Comece de novo.',
    codeNotFound:
      'Ainda não encontramos o código no seu "Sobre mim". Salve o perfil na PSN e tente de novo em alguns segundos.',
    profilePrivate:
      'Não conseguimos ler seu perfil. Deixe o perfil visível para "Todos" nas configurações de privacidade da PSN.',
    fillPasswords: 'Preencha as senhas.',
    currentPasswordMismatch: 'A senha atual não confere.',
    pickCatalogGame: 'Selecione um jogo do catálogo.',
    invalidLocale: 'Idioma inválido.',
    demoReadOnly:
      'Isto é uma demonstração: dá para ver tudo, mas nada é salvo. Conecte sua conta da PSN para usar de verdade.',
    demoUnavailable: 'A demonstração não está disponível neste servidor.',
  },
  [Language.En]: {
    invalidPsnId: 'Invalid PSN ID.',
    psnNotFound: "We couldn't find this PSN ID. Please check the spelling.",
    weakPassword: 'The password needs at least {min} characters.',
    taken: 'This PSN ID already has an account. Sign in with the password.',
    wrongPassword: 'Wrong password.',
    tooManyAttempts: 'Too many attempts. Wait 15 minutes or recover access.',
    tooManyRequests: 'Too many requests in a row. Wait a minute and try again.',
    confirmationMismatch: "The PSN ID you typed doesn't match.",
    trophiesPrivate:
      'Your trophies are private on PSN. Set "Trophies" to "Anyone" in the privacy settings and try again.',
    noPendingVerification: 'The code has expired. Start over.',
    codeNotFound:
      'We haven\'t found the code in your "About me" yet. Save the profile on PSN and try again in a few seconds.',
    profilePrivate:
      'We couldn\'t read your profile. Make the profile visible to "Anyone" in the PSN privacy settings.',
    fillPasswords: 'Fill in the passwords.',
    currentPasswordMismatch: "The current password doesn't match.",
    pickCatalogGame: 'Pick a game from the catalog.',
    invalidLocale: 'Invalid language.',
    demoReadOnly:
      'This is a demo: you can look at everything, but nothing is saved. Connect your PSN account to use it for real.',
    demoUnavailable: 'The demo is not available on this server.',
  },
})

// The built web app (bun run build). Hashed assets under /assets never change, so they cache for good.
const PUBLIC_DIR = new URL('../../web/dist/', import.meta.url)
// Set by `bun run dev`: pages come from the Vite dev server instead of the build.
const DEV_WEB = process.env.WEB_DEV_URL
const STATIC_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  // The install manifest: without its type the app shell would be served in its place.
  '.webmanifest': 'application/manifest+json',
}

const summaries = new Map<
  string,
  { at: number; data: Awaited<ReturnType<typeof profileSummary>> }
>()
async function profile(user: User) {
  const cached = summaries.get(user.id)
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.data
  const data = isDemo(user)
    ? storedSummary(user, await library(user.psn_account_id))
    : await profileSummary(user.psn_account_id, user.psn_online_id)
  summaries.set(user.id, { at: Date.now(), data })
  return data
}

// Game rows carry their embedding (1536 numbers); the browser never needs it.

// What the browser may know about the signed-in user.
const publicUser = (u: User) => ({
  id: u.id,
  onlineId: u.psn_online_id,
  // Avatars saved before PSN's were moved to https still say http.
  avatarUrl: secureUrl(u.avatar_url),
  telegramLinked: !!u.telegram_chat_id,
  includeDlcProgress: u.include_dlc_progress === true,
  psPlus: u.ps_plus ?? 'none',
  aiNotices: u.ai_notices !== false,
  // Whether this instance lets Nexo write notices at all; the profile's switch only shows then.
  aiNoticesAvailable: config.automatic.notices,
  locale: u.locale ?? null,
  demo: isDemo(u),
  // The demo never stores it: each visitor's browser remembers the introduction instead.
  onboarded: !isDemo(u) && !!u.onboarded_at,
})

// The account screen also names the Telegram bot the player is connected to.
const accountUser = async (u: User) => ({
  ...publicUser(u),
  telegramBot: u.telegram_chat_id ? await botInfo().catch(() => null) : null,
})

// The deep guide's numbers come from the AI service, which the demo never calls.
const deepGuideOf = (user: User, game: Game) =>
  isDemo(user) ? Promise.resolve(null) : deepGuideStats(game)

// The hero's background: the game's wide picture from the catalog (a 16:9 screenshot). Without one,
// a PS5 trophy list's own art, which is large but of any shape; PS4, PS3 and Vita lists only have a
// small icon that blurs when stretched, so for those the cover at 1080p is the last resort.
export function heroArt(
  game: Pick<Game, 'cover_url' | 'art_url'>,
  title?: { platform: string; iconUrl?: string | null },
) {
  if (game.art_url) return game.art_url
  if (title?.iconUrl && title.platform.includes('PS5')) return title.iconUrl
  const cover = game.cover_url?.replace('/t_cover_big/', '/t_1080p/')
  return cover ?? title?.iconUrl ?? null
}

async function currentView(user: User, ctx = getCurrent(user)) {
  return (
    ctx && {
      deepGuide: await deepGuideOf(user, ctx.game),
      game: ctx.game,
      name: ctx.title.name,
      platform: ctx.title.platform,
      icon: heroArt(ctx.game, ctx.title),
      progress: ctx.title.progress,
      earned: ctx.title.earned,
      total: ctx.title.total,
      np: ctx.title.npCommunicationId,
      // False for a game outside the library, chosen in the chat to talk about before buying.
      owned: ctx.owned !== false,
      groups: ctx.groups,
      hoursPlayed: ctx.hoursPlayed ?? null,
      guide: ctx.guide,
      // No guide and nothing researching it: it waits in guide_request.
      queued: !ctx.guide && !config.automatic.research,
      trophies: ctx.trophies,
    }
  )
}

// Guide research takes a minute; the page polls while one of these is in flight.
const building = new Map<string, Promise<Guide>>()
// Researching a guide searches the web with a paid model: a few at a time for the whole
// instance, and a daily number per player. Past either, the game waits on the list of guides
// to write, like it does with automatic research off.
const MAX_BUILDING = 3
const RESEARCH_PER_DAY = 10
const researched = new Map<string, { day: string; count: number }>()

/** For tests: forgets today's research counts. */
export const forgetResearch = () => researched.clear()

function mayResearch(user: User): boolean {
  if (building.size >= MAX_BUILDING) return false
  const day = new Date().toISOString().slice(0, 10)
  const seen = researched.get(user.id)
  const count = seen?.day === day ? seen.count : 0
  if (count >= RESEARCH_PER_DAY) return false
  researched.set(user.id, { day, count: count + 1 })
  return true
}
async function guideOrBuild(
  user: User,
  game: Game,
  build: () => Promise<Guide>,
): Promise<{ guide: Guide | null; queued: boolean }> {
  const cached = await getGuide<Guide>(game.id)
  // The demo shows the guides it has and never asks for one.
  if (isDemo(user)) return { guide: cached ?? null, queued: false }
  if (cached && (cached.version ?? 1) >= GUIDE_VERSION) return { guide: cached, queued: false }
  // Without automatic research an older guide is still better than none, and a missing one
  // is listed for whoever runs the instance.
  if (!config.automatic.research) {
    if (!cached) await requestGuide(game.id)
    return { guide: cached ?? null, queued: !cached }
  }
  if (!building.has(game.id)) {
    if (!mayResearch(user)) {
      if (!cached) await requestGuide(game.id)
      return { guide: cached ?? null, queued: !cached }
    }
    const job = build().finally(() => building.delete(game.id))
    job.catch((e) => console.error('guide failed:', (e as Error).message))
    building.set(game.id, job)
  }
  return { guide: null, queued: false }
}

// Detail for one catalog game: with PSN progress when the player owns it.
async function titleDetail(url: URL, user: User) {
  const gameParam = url.searchParams.get('game')
  const np = url.searchParams.get('id')
  const name = url.searchParams.get('name')
  const platform = url.searchParams.get('platform') ?? 'PS5'

  let game: Game | undefined
  if (gameParam) game = await getGame(gameParam)
  // A name the catalog does not know would be looked up on IGDB and stored; the demo only reads.
  else if (name)
    game = isDemo(user) ? await gameByName(name) : await catalogGameForName(name, platform)
  const titles = await library(user.psn_account_id)
  const owned = titles.filter((t) =>
    np ? t.npCommunicationId === np : game?.np_communication_ids.includes(t.npCommunicationId),
  )
  // Prefer the copy with the most progress (PS5 over PS4 when equal).
  const title = owned.sort(
    (a, b) => b.progress - a.progress || (b.platform.includes('PS5') ? 1 : -1),
  )[0]
  if (!game && title) game = await gameForTitle(title)
  if (!game) return null
  const found: Game = game

  if (title) {
    const [trophies, groups] = await Promise.all([
      trophiesFor(title, user),
      loadGroups(title, user),
    ])
    const { guide, queued } = await guideOrBuild(user, found, () =>
      ensureGuide(found, trophies, { name: title.name, platform: title.platform }),
    )
    if (guide && !isDemo(user))
      ensureDeepGuide(found, title.total).catch((e) =>
        console.error('deep guide failed:', (e as Error).message),
      )
    return {
      owned: true,
      np: title.npCommunicationId,
      deepGuide: await deepGuideOf(user, found),
      hoursPlayed: hours((await playtimes(user)).get(found.id)),
      game: found,
      name: found.name,
      platform: title.platform,
      icon: heroArt(found, title),
      cover: found.cover_url,
      progress: title.progress,
      earned: title.earned,
      total: title.total,
      groups,
      trophies,
      guide,
      building: !guide && !queued && !isDemo(user),
      queued,
    }
  }
  // The demo only has the trophy lists of the games in its library.
  const list =
    found.np_communication_ids.length && !isDemo(user)
      ? await catalogTrophies(found.np_communication_ids)
      : null
  const { guide, queued } = await guideOrBuild(user, found, () =>
    ensureGuide(
      found,
      list?.trophies,
      list ? { name: found.name, platform: list.platform } : undefined,
    ),
  )
  if (guide && !isDemo(user))
    ensureDeepGuide(found).catch((e) => console.error('deep guide failed:', (e as Error).message))
  return {
    owned: false,
    trophies: list?.trophies ?? null,
    deepGuide: await deepGuideOf(user, found),
    game: found,
    name: found.name,
    platform: found.platforms.find((p) => p === 'PS5') ?? found.platforms[0] ?? platform,
    icon: heroArt(found),
    cover: found.cover_url,
    // Not in the library yet: where to buy it, and its sale when known.
    store: await storeFor(found, user),
    guide,
    building: !guide && !queued && !isDemo(user),
    queued,
  }
}

const AUTH_MESSAGES: Record<AuthError['code'], [number, MessageKey<typeof messages>]> = {
  psn_not_found: [404, 'psnNotFound'],
  weak_password: [400, 'weakPassword'],
  taken: [409, 'taken'],
  wrong_password: [401, 'wrongPassword'],
  too_many_attempts: [429, 'tooManyAttempts'],
  confirmation_mismatch: [400, 'confirmationMismatch'],
  trophies_private: [422, 'trophiesPrivate'],
  no_pending_verification: [409, 'noPendingVerification'],
  code_not_found: [422, 'codeNotFound'],
  profile_private: [422, 'profilePrivate'],
}

// The page sends the language it is showing; without it, the player's saved one, then pt-BR.
const requestLocale = (req: IncomingMessage, user?: User | null): Locale =>
  fromAcceptLanguage(req.headers['accept-language']) ?? userLocale(user)

const validId = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{3,16}$/.test(v.trim())

async function authRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  method: string,
): Promise<boolean> {
  if (!path.startsWith('/api/auth/') || method !== 'POST') return false
  // Each of these asks PSN or opens a session: a loop from one address is cut short, so it can
  // neither wear out the instance's PSN account nor fill the database with demo sessions.
  const ip = clientIp(req) ?? ''
  const demo = path === '/api/auth/demo'
  if (!allow(`${demo ? 'demo' : 'auth'}|${ip}`, demo ? 5 : 30, 60_000)) {
    json(res, 429, {
      error: 'too_many_requests',
      message: translator(messages, requestLocale(req))('tooManyRequests'),
    })
    return true
  }
  if (path === '/api/auth/logout') {
    await logout(req)
    json(res, 200, { ok: true }, { 'set-cookie': sessionCookie(null) })
    return true
  }
  if (path === '/api/auth/demo') {
    const session = await demoSession()
    if (!session) {
      json(res, 404, {
        error: 'demo_unavailable',
        message: translator(messages, requestLocale(req))('demoUnavailable'),
      })
      return true
    }
    watchNow(session.user)
    json(
      res,
      200,
      { user: publicUser(session.user) },
      { 'set-cookie': sessionCookie(session.token) },
    )
    return true
  }
  const { onlineId, password, fresh } = await readBody(req)
  if (!validId(onlineId)) {
    json(res, 400, {
      error: 'invalid_psn_id',
      message: translator(messages, requestLocale(req))('invalidPsnId'),
    })
    return true
  }
  const signIn = ({ user, token }: { user: User; token: string }) => {
    watchNow(user)
    json(res, 200, { user: publicUser(user) }, { 'set-cookie': sessionCookie(token) })
  }
  const secret = typeof password === 'string' ? password : ''
  switch (path) {
    case '/api/auth/lookup':
      json(res, 200, await accountStatus(onlineId))
      return true
    case '/api/auth/register': {
      // A new account keeps the language the page was showing.
      const session = await register(onlineId, secret)
      if (!session.user.locale) {
        session.user.locale = requestLocale(req)
        await updateUser(session.user.id, { locale: session.user.locale })
      }
      signIn(session)
      return true
    }
    case '/api/auth/login':
      signIn(await login(onlineId, secret, ip))
      return true
    case '/api/auth/claim': {
      const { secret: claimSecret, ...claim } = await startClaim(onlineId, claimSecretFrom(req))
      json(
        res,
        200,
        { ...claim, skipVerification: config.auth.skipVerification },
        { 'set-cookie': claimCookie(claimSecret) },
      )
      return true
    }
    case '/api/auth/claim/finish': {
      const { user, token } = await finishClaim(
        onlineId,
        secret,
        fresh === true,
        claimSecretFrom(req),
      )
      watchNow(user)
      json(
        res,
        200,
        { user: publicUser(user) },
        { 'set-cookie': [sessionCookie(token), claimCookie(null)] },
      )
      return true
    }
    default:
      return false
  }
}

// The demo player is shared by everyone who opens it, so it only reads. Writes the page makes on its
// own get a harmless answer: marking notices read or the introduction seen does nothing, and a
// language picked on the page applies to that page without being saved. Anything else that writes,
// or that would call PSN or the model, is refused with demo_read_only. True when the request was
// answered here.
async function demoAnswered(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  method: string,
  me: User,
): Promise<boolean> {
  const path = url.pathname
  const refresh = path === '/api/recommendations' && url.searchParams.get('refresh') === '1'
  if (method === 'GET' && !refresh) return false
  if (
    (path === '/api/notifications/read' || path === '/api/account/onboarded') &&
    method === 'POST'
  ) {
    json(res, 200, { ok: true })
    return true
  }
  if (path === '/api/account/preferences' && method === 'POST') {
    const { includeDlcProgress, locale } = await readBody(req)
    if (includeDlcProgress === undefined && isLocale(locale)) {
      json(res, 200, { user: await accountUser({ ...me, locale }) })
      return true
    }
  }
  throw new DemoReadOnly()
}

async function api(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  method: string,
  me: User,
): Promise<void> {
  const path = url.pathname
  const titles = () => library(me.psn_account_id)
  const t = translator(messages, requestLocale(req, me))
  if (isDemo(me) && (await demoAnswered(req, res, url, method, me))) return

  if (path === '/api/me' && method === 'GET') return json(res, 200, { user: await accountUser(me) })

  if (path === '/api/account/preferences' && method === 'POST') {
    // Any of the preferences, alone or together: DLC, Nexo's notices and the language.
    const { includeDlcProgress, aiNotices, locale, psPlus } = await readBody(req)
    const fields: Partial<User> = {}
    if (typeof includeDlcProgress === 'boolean') fields.include_dlc_progress = includeDlcProgress
    if (psPlus !== undefined) {
      const tiers = ['none', 'essential', 'extra', 'deluxe'] as const
      const tier = tiers.find((x) => x === psPlus)
      if (!tier) return json(res, 400, { error: 'invalid' })
      fields.ps_plus = tier
    }
    if (typeof aiNotices === 'boolean') fields.ai_notices = aiNotices
    if (locale !== undefined) {
      if (!isLocale(locale))
        return json(res, 400, { error: 'invalid_locale', message: t('invalidLocale') })
      fields.locale = locale
    }
    if (!Object.keys(fields).length) return json(res, 400, { error: 'invalid' })
    await updateUser(me.id, fields)
    return json(res, 200, { user: await accountUser({ ...me, ...fields }) })
  }

  if (path === '/api/account/onboarded' && method === 'POST') {
    await updateUser(me.id, { onboarded_at: new Date() })
    return json(res, 200, { ok: true })
  }
  if (path === '/api/account/password' && method === 'POST') {
    const { current, next } = await readBody(req)
    if (typeof current !== 'string' || typeof next !== 'string')
      return json(res, 400, { error: 'invalid', message: t('fillPasswords') })
    try {
      await changePassword(req, me, current, next)
    } catch (e) {
      // A wrong current password must not look like an expired session to the page.
      if (e instanceof AuthError && e.code === 'wrong_password')
        return json(res, 400, {
          error: 'wrong_password',
          message: t('currentPasswordMismatch'),
        })
      throw e
    }
    return json(res, 200, { ok: true })
  }
  if (path === '/api/account' && method === 'DELETE') {
    const { onlineId } = await readBody(req)
    await deleteAccount(me, typeof onlineId === 'string' ? onlineId : '')
    forgetUser(me.id)
    summaries.delete(me.id)
    return json(res, 200, { ok: true }, { 'set-cookie': sessionCookie(null) })
  }
  if (path === '/api/telegram/link' && method === 'POST') {
    // Clicking twice (or in two tabs) must not invalidate a link still valid.
    const valid =
      me.telegram_link_code &&
      me.telegram_link_expires_at &&
      new Date(me.telegram_link_expires_at).getTime() > Date.now() + 60_000
    const code = valid ? (me.telegram_link_code as string) : newLinkCode()
    if (!valid) await setLinkCode(me.id, code)
    return json(res, 200, { url: `https://t.me/${await botUsername()}?start=${code}` })
  }
  if (path === '/api/telegram/link' && method === 'DELETE') {
    await updateUser(me.id, { telegram_chat_id: null, telegram_link_code: null })
    return json(res, 200, { ok: true })
  }

  if (path === '/api/state' && method === 'GET') {
    const list = await titles()
    const played = await playtimes(me)
    // The demo's context comes from the database at once; a real player's waits for PSN.
    const ctx = getCurrent(me) ?? (isDemo(me) ? await demoContext(me) : undefined)
    if (!ctx) watchNow(me)
    const ranked = await rankNextPlatinum(list, me, 20, ctx ? [ctx.title.npCommunicationId] : [])
    return json(res, 200, {
      profile: await profile(me),
      // null, not missing: the web app reads a missing game as still loading.
      current: (await currentView(me, ctx)) ?? null,
      // The chat's own game when the player picked another one there; null when it is the game played.
      chat:
        getChat(me) && getChat(me) !== ctx ? ((await currentView(me, getChat(me))) ?? null) : null,
      tips: await recentTips(me.id, 50),
      unread: await unreadNotifications(me.id),
      ranking: ranked.map((r) => ({
        game: r.game.id,
        name: r.game.name,
        platform: r.title.platform,
        icon: r.title.iconUrl,
        cover: r.game.cover_url,
        progress: r.baseProgress,
        remaining: r.remaining,
        hours: hours(played.get(r.game.id)),
        total: r.groups?.base.total ?? r.title.total,
        earned: r.groups?.base.earned ?? r.title.earned,
        dlc: r.groups?.dlc ? { earned: r.groups.dlc.earned, total: r.groups.dlc.total } : null,
      })),
      goals: await yearProgress(me, list, undefined, played),
      servers: (await listServerStatuses(ranked.map((r) => r.game.id))).filter(
        (s) => s.status !== 'unknown',
      ),
    })
  }
  if (path === '/api/title' && method === 'GET') {
    const detail = await titleDetail(url, me)
    return detail ? json(res, 200, detail) : json(res, 404, { error: 'title not found' })
  }
  if (path === '/api/profile' && method === 'GET')
    return json(res, 200, {
      ...(await profilePage(await titles(), me)),
      user: await accountUser(me),
    })
  if (path === '/api/plan' && method === 'GET')
    return json(res, 200, { plan: await currentPlan(me, getCurrent(me)) })
  if (path === '/api/plan' && method === 'DELETE') {
    await discardPlan(me)
    return json(res, 200, { plan: null })
  }
  if (path === '/api/plan' && method === 'POST') {
    const { minutes } = await readBody(req)
    const ctx = getCurrent(me)
    if (!ctx) return json(res, 409, { error: 'no current game yet' })
    if (typeof minutes !== 'number' || minutes < 15 || minutes > 600)
      return json(res, 400, { error: 'minutes must be between 15 and 600' })
    return json(res, 200, { plan: await planSession(me, ctx, minutes) })
  }
  if (path === '/api/trophy-tip' && method === 'POST') {
    const { np, trophyId } = await readBody(req)
    if (typeof np !== 'string' || typeof trophyId !== 'number')
      return json(res, 400, { error: 'np and trophyId required' })
    const title = (await titles()).find((t) => t.npCommunicationId === np)
    if (!title) return json(res, 404, { error: 'title not in your library' })
    const [trophies, groups, game] = await Promise.all([
      titleTrophies(title, me.psn_account_id),
      loadGroups(title, me),
      gameForTitle(title),
    ])
    const trophy = trophies.find((t) => t.id === trophyId)
    if (!trophy) return json(res, 404, { error: 'trophy not found' })
    if (trophy.earned) return json(res, 409, { error: 'trophy already earned' })
    const guide = await getGuide<Guide>(game.id)
    const ctx = {
      game,
      title,
      trophies,
      groups,
      guide,
      hoursPlayed: hours((await playtimes(me)).get(game.id)),
    }
    return json(res, 200, { text: await trophyHelp(me, ctx, trophy) })
  }
  if (path === '/api/tips' && method === 'GET') {
    const before = new Date(url.searchParams.get('before') ?? '')
    if (Number.isNaN(before.getTime())) return json(res, 400, { error: 'before' })
    return json(res, 200, await tipsBefore(me.id, before, 30))
  }
  if (path === '/api/notifications' && method === 'GET') {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const size = Math.min(30, Math.max(1, Number(url.searchParams.get('size')) || 8))
    return json(res, 200, { page, size, ...(await notificationsPage(me.id, page, size)) })
  }
  if (path === '/api/notifications/read' && method === 'POST') {
    await markNotificationsRead(me.id)
    return json(res, 200, { ok: true })
  }
  // Each game is its own conversation: `?game=game:…` reads that one, `?game=none` the messages
  // without a game, and no parameter the current game's.
  if (path === '/api/chat' && method === 'GET') {
    const asked = url.searchParams.get('game')
    const game =
      asked === 'none' ? null : asked?.startsWith('game:') ? asked : (getChat(me)?.game.id ?? null)
    return json(res, 200, await recentMessages(me.id, 40, game))
  }
  if (path === '/api/chat/threads' && method === 'GET')
    return json(res, 200, await chatThreads(me.id))
  if (path === '/api/chat' && method === 'POST') {
    const { text } = await readBody(req)
    if (typeof text !== 'string' || !text.trim()) return json(res, 400, { error: 'text required' })
    const ctx = await chatOrCheck(me)
    const response = await reply(me, text.trim().slice(0, config.chat.maxChars), ctx)
    return json(res, 200, {
      text: response,
      messages: await recentMessages(me.id, 40, ctx?.game.id ?? null),
    })
  }
  // The chat's game, as /game in Telegram: the player's own titles, searched by name, and the
  // switch, which loads that game's context for the chat and the notices alike.
  if (path === '/api/library' && method === 'GET') {
    if (isDemo(me)) return json(res, 200, [])
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const current = getChat(me)?.title.npCommunicationId
    const own = await titles()
    const hits = own.filter((ti) => ti.name.toLowerCase().includes(q)).slice(0, 8)
    const mine = hits.map((ti) => ({
      np: ti.npCommunicationId,
      name: ti.name,
      platform: ti.platform,
      icon: ti.iconUrl,
      progress: ti.progress,
      current: ti.npCommunicationId === current,
      owned: true,
    }))
    // Then games outside the library, to talk about one before buying it.
    const owned = new Set(own.map((ti) => ti.npCommunicationId))
    const currentGame = getChat(me)?.game.id
    const others =
      q.length < 2 || mine.length >= 8
        ? []
        : (await searchCatalog(q))
            .filter((g) => g.np_communication_ids?.length)
            .filter((g) => !g.np_communication_ids.some((np) => owned.has(np)))
            .slice(0, 8 - mine.length)
            .map((g) => ({
              game: g.id,
              name: g.name,
              platform: g.platforms?.[0] ?? '',
              icon: g.cover_url ?? null,
              progress: null,
              current: g.id === currentGame,
              owned: false,
            }))
    return json(res, 200, [...mine, ...others])
  }
  if (path === '/api/current' && method === 'POST') {
    if (isDemo(me)) return json(res, 403, { error: 'demo' })
    const { np, game } = await readBody(req)
    const own = await titles()
    // A catalog game the player owns after all is switched to through its title, with progress.
    const found =
      typeof game === 'string' && game.startsWith('game:') ? await getGame(game) : undefined
    const hit = own.find(
      (ti) =>
        ti.npCommunicationId === np || found?.np_communication_ids?.includes(ti.npCommunicationId),
    )
    if (hit)
      return json(res, 200, { current: (await currentView(me, await setChat(me, hit))) ?? null })
    if (!found) return json(res, 404, { error: 'title not found' })
    const ctx = await setChatFromCatalog(me, found)
    if (!ctx) return json(res, 404, { error: 'no trophy list' })
    return json(res, 200, { current: (await currentView(me, ctx)) ?? null })
  }
  if (path === '/api/guides' && method === 'GET') {
    const p = url.searchParams
    return json(
      res,
      200,
      await browseGuides({
        query: p.get('q') ?? undefined,
        platform: p.get('platform') ?? undefined,
        sort: p.get('sort') ?? undefined,
        page: Number(p.get('page')) || 1,
        difficulty: p.get('difficulty') ?? undefined,
        hours: p.get('hours') ?? undefined,
        noMissables: p.get('noMissables') === '1',
        onePlaythrough: p.get('onePlaythrough') === '1',
        noOnline: p.get('noOnline') === '1',
        genre: p.get('genre') ?? undefined,
      }),
    )
  }
  // Releases around today: the last two weeks and the next six, for the home's calendar.
  if (path === '/api/releases' && method === 'GET') {
    const day = 86_400_000
    const now = Date.now()
    return json(
      res,
      200,
      await releasesBetween(
        new Date(now - RELEASES_BEFORE_DAYS * day),
        new Date(now + RELEASES_AFTER_DAYS * day),
      ),
    )
  }
  if (path === '/api/games/search' && method === 'GET') {
    return json(res, 200, await searchCatalog(url.searchParams.get('q') ?? ''))
  }
  // A game the search did not find: IGDB is asked for it, and a game it knows joins the catalog
  // (its page then lists it for a guide). A name IGDB does not know either is kept for whoever
  // runs the instance.
  if (path === '/api/games/request' && method === 'POST') {
    const { name } = await readBody(req)
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100)
      return json(res, 400, { error: 'name required' })
    if (!allow(`game-request|${me.id}`, 5, 60_000))
      return json(res, 429, { error: t('tooManyRequests') })
    const game = await catalogGameForName(name.trim())
    if (game) return json(res, 200, { game: game.id })
    const already = await requestMissingGame(name.trim(), me.id)
    return json(res, 200, { requested: true, already })
  }
  if (path === '/api/goals' && method === 'POST') {
    const { command } = await readBody(req)
    if (typeof command !== 'string') return json(res, 400, { error: 'command required' })
    if (command.startsWith('add ')) {
      // The game's id, without where it was saved from ("add game:12 from:releases").
      const id = command.slice(4).trim().split(/\s+/)[0]
      if (!id.startsWith('game:') || !(await getGame(id)))
        return json(res, 400, { error: t('pickCatalogGame') })
    }
    await handleInterestCommand(me, command, await titles())
    return json(res, 200, await yearProgress(me, await titles(), undefined, await playtimes(me)))
  }
  if (path === '/api/interests/next' && method === 'POST') {
    // Model work: Nexo picks which saved game to platinum now.
    return json(res, 200, { pick: await nextPick(me, await titles(), requestLocale(req, me)) })
  }
  if (path === '/api/recommendations/dismiss' && method === 'POST') {
    const { game, reason } = await readBody(req)
    if (typeof game !== 'string' || !game.startsWith('game:'))
      return json(res, 400, { error: 'game required' })
    if (reason !== undefined && !isDismissReason(reason))
      return json(res, 400, { error: 'invalid reason' })
    await dismissRecommendation(me, game, reason)
    return json(
      res,
      200,
      await recommendations(me, await titles(), await ownedGames(me.psn_account_id)),
    )
  }
  if (path === '/api/recommendations/preferences' && method === 'POST') {
    // The player's changes to the taste profile and their rules; the stored batch answers, and a new
    // one (model work) waits for the refresh button.
    const prefs = readPrefs(await readBody(req))
    if (!prefs) return json(res, 400, { error: 'invalid' })
    await updateUser(me.id, { taste_prefs: prefs })
    return json(
      res,
      200,
      await recommendations(
        { ...me, taste_prefs: prefs },
        await titles(),
        await ownedGames(me.psn_account_id),
        false,
        true,
      ),
    )
  }
  if (path === '/api/recommendations' && method === 'GET') {
    const force = url.searchParams.get('refresh') === '1'
    return json(
      res,
      200,
      await recommendations(me, await titles(), await ownedGames(me.psn_account_id), force),
    )
  }
  json(res, 404, { error: 'not found' })
}

/** The app shell, with the share-preview image as a full URL: link previews (WhatsApp, Telegram)
 * skip a relative one. The address is the one the visitor used, so any instance gets its own. */
function withShareImage(req: IncomingMessage, file: URL): string {
  const html = readFileSync(file, 'utf8')
  const host = req.headers.host
  // A Host header is client data: only a plain host name (and port) goes into the page.
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return html
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
  return html.replace('content="/og.png"', `content="${proto}://${host}/og.png"`)
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// The request's Origin, when it has one, names this same host.
function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  const method = req.method ?? 'GET'

  if (path.startsWith('/api/')) {
    // A browser always says where a request comes from; a change asked by another site's page
    // is refused. Server-to-server calls (a payment provider's webhook) send no Origin.
    if (!READ_METHODS.has(method) && !sameOrigin(req))
      return json(res, 403, { error: 'cross_origin' })
    // Plugin routes (/api/ext/…) answer only their own method; public ones, like a payment
    // provider's webhook, skip sign-in.
    const ext = pluginRoute(path)
    if (ext && ext.method !== method)
      return json(res, 405, { error: 'method_not_allowed' }, { allow: ext.method })
    if (ext?.public) return ext.handler({ req, res, url, method })
    if (await authRoutes(req, res, path, method)) return
    const me = await authenticate(req)
    if (!me) return json(res, 401, { error: 'unauthenticated' })
    noteAccess(req, me).catch((e) => console.warn('access not noted:', (e as Error).message))
    const tag = isDemo(me) ? { user: me.id, demo: true } : { user: me.id }
    if (ext) {
      // The demo account is shared: like the app's own routes, plugin routes only read for it.
      if (isDemo(me) && ext.method !== 'GET') throw new DemoReadOnly()
      return tagged(tag, () => ext.handler({ req, res, url, method, me }))
    }
    return tagged(tag, () => api(req, res, url, method, me))
  }
  if (method === 'GET' && DEV_WEB) {
    // Development: the page comes from Vite, which rebuilds on save; /api stays here.
    const r = await fetch(new URL(req.url ?? '/', DEV_WEB))
    const headers = Object.fromEntries(
      [...r.headers].filter(
        ([k]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(k),
      ),
    )
    res.writeHead(r.status, headers).end(Buffer.from(await r.arrayBuffer()))
    return
  }
  if (method === 'GET') {
    // Static files from the built app; anything unknown falls back to the app shell (hash routing).
    const file = path === '/' ? 'index.html' : path.slice(1)
    const safe = !file.includes('..') && STATIC_TYPES[extname(file)]
    const target = new URL(safe ? file : 'index.html', PUBLIC_DIR)
    if (existsSync(target)) {
      const type = STATIC_TYPES[extname(target.pathname)] ?? STATIC_TYPES['.html']
      res
        .writeHead(200, {
          'content-type': type,
          'cache-control': path.startsWith('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
          ...SECURITY_HEADERS,
          ...(type === STATIC_TYPES['.html'] ? { 'content-security-policy': PAGE_POLICY } : {}),
          ...(config.auth.secureCookie
            ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' }
            : {}),
        })
        .end(
          target.pathname.endsWith('/index.html')
            ? withShareImage(req, target)
            : readFileSync(target),
        )
      return
    }
  }
  res.writeHead(404).end('not found')
}

export function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return route(req, res).catch(async (e) => {
    if (res.headersSent) return
    const locale = requestLocale(req)
    if (e instanceof AuthError) {
      const [status, key] = AUTH_MESSAGES[e.code]
      return json(res, status, {
        error: e.code,
        message: translator(messages, locale)(key, { min: MIN_PASSWORD }),
      })
    }
    if (e instanceof PrivateProfile)
      return json(res, 409, {
        error: 'trophies_private',
        message: translator(messages, locale)('trophiesPrivate'),
      })
    if (e instanceof DemoReadOnly)
      return json(res, 403, {
        error: 'demo_read_only',
        message: translator(messages, locale)('demoReadOnly'),
      })
    if (e instanceof Refused) return json(res, e.status, { error: e.code, message: e.message })
    if (e instanceof BadBody)
      return json(res, e.status, { error: e.status === 413 ? 'body_too_large' : 'bad_json' })
    console.error('web failed:', (e as Error).message)
    json(res, 500, { error: 'internal error' })
  })
}

export function startWeb(): void {
  createServer((req, res) => {
    handle(req, res)
  }).listen(config.port, () => console.log(`web: http://localhost:${config.port}`))
}
