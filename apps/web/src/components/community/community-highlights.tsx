import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { defineMessages, Language, type Translator, useLocale, useMessages } from '../../i18n/i18n'
import { type CommunityEvent, fetchFeed, type Person } from '../../lib/community'
import { fmtAgo } from '../../lib/format'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { repeat, Sk } from '../../ui/skeleton'
import './community-feed.css'
import './community-highlights.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'COMUNIDADE',
    title: 'Enquanto isso, na caçada',
    seeAll: 'Ver a comunidade',
    platinum: 'platinou {game}',
    rare: 'pegou {trophy}',
    start: 'começou {game}',
    medal: 'ganhou uma medalha',
    empty: 'Assim que alguém pegar uma platina ou um troféu raro, aparece aqui.',
  },
  [Language.En]: {
    eyebrow: 'COMMUNITY',
    title: 'Meanwhile, on the hunt',
    seeAll: 'See the community',
    platinum: 'platinumed {game}',
    rare: 'earned {trophy}',
    start: 'started {game}',
    medal: 'earned a medal',
    empty: 'As soon as someone earns a platinum or a rare trophy, it shows up here.',
  },
})

export type HighlightsState =
  | { status: 'loading' }
  | { status: 'ok'; events: CommunityEvent[]; people: Record<string, Person> }

/** The Home's peek at the community: its last three events. */
export function CommunityHighlights() {
  const [state, setState] = useState<HighlightsState>({ status: 'loading' })
  const [gone, setGone] = useState(false)
  useEffect(() => {
    let live = true
    fetchFeed('all')
      .then(
        (page) =>
          live && setState({ status: 'ok', events: page.events.slice(0, 3), people: page.people }),
      )
      // The community is a bonus on the Home: if it fails, the card steps aside.
      .catch(() => live && setGone(true))
    return () => {
      live = false
    }
  }, [])
  if (gone) return null
  return <CommunityHighlightsView state={state} />
}

function lineOf(e: CommunityEvent, t: Translator<typeof messages>, english: boolean) {
  const game = e.game?.name ?? ''
  if (e.kind === 'platinum') return t('platinum', { game })
  if (e.kind === 'rare') return t('rare', { trophy: english ? e.trophyEn || e.trophy : e.trophy })
  if (e.kind === 'start') return t('start', { game })
  return t('medal')
}

export function CommunityHighlightsView({ state }: { state: HighlightsState }) {
  const t = useMessages(messages)
  const english = useLocale() === Language.En
  return (
    <section className="community-highlights" aria-labelledby="community-highlights-title">
      <div className="section-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h2 id="community-highlights-title">{t('title')}</h2>
        </div>
        <Link to="/community" className="text-link">
          {t('seeAll')} <Icon name="arrow" />
        </Link>
      </div>
      {state.status === 'loading' ? (
        <ol className="community-highlight-list" aria-hidden="true">
          {repeat(3, () => (
            <li className="community-highlight">
              <Sk w="100%" h={56} />
            </li>
          ))}
        </ol>
      ) : !state.events.length ? (
        <p className="community-highlight-empty">{t('empty')}</p>
      ) : (
        <ol className="community-highlight-list">
          {state.events.map((e) => {
            const p = state.people[e.user]
            const game = e.game?.name ?? ''
            const line = lineOf(e, t, english)
            return (
              <li key={e.key} className={`community-highlight ${e.kind}`}>
                <Link to="/community" className="community-highlight-link">
                  <Cover className="community-highlight-art" url={e.game?.iconUrl} name={game} />
                  <span className="community-highlight-text">
                    <b>@{p?.onlineId ?? '—'}</b> {line}
                    <small>{fmtAgo(e.at)}</small>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
