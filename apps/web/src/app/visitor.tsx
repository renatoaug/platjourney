/** Someone without an account: the same app, reading what is public (guides, games, the community,
 * profiles), with the way in where the account would be. What needs an account asks for one. */
import { Link, useLocation } from 'react-router'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import type { Me } from '../lib/types'
import { Icon } from '../ui/icon'
import { EmptyState } from '../ui/states'
import { Page } from './page'
import './visitor.css'

const messages = defineMessages({
  [Language.PtBR]: {
    signIn: 'Entrar',
    join: 'Criar conta',
    accountTitle: 'Sua jornada começa aqui',
    accountBody: 'Conecte sua PSN para acompanhar suas platinas.',
    promptTitle: 'Isto é da sua conta',
    promptBody:
      'Conecte sua PSN e o PlatJourney acompanha cada platina sua: o próximo troféu, o que é perdível, suas metas e o Nexo para tirar dúvidas.',
    guides: 'Ver os guias',
  },
  [Language.En]: {
    signIn: 'Sign in',
    join: 'Sign up',
    accountTitle: 'Your journey starts here',
    accountBody: 'Connect your PSN to follow your platinums.',
    promptTitle: 'This is part of your account',
    promptBody:
      'Connect your PSN and PlatJourney follows every platinum of yours: the next trophy, what is missable, your goals and Nexo to answer questions.',
    guides: 'Browse the guides',
  },
})

/** Nobody signed in. Read only like the demo, so every action that writes stays closed. */
export const VISITOR: Me = {
  id: '',
  onlineId: '',
  telegramLinked: false,
  includeDlcProgress: false,
  onboarded: true,
  demo: true,
  visitor: true,
}

/** The sign-in screen, coming back to `from` once signed in. */
const signInHref = (from: string) =>
  from === '/' || from.startsWith('/entrar')
    ? '/entrar'
    : `/entrar?next=${encodeURIComponent(from)}`

/** Where the sign-in screen sends the player back: a page of this app, else the home. */
export function nextAfterSignIn(search: string): string {
  const next = new URLSearchParams(search).get('next') ?? '/'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

/** The sign-in screen, coming back to the page on screen. */
export function useSignInHref() {
  const { pathname, search } = useLocation()
  return signInHref(pathname + search)
}

/** At the end of the top bar: the way in. A phone keeps only "Sign in". */
export function VisitorActions() {
  const t = useMessages(messages)
  const href = useSignInHref()
  return (
    <div className="visitor-actions">
      <Link className="button secondary sm" to={href} id="visitor-sign-in">
        {t('signIn')}
      </Link>
      <Link className="button sm visitor-join" to={href} id="visitor-join">
        {t('join')}
      </Link>
    </div>
  )
}

/** Where the player's card sits at the end of the menu. */
export function VisitorAccount() {
  const t = useMessages(messages)
  const href = useSignInHref()
  return (
    <div className="visitor-account" id="visitor-account">
      <b>{t('accountTitle')}</b>
      <small>{t('accountBody')}</small>
      <Link className="button sm" to={href}>
        {t('signIn')}
      </Link>
    </div>
  )
}

/** A screen that needs an account, opened without one. */
export function SignInPrompt({ path }: { path: string }) {
  const t = useMessages(messages)
  const href = useSignInHref()
  return (
    <Page path={path}>
      <EmptyState
        className="visitor-prompt"
        icon="trophy"
        title={t('promptTitle')}
        action={
          <span className="visitor-prompt-actions">
            <Link className="button" to={href}>
              {t('signIn')}
            </Link>
            <Link className="button secondary" to="/guides">
              <Icon name="book-open" /> {t('guides')}
            </Link>
          </span>
        }
      >
        {t('promptBody')}
      </EmptyState>
    </Page>
  )
}
