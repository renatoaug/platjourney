import { useState } from 'react'
import { Link } from 'react-router'
import { useInterests } from '../../app/use-interests'
import { defineMessages, getLocale, Language, useMessages } from '../../i18n/i18n'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { useDemo } from '../demo'
import { titleHref } from '../tip'
import './answer-cards.css'

const messages = defineMessages({
  [Language.PtBR]: {
    pick: 'Sua próxima platina',
    add: 'Adicionar aos interesses',
    added: 'Nos seus interesses',
    open: 'Ver no jogo',
    talk: 'Conversar sobre este jogo',
    difficulty: 'Dificuldade',
    hours: 'Tempo até a platina',
    hoursUnit: ' horas',
    progress: 'Progresso',
  },
  [Language.En]: {
    pick: 'Your next platinum',
    add: 'Add to interests',
    added: 'In your interests',
    open: 'See in the game',
    talk: 'Talk about this game',
    difficulty: 'Difficulty',
    hours: 'Time to platinum',
    hoursUnit: ' hours',
    progress: 'Progress',
  },
})

/** The game an answer recommends, as it was when written. */
export interface ChatGameCard {
  kind: 'game'
  game: string
  name: string
  coverUrl?: string | null
  artUrl?: string | null
  difficulty?: number | null
  hours?: number | null
  progress?: number | null
}

const number = (value: number) => value.toLocaleString(getLocale())

function AnswerStat({
  icon,
  label,
  value,
  unit,
}: {
  icon: string
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="answer-stat">
      <span className="answer-stat-icon">
        <Icon name={icon} />
      </span>
      <span className="answer-stat-label">{label}</span>
      <b>
        {value}
        {unit && <small>{unit}</small>}
      </b>
    </div>
  )
}

function AnswerHero({ art, children }: { art?: string | null; children: React.ReactNode }) {
  return (
    <div className={`answer-hero${art ? '' : ' bare'}`}>
      {art && <img className="answer-hero-art" src={art} alt="" />}
      {children}
    </div>
  )
}

/** The game an answer recommends: its art, what the platinum takes and the way to it. */
export function AnswerGame({ card, onTalk }: { card: ChatGameCard; onTalk?: () => void }) {
  const t = useMessages(messages)
  const { find, toggle } = useInterests()
  const demo = useDemo()
  const [busy, setBusy] = useState(false)
  const saved = !!find(card.game)
  return (
    <div className="answer-card">
      <AnswerHero art={card.artUrl}>
        <div className="answer-title">
          <Cover url={card.coverUrl} name={card.name} className="answer-cover" />
          <div>
            <span>{t('pick')}</span>
            <strong>{card.name}</strong>
          </div>
        </div>
        <div className="answer-actions">
          <button
            type="button"
            className={saved ? 'answer-added' : 'answer-primary'}
            disabled={saved || busy || demo}
            onClick={async () => {
              setBusy(true)
              await toggle(card.game, card.name, 'title')
              setBusy(false)
            }}
          >
            {saved && <Icon name="check" />}
            {t(saved ? 'added' : 'add')}
          </button>
          <Link className="answer-link" to={titleHref(card.game)}>
            <Icon name="arrow" />
            {t('open')}
          </Link>
          {onTalk && (
            <button type="button" className="answer-link" onClick={onTalk}>
              <Icon name="nexo" />
              {t('talk')}
            </button>
          )}
        </div>
      </AnswerHero>
      {(!!card.difficulty || !!card.hours || card.progress != null) && (
        <div className="answer-stats">
          {!!card.difficulty && (
            <AnswerStat
              icon="bolt"
              label={t('difficulty')}
              value={number(card.difficulty)}
              unit="/10"
            />
          )}
          {!!card.hours && (
            <AnswerStat
              icon="clock"
              label={t('hours')}
              value={`~${number(card.hours)}`}
              unit={t('hoursUnit')}
            />
          )}
          {card.progress != null && (
            <AnswerStat
              icon="target"
              label={t('progress')}
              value={number(card.progress)}
              unit="%"
            />
          )}
        </div>
      )}
    </div>
  )
}
