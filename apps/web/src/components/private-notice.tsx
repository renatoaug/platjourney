/** Notice shown when the PSN profile keeps trophies private, with the steps to open them. */
import { defineMessages, Language, useMessages } from '../i18n/i18n'

const messages = defineMessages({
  [Language.PtBR]: {
    step1: 'No PS5, abra',
    step1Path: 'Configurações → Usuários e contas → Privacidade',
    step2In: 'Em',
    step2Trophies: 'Troféus',
    step2Choose: ', escolha',
    step2Anyone: 'Qualquer pessoa',
    step2AlsoIn: '(em',
    step2Games: 'Jogos',
    step2Hours: 'também, para as horas jogadas)',
    step3: 'Volte aqui e toque no botão abaixo',
    eyebrow: 'TROFÉUS PRIVADOS',
    title: 'Não conseguimos ver seus troféus',
    body: 'Enquanto a lista estiver privada, o Nexo fica parado. Para liberar:',
    retry: 'Já deixei público',
  },
  [Language.En]: {
    step1: 'On the PS5, open',
    step1Path: 'Settings → Users and Accounts → Privacy',
    step2In: 'Under',
    step2Trophies: 'Trophies',
    step2Choose: ', choose',
    step2Anyone: 'Anyone',
    step2AlsoIn: '(under',
    step2Games: 'Games',
    step2Hours: 'too, for hours played)',
    step3: 'Come back here and tap the button below',
    eyebrow: 'PRIVATE TROPHIES',
    title: 'We cannot see your trophies',
    body: 'While the list is private, Nexo cannot help. To open it:',
    retry: 'I made it public',
  },
})

export function PrivacySteps() {
  const t = useMessages(messages)
  return (
    <ol className="auth-steps">
      <li>
        {t('step1')} <b>{t('step1Path')}</b>
      </li>
      <li>
        {t('step2In')} <b>{t('step2Trophies')}</b>
        {t('step2Choose')} <b>{t('step2Anyone')}</b> {t('step2AlsoIn')} <b>{t('step2Games')}</b>{' '}
        {t('step2Hours')}
      </li>
      <li>{t('step3')}</li>
    </ol>
  )
}

export function PrivateNotice() {
  const t = useMessages(messages)
  return (
    <div id="private-notice" className="card private-notice" role="alert">
      <div>
        <span className="eyebrow">{t('eyebrow')}</span>
        <h2>{t('title')}</h2>
        <p className="muted">{t('body')}</p>
        <PrivacySteps />
        <button type="button" id="private-retry" onClick={() => location.reload()}>
          {t('retry')}
        </button>
      </div>
    </div>
  )
}
