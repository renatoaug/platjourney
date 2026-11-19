/** In place of an action that needs an account, for someone reading a public page: the way to make one. */
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Icon } from '../ui/icon'

const messages = defineMessages({
  [Language.PtBR]: {
    save: 'Crie sua conta para salvar',
    request: 'Crie sua conta para pedir este jogo',
  },
  [Language.En]: {
    save: 'Create your account to save',
    request: 'Create your account to ask for this game',
  },
})

/** Where the sign-in screen is: any address that is not a public page. */
export const SIGN_IN = '/'

/** True when nobody is signed in: someone reading a public page. */
export const useVisitor = (): boolean => useApp().me.visitor === true

export function JoinLink({
  why = 'save',
  className = 'button',
}: {
  /** What the account would let them do here. */
  why?: 'save' | 'request'
  className?: string
}) {
  const t = useMessages(messages)
  return (
    <Link className={className} to={SIGN_IN}>
      <Icon name="user" /> {t(why)}
    </Link>
  )
}
