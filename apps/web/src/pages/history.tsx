/** History page: everything Nexo said and the tips assistants saved, filterable by kind, as a
 * day-by-day timeline. */
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { useProfile } from '../app/use-profile'
import { PageTop } from '../components/page-top'
import { TipItem, TipSkeleton } from '../components/tip'
import { defineMessages, Language, type MessageKey, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { fmtDay } from '../lib/format'
import type { Tip } from '../lib/types'
import { repeat } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'
import { useSlide } from '../ui/use-slide'
import './history.css'

const messages = defineMessages({
  [Language.PtBR]: {
    selected: 'Dica da notificação',
    missing: 'Esta dica não está disponível para esta conta.',
    retry: 'Tentar novamente',
    title: 'Histórico',
    lead: 'Tudo que o Nexo já te mandou, e as dicas que seus assistentes salvaram.',
    kinds: {
      all: 'todos',
      start: 'início',
      unlock: 'troféu',
      session: 'sessão',
      route: 'rota',
      server: 'servidor',
      chat: 'chat',
      assistant: 'assistentes',
    },
    emptyTitle: 'Nada no histórico ainda',
    empty: 'Tudo que o Nexo te mandar, dicas e avisos de troféu, fica guardado aqui.',
    emptyKind: 'Nada de {kind} ainda',
    emptyKindHint: 'Quando o Nexo mandar uma mensagem desse tipo, ela aparece aqui.',
    seeAll: 'Ver todos',
    loadFailed:
      'Não conseguimos carregar o histórico. Use o botão de atualizar para tentar novamente.',
  },
  [Language.En]: {
    selected: 'Tip from notification',
    missing: 'This tip is not available for this account.',
    retry: 'Try again',
    title: 'History',
    lead: 'Everything Nexo has sent you, and the tips your assistants saved.',
    kinds: {
      all: 'all',
      start: 'start',
      unlock: 'trophy',
      session: 'session',
      route: 'route',
      server: 'server',
      chat: 'chat',
      assistant: 'assistants',
    },
    emptyTitle: 'Nothing in the history yet',
    empty: 'Everything Nexo sends you, tips and trophy notices, is kept here.',
    emptyKind: 'No {kind} yet',
    emptyKindHint: 'When Nexo sends a message of this kind, it shows up here.',
    seeAll: 'See all',
    loadFailed: 'We could not load the history. Use the refresh button to try again.',
  },
})

const FILTERS: { kind: string; label: MessageKey<typeof messages> }[] = [
  { kind: '', label: 'kinds.all' },
  { kind: 'start', label: 'kinds.start' },
  { kind: 'unlock', label: 'kinds.unlock' },
  { kind: 'session', label: 'kinds.session' },
  { kind: 'route', label: 'kinds.route' },
  { kind: 'server', label: 'kinds.server' },
  { kind: 'chat', label: 'kinds.chat' },
  { kind: 'assistant', label: 'kinds.assistant' },
]
const LABEL = new Map(FILTERS.map((f) => [f.kind, f.label]))

// The app state brings the newest 50; the page asks for 30 older ones each time its end shows.
const FIRST = 50
const BATCH = 30

/** Older tips for the endless timeline, appended as the end of the list comes into view. */
function useOlderTips(first: Tip[] | undefined) {
  const [older, setOlder] = useState<Tip[]>([])
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const all = first ? [...first, ...older] : []
  const last = all[all.length - 1]?.created_at
  const exhausted = done || !first || first.length < FIRST
  useEffect(() => {
    const el = end.current
    if (exhausted || loading || !last || !el) return
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        seen.disconnect()
        setLoading(true)
        api<Tip[]>(`/api/tips?before=${encodeURIComponent(last)}`)
          .then((more) => {
            setOlder((o) => [...o, ...more])
            if (more.length < BATCH) setDone(true)
          })
          .catch(() => setDone(true))
          .finally(() => setLoading(false))
      },
      { rootMargin: '300px' },
    )
    seen.observe(el)
    return () => seen.disconnect()
  }, [exhausted, loading, last])
  return { all, loading, end }
}

// Grouped by day, newest first (the server already sends them in that order).
function byDay(list: Tip[]) {
  const days = new Map<string, Tip[]>()
  for (const t of list) {
    const key = new Date(t.created_at).toDateString()
    days.set(key, [...(days.get(key) ?? []), t])
  }
  return [...days.values()]
}

