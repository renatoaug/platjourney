/** Above the interests: one quiet line that sends the player to Discover, where Nexo picks which saved
 * game to platinum now (with their mood, if they say it). */
import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import { Icon } from '../../ui/icon'
import './next-pick.css'

const messages = defineMessages({
  [Language.PtBR]: {
    hint: 'Não sabe qual pegar agora?',
    ask: 'Deixa o Nexo escolher',
  },
  [Language.En]: {
    hint: 'Not sure which one to go for now?',
    ask: 'Let Nexo pick',
  },
})

export function NextPickLink() {
  const t = useMessages(messages)
  return (
    <div className="next-pick-ask">
      <img className="next-pick-nexo" src="/nexo-avatar.svg" alt="" />
      <span>{t('hint')}</span>
      <Link className="next-pick-go" to="/discover?scope=interests">
        {t('ask')} <Icon name="arrow-right" />
      </Link>
    </div>
  )
}
