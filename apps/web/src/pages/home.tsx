/** Home: greeting, the current journey, Nexo's latest word, stats, the radar, the annual goal and recent activity. */
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { AnnualGoal, AnnualGoalSkeleton } from '../components/annual-goal'
import { GameCardsSkeleton, RadarCard } from '../components/game-cards'
import { Hero, HeroSkeleton } from '../components/hero'
import { NexoBrief, NexoBriefSkeleton } from '../components/nexo-brief'
import { StatTiles, StatTilesSkeleton } from '../components/stat-tiles'
import { TipItem, TipSkeleton } from '../components/tip'
import { defineMessages, getLocale, Language, type Translator, useMessages } from '../i18n/i18n'
import type { ProfileSummary } from '../lib/types'
import { Icon } from '../ui/icon'
import { repeat } from '../ui/skeleton'
import { EmptyState } from '../ui/states'
import './home.css'

const messages = defineMessages({
  [Language.PtBR]: {
    greeting: {
      morning: 'Bom dia, {name}.',
      afternoon: 'Boa tarde, {name}.',
      evening: 'Boa noite, {name}.',
    },
    eyebrow: 'MENOS GRIND. MAIS CONQUISTAS.',
    titleFallback: 'Sua próxima conquista.',
    sub: 'Cada troféu é um passo. Vamos à sua próxima conquista?',
    subLoading: 'Cada troféu é um passo. Vamos ao próximo?',
    tilesLabel: 'Suas conquistas',
    radarEyebrow: 'CONTINUE A JORNADA',
    radarTitle: 'No radar da platina',
    seeLibrary: 'Ver biblioteca',
    radarEmptyTitle: 'Nada no radar ainda',
    radarEmpty:
      'Os jogos que você começar e ainda não platinou aparecem aqui, do mais perto ao mais longe da platina.',
    findGame: 'Procurar um jogo',
    tipsEyebrow: 'NO SEU RITMO',
    tipsTitle: 'Últimas do Nexo',
    seeHistory: 'Ver histórico',
    tipsEmptyTitle: 'O Nexo ainda não falou',
    tipsEmpty: 'Quando você jogar, as dicas e os avisos dele aparecem aqui.',
    footer: 'Jogue com propósito. Conquiste no seu ritmo.',
  },
  [Language.En]: {
    greeting: {
      morning: 'Good morning, {name}.',
      afternoon: 'Good afternoon, {name}.',
      evening: 'Good evening, {name}.',
    },
    eyebrow: 'LESS GRIND. MORE TROPHIES.',
    titleFallback: 'Your next achievement.',
    sub: 'Every trophy is a step. Ready for your next one?',
    subLoading: 'Every trophy is a step. On to the next?',
    tilesLabel: 'Your achievements',
    radarEyebrow: 'KEEP THE JOURNEY GOING',
    radarTitle: 'On the platinum radar',
    seeLibrary: 'See library',
    radarEmptyTitle: 'Nothing on the radar yet',
    radarEmpty:
      'The games you start and have not platinumed show up here, from closest to farthest from the platinum.',
    findGame: 'Find a game',
    tipsEyebrow: 'AT YOUR PACE',
    tipsTitle: 'Latest from Nexo',
    seeHistory: 'See history',
    tipsEmptyTitle: 'Nexo has not spoken yet',
    tipsEmpty: 'When you play, its tips and notices show up here.',
    footer: 'Play with purpose. Achieve at your pace.',
  },
})

const greeting = (t: Translator<typeof messages>, onlineId: string) => {
  const hour = new Date().getHours()
  return t(hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening', {
    name: onlineId,
  })
}

export function Home() {
  const t = useMessages(messages)
  const { data } = useApp()
  // The profile is missing while PSN has not answered for this player.
  const profile = data?.profile as ProfileSummary | null | undefined
  const today = new Date().toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const tips = data?.tips.filter((tip) => tip.kind !== 'chat').slice(0, 3)

  return (
    <Page path="/">
      <div className="page-head home-heading">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1 id="home-title">{profile ? greeting(t, profile.onlineId) : t('titleFallback')}</h1>
          <p id="home-sub">{data ? t('sub') : t('subLoading')}</p>
        </div>
        <span className="date-label" id="today">
          {today}
        </span>
      </div>
      <div className="mission-grid">
        <div className="card hero" id="home-hero">
          {data ? <Hero game={data.current} compact /> : <HeroSkeleton />}
        </div>
        <aside className="card nexo-brief" id="home-nexo">
          {data ? <NexoBrief current={data.current} tips={data.tips} /> : <NexoBriefSkeleton />}
        </aside>
      </div>
      <section className="tiles" id="tiles" aria-label={t('tilesLabel')}>
        {data ? <StatTiles profile={profile ?? null} goals={data.goals} /> : <StatTilesSkeleton />}
      </section>
      <div className="dashboard-bottom">
        <section className="library-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">{t('radarEyebrow')}</span>
              <h2>{t('radarTitle')}</h2>
            </div>
            <Link to="/discover" className="text-link">
              {t('seeLibrary')} <Icon name="arrow" />
            </Link>
          </div>
          <div id="home-ranking" className="game-grid">
            {!data ? (
              <GameCardsSkeleton />
            ) : data.ranking.length ? (
              data.ranking.slice(0, 3).map((r, i) => <RadarCard key={r.game} item={r} index={i} />)
            ) : (
              <EmptyState
                className="empty-panel"
                icon="gamepad"
                title={t('radarEmptyTitle')}
                action={
                  <Link className="button ghost sm" to="/guides">
                    <Icon name="search" /> {t('findGame')}
                  </Link>
                }
              >
                {t('radarEmpty')}
              </EmptyState>
            )}
          </div>
        </section>
        <div className="card annual-goal" id="home-goal">
          {data ? <AnnualGoal goals={data.goals} /> : <AnnualGoalSkeleton />}
        </div>
      </div>
      <section className="activity-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t('tipsEyebrow')}</span>
            <h2>{t('tipsTitle')}</h2>
          </div>
          <Link to="/history" className="text-link">
            {t('seeHistory')} <Icon name="arrow" />
          </Link>
        </div>
        <div id="home-tips" className="activity-grid">
          {!tips ? (
            repeat(3, () => <TipSkeleton compact />)
          ) : tips.length ? (
            tips.map((tip, i) => <TipItem key={tip.id ?? i} tip={tip} compact />)
          ) : (
            <EmptyState className="empty-panel" icon="nexo" title={t('tipsEmptyTitle')}>
              {t('tipsEmpty')}
            </EmptyState>
          )}
        </div>
      </section>
      <footer className="page-footer">
        <span>PLATJOURNEY</span>
        <span>{t('footer')}</span>
      </footer>
    </Page>
  )
}
