import { useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { trophyAdvice, trophyRoadmap } from '../lib/trophy-roadmap'
import type { CurrentGame, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { GuideText } from '../ui/markdown'
import { Sk } from '../ui/skeleton'
import { TrophyArt } from '../ui/trophy-art'
import { JourneyLink } from './journey-link'
import { nexoHref } from './tip'
import './trophy-roadmap.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Cada conquista abre um caminho.',
    map: 'MAPA DA JORNADA',
    open: 'Explorar marco',
    close: 'Recolher dica',
    challenge: 'Atenção no caminho',
    order: 'Como este caminho é definido',
    subtitle:
      'Todos os troféus conectados ao roteiro. Cada conquista acompanha seu progresso na PSN.',
    basis:
      'Ordem sugerida pelo guia, não uma sequência garantida. Objetivos podem ser feitos em paralelo; sua posição no jogo não é confirmada pelos troféus.',
    count: '{earned} de {total} conquistados no jogo base',
    phase: 'ETAPA {number}',
    phaseName: 'Etapa do guia',
    unplaced: 'Ainda sem posição no roteiro',
    unplacedNote:
      'Estes troféus não têm uma correspondência única nas fases do guia. A ordem abaixo é a da lista PSN, não uma recomendação.',
    platinum: 'A conquista final',
    platinumNote: 'A platina só aparece concluída quando a PSN confirma sua conquista.',
    dlc: 'Além do jogo base',
    dlcNote:
      'Troféus adicionais, separados da rota da platina. Sua preferência de progresso continua valendo no resumo do jogo.',
    earned: 'Conquistado',
    pending: 'Pendente',
    suggestion: 'Sugestão atual do guia',
    jump: 'Ir à sugestão',
    first: 'Ir ao primeiro pendente',
    note: 'Orientação do guia',
    gap: 'Sem dica específica no guia.',
    talk: 'Conversar com Nexo',
    ask: 'Perguntar ao Nexo',
    warning: 'Atenção antes de avançar',
    online: 'Objetivo online',
    bug: 'Problema relatado no guia',
    secret: 'Troféu oculto',
    secretNote: 'Nome, descrição e dicas protegidos para evitar spoilers.',
    reveal: 'Revelar este troféu',
    hide: 'Ocultar detalhes',
    progress: 'Progresso informado pela PSN: {value} / {target}',
    empty:
      'Os troféus ainda não estão disponíveis. O roteiro aparece quando a sincronização os trouxer.',
    bronze: 'Bronze',
    silver: 'Prata',
    gold: 'Ouro',
    platinumType: 'Platina',
  },
  [Language.En]: {
    title: 'Every achievement opens a path.',
    map: 'JOURNEY MAP',
    open: 'Explore milestone',
    close: 'Collapse advice',
    challenge: 'Watch your step',
    order: 'How this path is defined',
    subtitle: 'Every trophy connected to the roadmap. Each achievement follows your PSN progress.',
    basis:
      'Suggested guide order, not a guaranteed sequence. Objectives can run in parallel; trophies do not confirm your location in the game.',
    count: '{earned} of {total} earned in the base game',
    phase: 'STAGE {number}',
    phaseName: 'Guide stage',
    unplaced: 'Not yet placed on the roadmap',
    unplacedNote:
      'These trophies do not have a unique match in the guide phases. The order below follows the PSN list, not a recommendation.',
    platinum: 'The final achievement',
    platinumNote: 'Platinum only appears complete when PSN confirms it has been earned.',
    dlc: 'Beyond the base game',
    dlcNote:
      'Additional trophies, separate from the platinum route. Your progress preference still applies to the game summary.',
    earned: 'Earned',
    pending: 'Pending',
    suggestion: 'Current guide suggestion',
    jump: 'Go to suggestion',
    first: 'Go to first pending',
    note: 'Guide advice',
    gap: 'No specific tip in the guide yet.',
    talk: 'Talk to Nexo',
    ask: 'Ask Nexo',
    warning: 'Before moving on',
    online: 'Online objective',
    bug: 'Issue reported in the guide',
    secret: 'Hidden trophy',
    secretNote: 'Name, description and advice are protected to avoid spoilers.',
    reveal: 'Reveal this trophy',
    hide: 'Hide details',
    progress: 'Progress reported by PSN: {value} / {target}',
    empty: 'Trophies are not available yet. The roadmap appears once they have been synced.',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinumType: 'Platinum',
  },
})

const anchor = (trophy: Trophy) => `roadmap-${encodeURIComponent(trophy.groupId)}-${trophy.id}`

