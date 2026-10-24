import { AuthError, changePassword, deleteAccount, newLinkCode, sessionCookie } from '../auth.ts'
import { isDemo } from '../demo.ts'
import { forgetUser } from '../game-context.ts'
import { json, readBody } from '../http.ts'
import { defineMessages, isLocale, Language, translator } from '../i18n.ts'
import { consentClient, decide } from '../oauth.ts'
import { profilePage } from '../profile.ts'
import { pushEnabled, pushTo } from '../push.ts'
import { connectionsOf, deleteConnection } from '../repository/oauth.ts'
import { deletePushSubscription, savePushSubscription } from '../repository/push-subscription.ts'
import { setLinkCode, type User, updateUser } from '../repository/user.ts'
import { botUsername } from '../telegram.ts'
import { type Api, type ApiHandler, accountUser } from './api.ts'
import { forgetSummary } from './home.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    fillPasswords: 'Preencha as senhas.',
    currentPasswordMismatch: 'A senha atual não confere.',
    invalidLocale: 'Idioma inválido.',
    pushTest: 'Tudo certo: os avisos do Nexo vão chegar aqui.',
  },
  [Language.En]: {
    fillPasswords: 'Fill in the passwords.',
    currentPasswordMismatch: "The current password doesn't match.",
    invalidLocale: 'Invalid language.',
    pushTest: "All set: Nexo's notices will arrive here.",
  },
})

// Any of the preferences, alone or together: DLC, Nexo's notices, Telegram notices and the language.
async function savePreferences({ req, res, me, locale: language }: Api) {
  const t = translator(messages, language)
  const { includeDlcProgress, aiNotices, notifyTelegram, locale, psPlus } = await readBody(req)
  const fields: Partial<User> = {}
  if (typeof includeDlcProgress === 'boolean') fields.include_dlc_progress = includeDlcProgress
  if (psPlus !== undefined) {
    const tiers = ['none', 'essential', 'extra', 'deluxe'] as const
    const tier = tiers.find((x) => x === psPlus)
    if (!tier) return json(res, 400, { error: 'invalid' })
    fields.ps_plus = tier
  }
  if (typeof aiNotices === 'boolean') fields.ai_notices = aiNotices
  if (typeof notifyTelegram === 'boolean') fields.notify_telegram = notifyTelegram
  if (locale !== undefined) {
    if (!isLocale(locale))
      return json(res, 400, { error: 'invalid_locale', message: t('invalidLocale') })
    fields.locale = locale
  }
  if (!Object.keys(fields).length) return json(res, 400, { error: 'invalid' })
  await updateUser(me.id, fields)
  return json(res, 200, { user: await accountUser({ ...me, ...fields }) })
}

// A device turns push on: the browser's subscription, with the keys that encrypt for it.
async function savePush({ req, res, me }: Api) {
  if (!pushEnabled()) return json(res, 404, { error: 'push_off' })
  const { endpoint, keys } = await readBody(req)
  const { p256dh, auth } = (keys ?? {}) as Record<string, unknown>
  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    typeof p256dh !== 'string' ||
    typeof auth !== 'string'
  )
    return json(res, 400, { error: 'invalid' })
  await savePushSubscription(me.id, { endpoint, p256dh, auth })
  return json(res, 200, { ok: true })
}

async function dropPush({ req, res, me }: Api) {
  const { endpoint } = await readBody(req)
  if (typeof endpoint !== 'string') return json(res, 400, { error: 'invalid' })
  await deletePushSubscription(endpoint, me.id)
  return json(res, 200, { ok: true })
}

// A test notice to every device of the player, so they see it works.
async function testPush({ res, me, locale }: Api) {
  const t = translator(messages, locale)
  const sent = await pushTo(me, { title: 'Nexo', body: t('pushTest'), url: '/history' })
  return json(res, 200, { sent })
}

async function savePassword({ req, res, me, locale }: Api) {
  const t = translator(messages, locale)
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

async function telegramLink({ res, me }: Api) {
  // Clicking twice (or in two tabs) must not invalidate a link still valid.
  const valid =
    me.telegram_link_code &&
    me.telegram_link_expires_at &&
    new Date(me.telegram_link_expires_at).getTime() > Date.now() + 60_000
  const code = valid ? (me.telegram_link_code as string) : newLinkCode()
  if (!valid) await setLinkCode(me.id, code)
  return json(res, 200, { url: `https://t.me/${await botUsername()}?start=${code}` })
}

// The consent page: which assistant asks, before the player allows it.
async function consentInfo({ res, url }: Api) {
  const client = await consentClient({
    clientId: url.searchParams.get('client_id') ?? '',
    redirectUri: url.searchParams.get('redirect_uri') ?? '',
  })
  if (!client) return json(res, 404, { error: 'unknown_client' })
  return json(res, 200, {
    name: client.name,
    redirectHost: new URL(url.searchParams.get('redirect_uri') ?? '').host,
  })
}

async function consent({ req, res, me }: Api) {
  const { clientId, redirectUri, challenge, state, allow: allowed } = await readBody(req)
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const redirect = await decide(
    me,
    {
      clientId: str(clientId),
      redirectUri: str(redirectUri),
      challenge: str(challenge),
      state: typeof state === 'string' ? state : null,
    },
    allowed === true,
  )
  if (!redirect) return json(res, 400, { error: 'invalid_request' })
  return json(res, 200, { redirect })
}

// The assistants the player connected. The demo account is shared, so its list stays empty.
async function connections({ res, me }: Api) {
  return json(res, 200, { connections: isDemo(me) ? [] : await connectionsOf(me.id) })
}

async function disconnect({ req, res, me }: Api) {
  const { id } = await readBody(req)
  if (
    typeof id !== 'string' ||
    !id.startsWith('oauth_token:') ||
    !(await deleteConnection(me.id, id))
  )
    return json(res, 404, { error: 'not found' })
  return json(res, 200, { connections: await connectionsOf(me.id) })
}

// The account and settings screens: preferences, password, push, Telegram and the connected assistants.
export const ACCOUNT_ROUTES: Record<string, ApiHandler> = {
  'GET /api/me': async ({ res, me }) => json(res, 200, { user: await accountUser(me) }),
  'POST /api/account/preferences': savePreferences,
  'POST /api/account/onboarded': async ({ res, me }) => {
    await updateUser(me.id, { onboarded_at: new Date() })
    return json(res, 200, { ok: true })
  },
  'POST /api/account/password': savePassword,
  'DELETE /api/account': async ({ req, res, me }) => {
    const { onlineId } = await readBody(req)
    await deleteAccount(me, typeof onlineId === 'string' ? onlineId : '')
    forgetUser(me.id)
    forgetSummary(me.id)
    return json(res, 200, { ok: true }, { 'set-cookie': sessionCookie(null) })
  },
  'GET /api/profile': async ({ res, me, titles }) =>
    json(res, 200, {
      ...(await profilePage(await titles(), me)),
      user: await accountUser(me),
    }),
  'GET /api/oauth/client': consentInfo,
  'POST /api/oauth/authorize': consent,
  'GET /api/connections': connections,
  'DELETE /api/connections': disconnect,
  'POST /api/push/subscription': savePush,
  'DELETE /api/push/subscription': dropPush,
  'POST /api/push/test': testPush,
  'POST /api/telegram/link': telegramLink,
  'DELETE /api/telegram/link': async ({ res, me }) => {
    await updateUser(me.id, { telegram_chat_id: null, telegram_link_code: null })
    return json(res, 200, { ok: true })
  },
}
