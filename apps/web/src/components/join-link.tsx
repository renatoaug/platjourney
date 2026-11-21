/** In place of an action that needs an account, for someone reading a public page: the way to make one. */
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { useSignInHref } from '../app/visitor'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Icon } from '../ui/icon'

const messages = defineMessages({
  [Language.PtBR]: {
    save: 'Conectar minha PSN',
    request: 'Crie sua conta para pedir este jogo',
  },
  [Language.En]: {
    save: 'Connect my PSN',
    request: 'Create your account to ask for this game',
  },
})

/** True when nobody is signed in: someone reading a public page. */
export const useVisitor = (): boolean => useApp().me.visitor === true

export function JoinLink({
  why = 'save',
  className = 'button',
}: {
  /** What the account would let them do here. Saving a game says only "connect my PSN", the
   * same words as the journey's card: short enough for one line beside the store button. */
  why?: 'save' | 'request'
  className?: string
}) {
  const t = useMessages(messages)
  return (
    <Link className={className} to={useSignInHref()}>
      <Icon name="arrow-right" /> {t(why)}
    </Link>
  )
}