function TrophyAdvice({ trophy, game }: { trophy: Trophy; game: CurrentGame }) {
  const t = useMessages(messages)
  const advice = trophyAdvice(trophy, game.guide)
  const hasAdvice = advice.trick || advice.warning || advice.online || advice.bug
  return (
    <div className="roadmap-advice">
      {hasAdvice && (
        <span className="roadmap-advice-label">
          <Icon name="nexo" />
          {t('note')}
        </span>
      )}
      {advice.trick && (
        <p>
          <GuideText text={advice.trick} />
        </p>
      )}
      {advice.warning && (
        <div className="roadmap-caution">
          <b>
            <Icon name="warning" />
            {t('warning')}
          </b>
          <p>
            <GuideText text={advice.warning.when} />
          </p>
          <p>
            <GuideText text={advice.warning.how} />
          </p>
        </div>
      )}
      {advice.online && (
        <p>
          <b>{t('online')}: </b>
          <GuideText text={advice.online.what} />
        </p>
      )}
      {advice.bug && (
        <p>
          <b>{t('bug')}: </b>
          <GuideText text={[advice.bug.issue, advice.bug.workaround].filter(Boolean).join('\n')} />
        </p>
      )}
      {!hasAdvice && <p className="roadmap-gap">{t('gap')}</p>}
      <JourneyLink className="roadmap-ask" to={nexoHref(game.np, game.name, trophy.name)}>
        <Icon name="nexo" />
        {t('ask')}
      </JourneyLink>
    </div>
  )
}

function RoadmapPath() {
  return (
    <svg
      className="roadmap-path"
      viewBox="0 0 100 200"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="roadmap-path-bed" d="M50 0 C50 40 25 45 25 100 S50 160 50 200" />
      <path className="roadmap-path-trace" d="M50 0 C50 40 25 45 25 100 S50 160 50 200" />
    </svg>
  )
}

function TrophyMarker({
  trophy,
  hidden,
  suggested,
  obstacle,
}: {
  trophy: Trophy
  hidden: boolean
  suggested: boolean
  obstacle: boolean
}) {
  const t = useMessages(messages)
  return (
    <summary className="roadmap-leg">
      <RoadmapPath />
      <span className={`roadmap-node ${trophy.type}`}>
        <TrophyArt url={hidden ? undefined : trophy.iconUrl} />
        <span className="roadmap-node-status">
          <Icon name={trophy.earned ? 'check' : obstacle ? 'warning' : 'trophy'} />
        </span>
      </span>
      <span className="roadmap-node-label">
        <span className="roadmap-state">
          {trophy.earned ? t('earned') : suggested ? t('suggestion') : t('pending')}
        </span>
        <span className="roadmap-node-name">{hidden ? t('secret') : trophy.name}</span>
        <span className="roadmap-node-hint">
          {!hidden && !trophy.earned && obstacle ? t('challenge') : t('open')}
          <Icon name="chevron-down" />
        </span>
      </span>
    </summary>
  )
}

function TrophyStep({
  trophy,
  game,
  suggested,
}: {
  trophy: Trophy
  game: CurrentGame
  suggested: boolean
}) {
  const t = useMessages(messages)
  const [revealed, setRevealed] = useState(false)
  const hidden = trophy.hidden && !trophy.earned && !revealed
  const obstacle = Boolean(
    trophyAdvice(trophy, game.guide).warning || trophyAdvice(trophy, game.guide).bug,
  )
  return (
    <li
      id={anchor(trophy)}
      className={`roadmap-step${trophy.earned ? ' is-earned' : ''}${suggested ? ' is-suggested' : ''}${trophy.type === 'platinum' ? ' is-platinum' : ''}`}
    >
      <details className="roadmap-milestone" open={suggested || undefined}>
        <TrophyMarker
          trophy={trophy}
          hidden={Boolean(hidden)}
          suggested={suggested}
          obstacle={obstacle}
        />
        <article className="roadmap-content">
          <header className="roadmap-trophy-heading">
            <Icon name="nexo" />
            <div>
              <span className="roadmap-state">
                {t(trophy.type === 'platinum' ? 'platinumType' : trophy.type)}
              </span>
              <h4>{hidden ? t('secret') : trophy.name}</h4>
            </div>
          </header>
          <p className="roadmap-objective">{hidden ? t('secretNote') : trophy.detail}</p>
          {hidden ? (
            <button type="button" className="quiet" onClick={() => setRevealed(true)}>
              {t('reveal')}
            </button>
          ) : (
            <>
              {trophy.progressValue != null && trophy.progressTarget != null && (
                <p className="roadmap-progress">
                  {t('progress', { value: trophy.progressValue, target: trophy.progressTarget })}
                </p>
              )}
              <TrophyAdvice trophy={trophy} game={game} />
              {trophy.hidden && !trophy.earned && (
                <button type="button" className="quiet" onClick={() => setRevealed(false)}>
                  {t('hide')}
                </button>
              )}
            </>
          )}
        </article>
      </details>
    </li>
  )
}

