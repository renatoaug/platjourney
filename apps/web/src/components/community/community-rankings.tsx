import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import type { Person, Rankings, RankRow } from '../../lib/community'
import { Icon } from '../../ui/icon'
import { repeat, Sk } from '../../ui/skeleton'
import { EmptyState, ErrorState } from '../../ui/states'
import './community-feed.css'
import './community-rankings.css'

const messages = defineMessages({
  [Language.PtBR]: {
    periods: 'Período',
    month: 'Este mês',
    year: 'Este ano',
    platinums: 'Mais platinas',
    rare: 'Mais troféus raros',
    fastest: 'Platina mais rápida',
    platinumCount: { one: '{count} platina', other: '{count} platinas' },
    rareCount: { one: '{count} raro', other: '{count} raros' },
    days: { one: '{count} dia', other: '{count} dias' },
    under: 'menos de 1 dia',
    you: 'você',
    empty: 'Ninguém pontuou neste período ainda.',
    failed: 'Não foi possível carregar os rankings.',
    retry: 'Tentar de novo',
    position: '{n}º',
  },
  [Language.En]: {
    periods: 'Period',
    month: 'This month',
    year: 'This year',
    platinums: 'Most platinums',
    rare: 'Most rare trophies',
    fastest: 'Fastest platinum',
    platinumCount: { one: '{count} platinum', other: '{count} platinums' },
    rareCount: { one: '{count} rare', other: '{count} rare' },
    days: { one: '{count} day', other: '{count} days' },
    under: 'under 1 day',
    you: 'you',
    empty: 'Nobody has scored in this period yet.',
    failed: 'Could not load the rankings.',
    retry: 'Try again',
    position: '#{n}',
  },
})

export type RankingsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; data: Rankings }

export function CommunityRankings({
  state,
  period,
  onPeriod,
  onRetry,
}: {
  state: RankingsState
  period: 'month' | 'year'
  onPeriod: (period: 'month' | 'year') => void
  onRetry: () => void
}) {
  const t = useMessages(messages)
  return (
    <section className="community-rankings" aria-label={t('platinums')}>
      <fieldset className="segmented" aria-label={t('periods')}>
        {(['month', 'year'] as const).map((p) => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => onPeriod(p)}>
            {t(p)}
          </button>
        ))}
      </fieldset>
      {state.status === 'loading' ? (
        <div className="community-boards" aria-hidden="true">
          {repeat(3, () => (
            <div className="card community-board">
              <Sk w="60%" h={20} />
              {repeat(4, () => (
                <Sk w="100%" h={36} />
              ))}
            </div>
          ))}
        </div>
      ) : state.status === 'error' ? (
        <ErrorState
          action={
            <button type="button" className="button" onClick={onRetry}>
              {t('retry')}
            </button>
          }
        >
          {t('failed')}
        </ErrorState>
      ) : (
        <div className="community-boards">
          <Board
            title={t('platinums')}
            rows={state.data.platinums}
            people={state.data.people}
            me={state.data.me}
            value={(r) => t('platinumCount', { count: r.value })}
          />
          <Board
            title={t('rare')}
            rows={state.data.rare}
            people={state.data.people}
            me={state.data.me}
            value={(r) => t('rareCount', { count: r.value })}
          />
          <Board
            title={t('fastest')}
            rows={state.data.fastest}
            people={state.data.people}
            me={state.data.me}
            value={(r) => (r.value < 1 ? t('under') : t('days', { count: Math.round(r.value) }))}
            detail={(r) => r.game?.name ?? null}
          />
        </div>
      )}
    </section>
  )
}

function Board({
  title,
  rows,
  people,
  me,
  value,
  detail,
}: {
  title: string
  rows: RankRow[]
  people: Record<string, Person>
  me: string
  value: (r: RankRow) => string
  detail?: (r: RankRow) => string | null
}) {
  const t = useMessages(messages)
  return (
    <div className="card community-board">
      <h2>{title}</h2>
      {!rows.length ? (
        <EmptyState icon="trophy">{t('empty')}</EmptyState>
      ) : (
        <ol>
          {rows.slice(0, 10).map((r, i) => {
            const p = people[r.user]
            const mine = r.user === me
            const extra = detail?.(r)
            return (
              <li key={r.user} className={mine ? 'mine' : undefined}>
                <span className="community-board-pos">{t('position', { n: i + 1 })}</span>
                <span className="community-avatar">
                  {p?.avatarUrl ? (
                    <img src={p.avatarUrl} alt="" loading="lazy" />
                  ) : (
                    <Icon name="gamepad" />
                  )}
                </span>
                <span className="community-board-name">
                  <b>@{p?.onlineId ?? '—'}</b>
                  {mine && <small> · {t('you')}</small>}
                  {extra && <small className="community-board-detail">{extra}</small>}
                </span>
                <span className="community-board-value">{value(r)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