function Timeline({ tips, kind, onAll }: { tips: Tip[]; kind: string; onAll: () => void }) {
  const t = useMessages(messages)
  const profile = useProfile()
  if (!tips.length)
    return (
      <EmptyState icon="history" title={t('emptyTitle')}>
        {t('empty')}
      </EmptyState>
    )
  const filtered = kind ? tips.filter((t) => t.kind === kind) : tips
  if (!filtered.length)
    return (
      <EmptyState
        icon="history"
        title={t('emptyKind', {
          kind: LABEL.has(kind) ? t(LABEL.get(kind) as MessageKey<typeof messages>) : kind,
        })}
        action={
          <button type="button" className="text-link" onClick={onAll}>
            {t('seeAll')}
          </button>
        }
      >
        {t('emptyKindHint')}
      </EmptyState>
    )
  // "What do I do now?" only on each game's latest notice (the older ones are behind the player),
  // and not on a game already platinum: there is no next step. Until the platinums are known, none.
  const done = profile ? new Set(profile.platinums.map((p) => p.game.id)) : null
  const latest = new Set<string>()
  const seen = new Set<string>()
  for (const tip of filtered)
    if (done && tip.game?.id && !seen.has(tip.game.id)) {
      seen.add(tip.game.id)
      if (!done.has(tip.game.id)) latest.add(tip.id)
    }
  return (
    <>
      {byDay(filtered).map((group) => (
        <section className="day" key={group[0].created_at}>
          <h3 className="day-label">
            {fmtDay(group[0].created_at)}
            <span>{group.length}</span>
          </h3>
          {group.map((t, i) => (
            <TipItem key={t.id ?? i} tip={t} ask={latest.has(t.id)} />
          ))}
        </section>
      ))}
    </>
  )
}

function SelectedTip({ id }: { id: string }) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ id: string; tip: Tip | 'missing' | 'error' } | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly retries the same tip.
  useEffect(() => {
    let live = true
    setLoaded(null)
    api<Tip>(`/api/tip?id=${encodeURIComponent(id)}`)
      .then((tip) => {
        if (live) setLoaded({ id, tip })
      })
      .catch((e) => {
        if (live) setLoaded({ id, tip: e.status === 404 ? 'missing' : 'error' })
      })
    return () => {
      live = false
    }
  }, [id, attempt])
  const tip = loaded?.id === id ? loaded.tip : null
  return <SelectedTipView tip={tip} onRetry={() => setAttempt((n) => n + 1)} />
}

export function SelectedTipView({
  tip,
  onRetry,
}: {
  tip: Tip | 'missing' | 'error' | null
  onRetry: () => void
}) {
  const t = useMessages(messages)
  return (
    <section className="card history-selected" aria-label={t('selected')}>
      <h2>{t('selected')}</h2>
      {!tip ? (
        <TipSkeleton />
      ) : tip === 'missing' ? (
        <EmptyState>{t('missing')}</EmptyState>
      ) : tip === 'error' ? (
        <ErrorState>
          <button type="button" className="text-link" onClick={onRetry}>
            {t('retry')}
          </button>
        </ErrorState>
      ) : (
        <TipItem tip={tip} ask />
      )}
      <Link className="text-link" to="/history">
        {t('seeAll')}
      </Link>
    </section>
  )
}

export function History() {
  const t = useMessages(messages)
  const { data, sync, cache } = useApp()
  const [params] = useSearchParams()
  const selected = params.get('tip')
  const older = useOlderTips(data?.tips)
  // The chosen filter survives navigation.
  const [kind, setKindState] = useState(() =>
    typeof cache.tipKind === 'string' ? cache.tipKind : '',
  )
  const setKind = (k: string) => {
    cache.tipKind = k
    setKindState(k)
  }
  const filtersRef = useSlide<HTMLDivElement>(kind)
  const latest = data?.tips.find((tip) => tip.game)

  return (
    <Page path="/history">
      {/* The last game Nexo wrote about runs across the top. */}
      <PageTop
        title={t('title')}
        lead={t('lead')}
        art={latest?.game?.art_url ?? latest?.game?.cover_url}
        tint={latest?.game?.tint}
      >
        {!selected && (
          <div className="chips history-filters" id="tip-filters" ref={filtersRef}>
            {FILTERS.map((f) => (
              <button
                key={f.kind}
                type="button"
                className={`chip${kind === f.kind ? ' active' : ''}`}
                data-kind={f.kind}
                onClick={() => setKind(f.kind)}
              >
                {t(f.label)}
              </button>
            ))}
          </div>
        )}
      </PageTop>
      {selected ? (
        <SelectedTip id={selected} />
      ) : (
        <div className="card">
          <div id="tips">
            {data ? (
              <>
                <Timeline tips={older.all} kind={kind} onAll={() => setKind('')} />
                {older.loading && repeat(3, () => <TipSkeleton />)}
                <div ref={older.end} aria-hidden="true" />
              </>
            ) : sync === 'failed' ? (
              <ErrorState>{t('loadFailed')}</ErrorState>
            ) : (
              repeat(5, () => <TipSkeleton />)
            )}
          </div>
        </div>
      )}
    </Page>
  )
}
