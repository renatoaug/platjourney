/** "Nexo decide": which of the saved interests to platinum now, why it fits and what to do first.
 * Model work, so it runs only when the player asks, and the answer stays for the visit. */
import { useState } from 'react'
import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import { plainText } from '../../lib/text'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { Sk } from '../../ui/skeleton'
import { titleHref } from '../tip'
import './next-pick.css'

const messages = defineMessages({
  [Language.PtBR]: {
    hint: 'Não sabe qual pegar agora?',
    ask: 'Deixa o Nexo escolher',
    again: 'Escolher de novo',
    thinking: 'O Nexo está pensando…',
    eyebrow: 'SUA PRÓXIMA PLATINA',
    first: 'Por onde começar',
    failed: 'O Nexo não conseguiu escolher agora. Tenta de novo.',
  },
  [Language.En]: {
    hint: 'Not sure which one to go for now?',
    ask: 'Let Nexo pick',
    again: 'Pick again',
    thinking: 'Nexo is thinking…',
    eyebrow: 'YOUR NEXT PLATINUM',
    first: 'Where to start',
    failed: 'Nexo could not pick right now. Try again.',
  },
})

export interface NextPick {
  game: { id: string; name: string; cover_url?: string | null }
  why: string
  firstStep: string
}

type PickState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; pick: NextPick }

/** The card: the button, the wait, and the pick. `onAsk` runs the request. */
export function NextPickCard({ state, onAsk }: { state: PickState; onAsk: () => void }) {
  const t = useMessages(messages)
  return (
    <section className="next-pick" aria-live="polite" aria-busy={state.status === 'loading'}>
      {state.status === 'ok' ? (
        <>
          <span className="eyebrow">{t('eyebrow')}</span>
          <Link className="next-pick-game" to={titleHref(state.pick.game.id)}>
            <Cover
              url={state.pick.game.cover_url}
              name={state.pick.game.name}
              className="next-pick-cover"
            />
            <b>{state.pick.game.name}</b>
            <Icon name="arrow" />
          </Link>
          <p>{plainText(state.pick.why)}</p>
          <p className="next-pick-first">
            <span>{t('first')}</span> {plainText(state.pick.firstStep)}
          </p>
          <button type="button" className="ghost sm" onClick={onAsk}>
            <Icon name="refresh" /> {t('again')}
          </button>
        </>
      ) : state.status === 'loading' ? (
        <div className="next-pick-wait">
          <img className="next-pick-nexo" src="/nexo-avatar.svg" alt="" />
          <div>
            <span>{t('thinking')}</span>
            <Sk w="80%" h={10} style={{ marginTop: 8 }} />
            <Sk w="55%" h={10} style={{ marginTop: 6 }} />
          </div>
        </div>
      ) : (
        <div className="next-pick-ask">
          <img className="next-pick-nexo" src="/nexo-avatar.svg" alt="" />
          <span>{t('hint')}</span>
          <button type="button" className="text-link next-pick-go" onClick={onAsk}>
            {t('ask')} <Icon name="arrow-right" />
          </button>
          {state.status === 'error' && (
            <span className="next-pick-error" role="alert">
              {t('failed')}
            </span>
          )}
        </div>
      )}
    </section>
  )
}

/** The card with its request; the pick is kept in `cache` so it survives navigating away. */
export function NextPickBox({
  ask,
  cache,
  onDone,
}: {
  ask: () => Promise<{ pick: NextPick | null }>
  cache: Record<string, unknown>
  onDone?: () => void
}) {
  const [state, setState] = useState<PickState>(() => {
    const kept = cache.nextPick as NextPick | undefined
    return kept ? { status: 'ok', pick: kept } : { status: 'idle' }
  })
  const run = async () => {
    setState({ status: 'loading' })
    try {
      const { pick } = await ask()
      if (pick) cache.nextPick = pick
      setState(pick ? { status: 'ok', pick } : { status: 'idle' })
      onDone?.()
    } catch {
      setState({ status: 'error' })
    }
  }
  return <NextPickCard state={state} onAsk={run} />
}
