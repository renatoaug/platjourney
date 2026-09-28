import { existsSync, readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname } from 'node:path'
import { noteAccess } from './access.ts'
import {
  AuthError,
  accountStatus,
  authenticate,
  changePassword,
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
import { json, readBody } from './http.ts'
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
import { handleInterestCommand, yearProgress } from './interests.ts'
import { library, ownedGames } from './library.ts'
import { reply, trophyHelp } from './nexo.ts'
import { currentPlan, discardPlan, planSession } from './planner.ts'
import { hours, playtimes } from './playtime.ts'
import { pluginRoute, Refused } from './plugins.ts'
import { profilePage } from './profile.ts'
import { catalogTrophies, PrivateProfile, profileSummary, titleTrophies } from './psn.ts'
import { loadGroups, rankNextPlatinum } from './ranking.ts'
import { dismissRecommendation, recommendations } from './recommend.ts'
import {
  markNotificationsRead,
  notificationsPage,
  recentMessages,
  recentTips,
  unreadNotifications,
} from './repository/activity.ts'
import {
  type Game,
  gameByName,
  gameForName,
  gameForTitle,
  getGame,
  searchCatalog,
} from './repository/game.ts'
import { getGuide } from './repository/guide.ts'
import { requestGuide } from './repository/guide-request.ts'
import { isDismissReason } from './repository/recommendation.ts'
import { listServerStatuses } from './repository/server-status.ts'
import { type User, updateUser } from './repository/user.ts'
import { botInfo, botUsername } from './telegram.ts'
import { demoContext, forgetUser, getCurrent, watchNow } from './watcher.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    invalidPsnId: 'PSN ID inválido.',
    psnNotFound: 'Não achamos esse PSN ID. Por favor, confere se digitou certo.',
    weakPassword: 'A senha precisa ter pelo menos {min} caracteres.',
    taken: 'Esse PSN ID já tem conta. Entre com a senha.',
    wrongPassword: 'Senha incorreta.',
    tooManyAttempts: 'Muitas tentativas. Espere 15 minutos ou recupere o acesso.',
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
  avatarUrl: u.avatar_url,
  telegramLinked: !!u.telegram_chat_id,
  includeDlcProgress: u.include_dlc_progress === true,
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
  else if (name) game = isDemo(user) ? await gameByName(name) : await gameForName(name, platform)
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
      signIn(await login(onlineId, secret))
      return true
    case '/api/auth/claim':
      json(res, 200, {
        ...(await startClaim(onlineId)),
        skipVerification: config.auth.skipVerification,
      })
      return true
    case '/api/auth/claim/finish':
      signIn(await finishClaim(onlineId, secret, fresh === true))
      return true
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
    const { includeDlcProgress, aiNotices, locale } = await readBody(req)
    const fields: Partial<User> = {}
    if (typeof includeDlcProgress === 'boolean') fields.include_dlc_progress = includeDlcProgress
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
    // Clicking twice (or in two tabs) must not invalidate the link already opened.
    const code = me.telegram_link_code ?? newLinkCode()
    if (!me.telegram_link_code) await updateUser(me.id, { telegram_link_code: code })
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
  if (path === '/api/notifications' && method === 'GET') {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const size = Math.min(30, Math.max(1, Number(url.searchParams.get('size')) || 8))
    return json(res, 200, { page, size, ...(await notificationsPage(me.id, page, size)) })
  }
  if (path === '/api/notifications/read' && method === 'POST') {
    await markNotificationsRead(me.id)
    return json(res, 200, { ok: true })
  }
  if (path === '/api/chat' && method === 'GET')
    return json(res, 200, await recentMessages(me.id, 40))
  if (path === '/api/chat' && method === 'POST') {
    const { text } = await readBody(req)
    if (typeof text !== 'string' || !text.trim()) return json(res, 400, { error: 'text required' })
    const response = await reply(me, text.trim().slice(0, config.chat.maxChars), getCurrent(me))
    return json(res, 200, { text: response, messages: await recentMessages(me.id, 40) })
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
      }),
    )
  }
  if (path === '/api/games/search' && method === 'GET') {
    return json(res, 200, await searchCatalog(url.searchParams.get('q') ?? ''))
  }
  if (path === '/api/goals' && method === 'POST') {
    const { command } = await readBody(req)
    if (typeof command !== 'string') return json(res, 400, { error: 'command required' })
    if (command.startsWith('add ')) {
      const id = command.slice(4).trim()
      if (!id.startsWith('game:') || !(await getGame(id)))
        return json(res, 400, { error: t('pickCatalogGame') })
    }
    await handleInterestCommand(me, command, await titles())
    return json(res, 200, await yearProgress(me, await titles(), undefined, await playtimes(me)))
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

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  const method = req.method ?? 'GET'

  if (path.startsWith('/api/')) {
    // Plugin routes (/api/ext/…): public ones, like a payment provider's webhook, skip sign-in.
    const ext = pluginRoute(path)
    if (ext?.public) return ext.handler({ req, res, url, method })
    if (await authRoutes(req, res, path, method)) return
    const me = await authenticate(req)
    if (!me) return json(res, 401, { error: 'unauthenticated' })
    noteAccess(req, me).catch((e) => console.warn('access not noted:', (e as Error).message))
    const tag = isDemo(me) ? { user: me.id, demo: true } : { user: me.id }
    if (ext) return tagged(tag, () => ext.handler({ req, res, url, method, me }))
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
        })
        .end(readFileSync(target))
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
    console.error('web failed:', (e as Error).message)
    json(res, 500, { error: 'internal error' })
  })
}

export function startWeb(): void {
  createServer((req, res) => {
    handle(req, res)
  }).listen(config.port, () => console.log(`web: http://localhost:${config.port}`))
}
