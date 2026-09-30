/** Nexo card on the home screen: the latest guidance for the current game, with a link to the chat. */
import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import type { CurrentGame, Tip } from '../lib/types'
import { Icon } from '../ui/icon'
import { UserText } from '../ui/markdown'
import { Sk } from '../ui/skeleton'

const messages = defineMessages({
  [Language.PtBR]: {
    headingLatest: 'Seu próximo passo está aqui.',
    headingMissables: 'De olho nos perdíveis.',
    headingGame: 'Vamos buscar essa platina?',
    headingEmpty: 'Toda conquista tem um começo.',
    contentEmpty:
      'Tire dúvidas, planeje sua jornada e descubra o que fazer a seguir com orientações para o seu jogo.',
    badge: 'SEU PARCEIRO',
    tagline: 'Um passo mais perto da platina.',
    eyebrowLatest: 'ÚLTIMA ORIENTAÇÃO',
    eyebrowEmpty: 'BORA PARA O PRÓXIMO NÍVEL',
    readFull: 'Ler orientação completa',
    talk: 'Conversar com o Nexo',
  },
  [Language.En]: {
    headingLatest: 'Your next step is here.',
    headingMissables: 'Watch out for missables.',
    headingGame: 'Shall we go for this platinum?',
    headingEmpty: 'Every achievement has a start.',
    contentEmpty:
      'Ask questions, plan your journey and find out what to do next with tips for your game.',
    badge: 'YOUR PARTNER',
    tagline: 'One step closer to the platinum.',
    eyebrowLatest: 'LATEST GUIDANCE',
    eyebrowEmpty: 'ON TO THE NEXT LEVEL',
    readFull: 'Read full guidance',
    talk: 'Talk to Nexo',
  },
})

/** The contents of `aside.card.nexo-brief`. */
export function NexoBrief({ current, tips }: { current: CurrentGame | null; tips: Tip[] }) {
  const t = useMessages(messages)
  const latest = current
    ? tips.find(
        (tip) =>
          tip.game?.id === current.game?.id &&
          ['start', 'unlock', 'session', 'route'].includes(tip.kind),
      )
    : undefined
  const guide = current?.guide
  const paragraphs = latest?.content.split(/\n\s*\n/) ?? []
  // Nexo's session notes lead with the next target and then how to get it; show just those two.
  const nextStep = paragraphs.find((text) => /^próximo (alvo|troféu|passo)/i.test(text))
  const instructions = paragraphs.find((text) => /^como (pegar|conquistar|fazer):/i.test(text))
  const heading =
    nextStep ??
    (latest
      ? t('headingLatest')
      : guide?.hasMissables
        ? t('headingMissables')
        : current
          ? t('headingGame')
          : t('headingEmpty'))
  const content = instructions ?? latest?.content ?? guide?.earlyTips?.[0] ?? t('contentEmpty')
  return (
    <>
      <div className="nexo-heading">
        <img className="nexo-avatar" src="/nexo-avatar.svg" alt="" />
        <div>
          <h2>
            Nexo <span className="nexo-badge">{t('badge')}</span>
          </h2>
          <small>{t('tagline')}</small>
        </div>
      </div>
      <span className="eyebrow">{latest ? t('eyebrowLatest') : t('eyebrowEmpty')}</span>
      <h3>
        <UserText text={heading} />
      </h3>
      <p>
        <UserText text={content} />
      </p>
      <Link className="text-link" to={latest ? '/history' : '/nexo'}>
        {latest ? t('readFull') : t('talk')} <Icon name="arrow" />
      </Link>
    </>
  )
}

export function NexoBriefSkeleton() {
  return (
    <>
      <div className="nexo-heading">
        <Sk w="44px" h={44} style={{ borderRadius: 8, flex: 'none' }} />
        <div style={{ flex: 1 }}>
          <Sk w="40%" h={14} />
          <Sk w="60%" h={10} style={{ marginTop: 8 }} />
        </div>
      </div>
      <Sk w="30%" h={8} />
      <Sk w="85%" h={20} style={{ marginTop: 12 }} />
      <Sk w="100%" h={11} style={{ marginTop: 12 }} />
      <Sk w="95%" h={11} style={{ marginTop: 6 }} />
      <Sk w="60%" h={11} style={{ marginTop: 6 }} />
      <Sk w="40%" h={11} style={{ marginTop: 22 }} />
    </>
  )
}
