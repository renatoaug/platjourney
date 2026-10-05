/** The sign-in screen's frame: the story panel on one side and the card that holds the current step. */
import type { ReactNode, Ref } from 'react'
import {
  defineMessages,
  Language,
  pickLocaleBeforeSignIn,
  useLocale,
  useMessages,
} from '../../i18n/i18n'
import { Icon } from '../../ui/icon'
import { PluginSlot } from '../../ui/plugin-slot'
import { LanguageSwitcher } from '../language-switcher'

const messages = defineMessages({
  [Language.PtBR]: {
    entryLabel: 'SEU ESPAÇO DE JOGO',
    footnote: 'PlatJourney é um projeto independente, sem vínculo com a PlayStation.',
    story: {
      eyebrow: 'CADA TROFÉU CONTA',
      titleTop: 'Sua próxima',
      titleBottom: 'platina começa',
      titleAccent: ' aqui.',
      leadTop: 'Um plano para o seu jogo.',
      leadBottom: 'O Nexo na sua jornada.',
      pick: 'Escolha seu jogo',
      path: 'Encontre o caminho',
      earn: 'Conquiste a platina',
      footer: 'NO SEU RITMO. DO SEU JEITO.',
    },
  },
  [Language.En]: {
    entryLabel: 'YOUR GAMING SPACE',
    footnote: 'PlatJourney is an independent project, not affiliated with PlayStation.',
    story: {
      eyebrow: 'EVERY TROPHY COUNTS',
      titleTop: 'Your next',
      titleBottom: 'platinum starts',
      titleAccent: ' here.',
      leadTop: 'A plan for your game.',
      leadBottom: 'Nexo on your journey.',
      pick: 'Pick your game',
      path: 'Find the way',
      earn: 'Earn the platinum',
      footer: 'AT YOUR PACE. YOUR WAY.',
    },
  },
})

export function AuthLayout({
  children,
  stepRef,
}: {
  children: ReactNode
  stepRef?: Ref<HTMLDivElement>
}) {
  const t = useMessages(messages)
  const locale = useLocale()
  return (
    <div className="auth" id="auth">
      <div className="auth-layout">
        <section className="auth-story" aria-label="PlatJourney">
          <div className="logo auth-logo">
            <img className="brand-mark" src="/logo.svg" alt="" width="40" height="40" />
            <span className="brand-name">
              plat<span className="brand-accent">journey</span>
            </span>
          </div>
          <div className="auth-story-copy">
            <span className="eyebrow">{t('story.eyebrow')}</span>
            <h2>
              {t('story.titleTop')}
              <br />
              {t('story.titleBottom')}
              <span>{t('story.titleAccent')}</span>
            </h2>
            <p>
              {t('story.leadTop')}
              <br />
              {t('story.leadBottom')}
            </p>
          </div>
          <div className="auth-journey" aria-hidden="true">
            <div>
              <Icon name="gamepad" />
              <span>{t('story.pick')}</span>
            </div>
            <i />
            <div>
              <Icon name="compass" />
              <span>{t('story.path')}</span>
            </div>
            <i />
            <div>
              <Icon name="trophy" />
              <span>{t('story.earn')}</span>
            </div>
          </div>
          <span className="auth-story-footer">{t('story.footer')}</span>
        </section>
        <section className="auth-card">
          <div className="auth-card-head">
            <div className="auth-entry-label">
              <Icon name="gamepad" /> {t('entryLabel')}
            </div>
            <LanguageSwitcher value={locale} onChange={pickLocaleBeforeSignIn} />
          </div>
          <div id="auth-step" ref={stepRef}>
            {children}
          </div>
          <div className="auth-footnote">
            <p>{t('footnote')}</p>
            <PluginSlot name="sign-in" />
          </div>
        </section>
      </div>
    </div>
  )
}
