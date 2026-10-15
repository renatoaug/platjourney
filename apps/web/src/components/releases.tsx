/** The home's release calendar: PS4 and PS5 games coming out in the next weeks, and the ones that
 * just came out, each with what PlatJourney has for it and a button to save it. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useInterests } from '../app/use-interests'
import { defineMessages, Language, useLocale, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'
import { useDemo } from './demo'
import { DifficultyMeter } from './difficulty-meter'
import { titleHref } from './tip'
import './releases.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'CALENDÁRIO',
    title: 'Lançamentos',
    upcoming: 'Chegando',
    recent: 'Acabaram de sair',
    today: 'Hoje',
    tomorrow: 'Amanhã',
    guide: 'Com guia',
    hours: '~{hours}h',
    listed: 'Lista de troféus',
    soon: 'Lista ainda não saiu',
    save: 'Salvar {name} nos interesses',
    saved: '{name} está nos interesses',
    emptyUpcoming: 'Nenhum lançamento de PS4 ou PS5 nas próximas semanas.',
    emptyRecent: 'Nenhum lançamento nas últimas duas semanas.',
    failed: 'Não conseguimos carregar o calendário.',
  },
  [Language.En]: {
    eyebrow: 'CALENDAR',
    title: 'Releases',
    upcoming: 'Coming up',
    recent: 'Just out',
    today: 'Today',
    tomorrow: 'Tomorrow',
    guide: 'Has a guide',
    hours: '~{hours}h',
    listed: 'Trophy list',
    soon: 'No trophy list yet',
    save: 'Save {name} to interests',
    saved: '{name} is in your interests',
    emptyUpcoming: 'No PS4 or PS5 release in the coming weeks.',
    emptyRecent: 'No release in the last two weeks.',
    failed: 'We could not load the calendar.',
  },
})

export interface Release {
  id: string
  name: string
  cover_url: string | null
  platforms: string[]
  released_at: string
  listed: boolean
  guide: { difficulty: number; hours: number } | null
}

type ReleasesLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; releases: Release[] }

const DAY = 86_400_000
// Release days are stored at midnight UTC: compare and show them as calendar days.
const dayOf = (iso: string) => Math.floor(new Date(iso).getTime() / DAY)

function useDayLabel() {
  const t = useMessages(messages)
  const locale = useLocale()
  return (iso: string, today: number) => {
    const d = dayOf(iso)
    if (d === today) return t('today')
    if (d === today + 1) return t('tomorrow')
    return new Date(iso).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
  }
}

function ReleaseCard({ r, today }: { r: Release; today: number }) {
  const t = useMessages(messages)
  const label = useDayLabel()
  const { find, toggle } = useInterests()
  const demo = useDemo()
  const [busy, setBusy] = useState(false)
  const saved = !!find(r.id)
  const platforms = r.platforms.filter((p) => p === 'PS4' || p === 'PS5').join(' · ')
  return (
    <article className="release">
      <Link className="release-art" to={titleHref(r.id)}>
        <Cover url={r.cover_url} name={r.name} className="release-cover" />
        <span className={`release-day${dayOf(r.released_at) === today ? ' today' : ''}`}>
          {label(r.released_at, today)}
        </span>
        {r.guide && r.guide.difficulty > 0 && (
          <span className="release-score">
            <DifficultyMeter value={r.guide.difficulty} />
          </span>
        )}
      </Link>
      <button
        type="button"
        className={`release-save${saved ? ' saved' : ''}`}
        aria-pressed={saved}
        aria-label={t(saved ? 'saved' : 'save', { name: r.name })}
        data-tip={t(saved ? 'saved' : 'save', { name: r.name })}
        disabled={busy || demo}
        onClick={async () => {
          setBusy(true)
          await toggle(r.id, r.name, 'releases')
          setBusy(false)
        }}
      >
        <Icon name={saved ? 'bookmark-filled' : 'bookmark'} />
      </button>
      <Link className="release-body" to={titleHref(r.id)}>
        <b>{r.name}</b>
        <span className="release-sub">{platforms}</span>
        {r.guide && r.guide.hours > 0 ? (
          <span className="release-hours">
            <Icon name="clock" /> {t('hours', { hours: r.guide.hours })}
          </span>
        ) : r.guide ? (
          <span className="pill ok">{t('guide')}</span>
        ) : (
          <span className={`release-state${r.listed ? ' listed' : ''}`}>
            {t(r.listed ? 'listed' : 'soon')}
          </span>
        )}
      </Link>
    </article>
  )
}

/** The section: two tabs (coming up, just out) over a row of games. */
export function ReleasesView({ load, now = Date.now() }: { load: ReleasesLoad; now?: number }) {
  const t = useMessages(messages)
  const [tab, setTab] = useState<'upcoming' | 'recent'>('upcoming')
  const today = Math.floor(now / DAY)
  const all = load.status === 'ok' ? load.releases : []
  const shown =
    tab === 'upcoming'
      ? all.filter((r) => dayOf(r.released_at) >= today)
      : all.filter((r) => dayOf(r.released_at) < today).reverse()
  return (
    <section className="releases" aria-labelledby="releases-title">
      <div className="section-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h2 id="releases-title">{t('title')}</h2>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: a pair of tabs; the group role names it */}
        <div className="segmented" role="group" aria-label={t('title')}>
          {(['upcoming', 'recent'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>
              {t(k)}
            </button>
          ))}
        </div>
      </div>
      {load.status === 'loading' && (
        <div className="releases-row" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="release">
              <span className="release-cover sk" />
              <div className="release-body">
                <Sk w="80%" h={12} />
                <Sk w="45%" h={10} />
              </div>
            </div>
          ))}
        </div>
      )}
      {load.status === 'error' && <ErrorState>{t('failed')}</ErrorState>}
      {load.status === 'ok' &&
        (shown.length ? (
          <div className="releases-row">
            {shown.map((r) => (
              <ReleaseCard key={r.id} r={r} today={today} />
            ))}
          </div>
        ) : (
          <EmptyState className="empty-panel" icon="clock">
            {t(tab === 'upcoming' ? 'emptyUpcoming' : 'emptyRecent')}
          </EmptyState>
        ))}
    </section>
  )
}

const fetchReleases = () => api<Release[]>('/api/releases')

/** The section with its request. */
export function Releases({ fetch = fetchReleases }: { fetch?: () => Promise<Release[]> }) {
  const [load, setLoad] = useState<ReleasesLoad>({ status: 'loading' })
  useEffect(() => {
    let live = true
    fetch()
      .then((releases) => live && setLoad({ status: 'ok', releases }))
      .catch(() => live && setLoad({ status: 'error' }))
    return () => {
      live = false
    }
  }, [fetch])
  return <ReleasesView load={load} />
}
