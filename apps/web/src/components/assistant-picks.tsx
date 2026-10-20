/** Games a connected assistant (Claude, ChatGPT) suggested in its chat and saved to PlatJourney,
 * each with the assistant's reason and name. Left out when there is none. */
import { type MouseEvent, useEffect, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import type { AssistantPick } from '../lib/types'
import { Icon } from '../ui/icon'
import { assistantName } from './app-logo'
import { useDemo } from './demo'
import { GameCard, GameShelf } from './game-band'
import { SaveToInterests } from './save-to-interests'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'DOS SEUS ASSISTENTES',
    title: 'Sugeridos no seu chat',
    titleOne: 'Sugeridos pelo {name}',
    unnamed: 'Assistente',
    lead: 'Os jogos que o seu assistente recomendou numa conversa. Ficam aqui por 30 dias.',
    dismissAria: 'Tirar {name} das sugestões',
    dismissTip: 'Tirar das sugestões',
  },
  [Language.En]: {
    eyebrow: 'FROM YOUR ASSISTANTS',
    title: 'Suggested in your chat',
    titleOne: 'Suggested by {name}',
    unnamed: 'Assistant',
    lead: 'The games your assistant recommended in a conversation. They stay here for 30 days.',
    dismissAria: 'Remove {name} from the suggestions',
    dismissTip: 'Remove from the suggestions',
  },
})

export function AssistantPicks() {
  const t = useMessages(messages)
  const demo = useDemo()
  const [picks, setPicks] = useState<AssistantPick[]>([])
  useEffect(() => {
    api<{ items: AssistantPick[] }>('/api/assistant-picks')
      .then((r) => setPicks(r.items ?? []))
      .catch(() => setPicks([]))
  }, [])
  const dismiss = (p: AssistantPick) => (e: MouseEvent) => {
    // It sits over the card's links; the click removes, it does not open the game.
    e.preventDefault()
    e.stopPropagation()
    setPicks((list) => list.filter((x) => x.game.id !== p.game.id))
    api('/api/assistant-picks/dismiss', { game: p.game.id }).catch(() => {})
  }
  const nameOf = (p: AssistantPick) => assistantName(p.assistant) ?? t('unnamed')
  const names = [...new Set(picks.map(nameOf))]
  return (
    <GameShelf
      id="assistant-picks-title"
      eyebrow={t('eyebrow')}
      title={names.length === 1 ? t('titleOne', { name: names[0] }) : t('title')}
      lead={t('lead')}
      cards={picks.map((p) => (
        <GameCard
          key={p.game.id}
          item={{
            game: p.game,
            difficulty: p.difficulty,
            hours: p.hours,
            playthroughs: p.playthroughs,
            hasMissables: p.hasMissables,
            hasOnline: p.hasOnline,
            hasDifficultyTrophy: p.hasDifficultyTrophy,
            tag: nameOf(p),
            reason: p.reason,
            reasonTitle: p.reason,
            reasonLines: 3,
          }}
          actions={
            demo ? undefined : (
              <>
                <SaveToInterests game={p.game} source="recommendations" />
                <button
                  type="button"
                  className="rec-dismiss"
                  aria-label={t('dismissAria', { name: p.game.name })}
                  data-tip={t('dismissTip')}
                  onClick={dismiss(p)}
                >
                  <Icon name="close" />
                </button>
              </>
            )
          }
        />
      ))}
    />
  )
}