export function TrophyRoadmap({ game }: { game: CurrentGame }) {
  const t = useMessages(messages)
  const stages = trophyRoadmap(game.trophies, game.guide)
  const base = game.trophies.filter((x) => x.groupId === 'default')
  const done = base.some((x) => x.type === 'platinum' && x.earned)
  const focus = !done && !game.guide?.unobtainable ? game.focus?.trophy : undefined
  const ordered = stages.flatMap((s) => s.trophies)
  const suggested = ordered.find(
    (x) => !x.earned && x.id === focus?.id && x.groupId === focus.groupId,
  )
  const target = suggested ?? ordered.find((x) => !x.earned && x.type !== 'platinum')
  const jump = () => {
    if (!target) return
    const node = document.getElementById(anchor(target))
    const details = node?.querySelector('details')
    if (details) details.open = true
    node?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }
  return (
    <section className="trophy-roadmap" id="journey-roadmap" aria-labelledby="roadmap-heading">
      <header className="roadmap-intro">
        <span className="eyebrow">
          <Icon name="trophy" />
          {t('count', { earned: base.filter((x) => x.earned).length, total: base.length })}
        </span>
        <span className="roadmap-map-label">{t('map')}</span>
        <h2 id="roadmap-heading">{t('title')}</h2>
        <p>{t('subtitle')}</p>
        <details className="roadmap-basis">
          <summary>{t('order')}</summary>
          <p>{t('basis')}</p>
        </details>
        {target && (
          <button type="button" className="button" onClick={jump}>
            {suggested ? t('jump') : t('first')}
            <Icon name="chevron-down" />
          </button>
        )}
        <JourneyLink className="roadmap-ask" to={nexoHref(game.np, game.name)}>
          <Icon name="nexo" />
          {t('talk')}
        </JourneyLink>
      </header>
      {!stages.length && <p>{t('empty')}</p>}
      {stages.map((stage, i) => (
        <section
          className={`roadmap-stage roadmap-stage-${stage.kind}`}
          key={`${stage.kind}-${anchor(stage.trophies[0])}`}
        >
          <header className="roadmap-stage-heading">
            <span className="roadmap-stage-marker" aria-hidden="true">
              {stage.kind === 'platinum' ? <Icon name="trophy" /> : i + 1}
            </span>
            <div>
              <span className="eyebrow">{t('phase', { number: i + 1 })}</span>
              <h3>{stage.kind === 'phase' ? stage.name : t(stage.kind)}</h3>
              {stage.kind !== 'phase' && <p>{t(`${stage.kind}Note`)}</p>}
            </div>
            <span className="roadmap-stage-count">
              {stage.trophies.filter((x) => x.earned).length} / {stage.trophies.length}
            </span>
          </header>
          <ol className="roadmap-trail">
            {stage.trophies.map((trophy) => (
              <TrophyStep
                key={`${trophy.groupId}-${trophy.id}`}
                trophy={trophy}
                game={game}
                suggested={suggested === trophy}
              />
            ))}
          </ol>
        </section>
      ))}
    </section>
  )
}

export function TrophyRoadmapSkeleton() {
  return (
    <section className="trophy-roadmap" aria-hidden="true">
      <header className="roadmap-intro">
        <Sk w="45%" h={12} />
        <Sk w="75%" h={40} />
        <Sk w="90%" h={18} />
        <Sk w="60%" h={18} />
      </header>
      <div className="roadmap-stage">
        <div className="roadmap-stage-heading">
          <Sk w="40px" h={40} />
          <Sk w="60%" h={28} />
        </div>
        <ol className="roadmap-trail">
          {[0, 1, 2].map((id) => (
            <li className="roadmap-step" key={id}>
              <div className="roadmap-leg">
                <RoadmapPath />
                <span className="roadmap-node">
                  <Sk w="44px" h={44} />
                </span>
                <span className="roadmap-node-label">
                  <Sk w="70%" h={12} />
                  <Sk w="95%" h={20} />
                  <Sk w="50%" h={12} />
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
