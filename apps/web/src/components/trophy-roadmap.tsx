import { useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { type TrophyStage, trophyAdvice, trophyRoadmap } from '../lib/trophy-roadmap'
import type { CurrentGame, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { GuideText } from '../ui/markdown'
import { Sk } from '../ui/skeleton'
import { TrophyArt } from '../ui/trophy-art'
import { image } from './game-showcase'
import { JourneyLink } from './journey-link'
import { nexoHref } from './tip'
import './trophy-roadmap.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'O caminho à frente',
    chapters: 'Percurso completo',
    ahead: 'Caminho à frente',
    past: '{count} conquistas nesta etapa',
    stageDone: 'Etapa concluída',
    previous: 'Marco anterior',
    next: 'Próximo marco',
    explore: 'Selecione um marco para ver a orientação.',
    resume: 'Voltar à sugestão',
    selected: 'Desafio em foco',
    guidance: 'Seu objetivo',
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
      'Estes troféus não têm uma correspondência única nas fases do guia. Esses marcos seguem a lista PSN, não uma recomendação.',
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
    title: 'The path ahead',
    chapters: 'Complete route',
    ahead: 'The road ahead',
    past: '{count} achievements in this stage',
    stageDone: 'Stage complete',
    previous: 'Previous milestone',
    next: 'Next milestone',
    explore: 'Select a milestone to read its guidance.',
    resume: 'Return to suggestion',
    selected: 'Challenge in focus',
    guidance: 'Your objective',
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
      'These trophies do not have a unique match in the guide phases. These milestones follow the PSN list, not a recommendation.',
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
  return (
    <article
      className={`roadmap-content roadmap-step${suggested ? ' is-suggested' : ''}`}
      id="roadmap-advice"
    >
      <header className="roadmap-trophy-heading">
        <Icon name="nexo" />
        <h4>{trophy.hidden && !hidden ? trophy.name : t('guidance')}</h4>
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
  )
}

function RoadmapLandscape({
  game,
  selected,
  stage,
  stageIndex,
  suggested,
}: {
  game: CurrentGame
  selected: Trophy
  stage: TrophyStage
  stageIndex: number
  suggested: boolean
}) {
  const t = useMessages(messages)
  const hidden = selected.hidden && !selected.earned
  const stageName = (s: TrophyStage) => (s.kind === 'phase' ? s.name || t('phaseName') : t(s.kind))
  const art =
    game.game.art_url ??
    (game.game.screenshot_ids?.[0]
      ? image(game.game.screenshot_ids[0], 't_1080p')
      : game.game.cover_url)
  const [failedArt, setFailedArt] = useState<string | null>(null)
  return (
    <div className="roadmap-landscape">
      {art && failedArt !== art && (
        <img className="roadmap-scene" src={art} alt="" onError={() => setFailedArt(art)} />
      )}
      <div className="roadmap-horizon" aria-hidden="true" />
      <div className="roadmap-chapter-caption">
        <span>{t('phase', { number: String(stageIndex + 1).padStart(2, '0') })}</span>
        <span>{stageName(stage)}</span>
      </div>
      <div className="roadmap-destination" key={anchor(selected)}>
        <span className="roadmap-destination-art">
          <TrophyArt url={hidden ? undefined : selected.iconUrl} />
        </span>
        <span className="roadmap-destination-copy">
          <span className="roadmap-state">
            {selected.earned ? t('earned') : suggested ? t('suggestion') : t('selected')}
          </span>
          <h3>{hidden ? t('secret') : selected.name}</h3>
          <span className="roadmap-destination-type">
            {t(selected.type === 'platinum' ? 'platinumType' : selected.type)}
          </span>
        </span>
      </div>
    </div>
  )
}

function RoadmapForward({
  pending,
  selected,
  choose,
}: {
  pending: Trophy[]
  selected: Trophy
  choose: (trophy: Trophy) => void
}) {
  const t = useMessages(messages)
  const rail = useRef<HTMLOListElement>(null)
  const at = pending.indexOf(selected)
  const activeId = selected ? anchor(selected) : null
  useEffect(() => {
    const node = rail.current?.querySelector<HTMLElement>(`[data-trophy="${activeId}"]`)
    if (node) rail.current?.scrollTo?.({ left: node.offsetLeft - 24, behavior: 'auto' })
  }, [activeId])
  return (
    <div className="roadmap-forward">
      <div className="roadmap-forward-heading">
        <div>
          <h4>{pending.length ? t('ahead') : t('stageDone')}</h4>
          <p>{t('explore')}</p>
        </div>
        <div className="roadmap-route-controls">
          <button
            className="quiet"
            type="button"
            aria-label={t('previous')}
            disabled={at <= 0}
            onClick={() => choose(pending[at - 1])}
          >
            <Icon name="chevron-left" />
          </button>
          <button
            className="quiet"
            type="button"
            aria-label={t('next')}
            disabled={at >= pending.length - 1}
            onClick={() => choose(pending[Math.max(0, at + 1)])}
          >
            <Icon name="chevron-right" />
          </button>
        </div>
      </div>
      {!!pending.length && (
        <ol className="roadmap-route" ref={rail} aria-label={t('ahead')}>
          {pending.map((trophy, i) => (
            <li
              key={anchor(trophy)}
              data-trophy={anchor(trophy)}
              className={selected === trophy ? 'is-current' : ''}
            >
              <svg
                className="roadmap-route-line"
                viewBox="0 0 180 140"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d={i % 2 ? 'M17 29 C72 29 102 89 197 89' : 'M17 89 C72 89 102 29 197 29'} />
              </svg>
              <button
                type="button"
                aria-pressed={selected === trophy}
                onClick={() => choose(trophy)}
              >
                <span className="roadmap-route-pin">{String(i + 1).padStart(2, '0')}</span>
                <span>{trophy.hidden && !trophy.earned ? t('secret') : trophy.name}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
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
  const target =
    suggested ??
    ordered.find((x) => !x.earned && x.type !== 'platinum') ??
    ordered.find((x) => !x.earned) ??
    ordered.at(-1)
  const [selection, setSelection] = useState<string | null>(null)
  const selected = ordered.find((x) => anchor(x) === selection) ?? target
  const stageIndex = stages.findIndex((s) => selected && s.trophies.includes(selected))
  const stage = stages[stageIndex]
  const pending = ordered.filter((x) => !x.earned)
  const past = stage?.trophies.filter((x) => x.earned) ?? []
  const choose = (trophy: Trophy) => setSelection(anchor(trophy))
  const stageName = (s: (typeof stages)[number]) =>
    s.kind === 'phase' ? s.name || t('phaseName') : t(s.kind)
  return (
    <section className="trophy-roadmap" id="journey-roadmap" aria-labelledby="roadmap-heading">
      <header className="roadmap-intro">
        <div>
          <span className="eyebrow">{t('map')}</span>
          <h2 id="roadmap-heading">{t('title')}</h2>
        </div>
        <span className="roadmap-total">
          <Icon name="trophy" />
          {t('count', { earned: base.filter((x) => x.earned).length, total: base.length })}
        </span>
      </header>
      {!selected || !stage ? (
        <p>{t('empty')}</p>
      ) : (
        <>
          <details className="roadmap-chapters">
            <summary>
              <span>{t('chapters')}</span>
              <span>
                {stageIndex + 1} / {stages.length}
                <Icon name="chevron-down" />
              </span>
            </summary>
            <ol>
              {stages.map((s, i) => (
                <li key={`${s.kind}-${anchor(s.trophies[0])}`}>
                  <button
                    type="button"
                    aria-pressed={i === stageIndex}
                    onClick={() => choose(s.trophies.find((x) => !x.earned) ?? s.trophies[0])}
                  >
                    <span className="roadmap-chapter-number">{String(i + 1).padStart(2, '0')}</span>
                    <span>{stageName(s)}</span>
                    <small>
                      {s.trophies.filter((x) => x.earned).length}/{s.trophies.length}
                    </small>
                  </button>
                </li>
              ))}
            </ol>
          </details>
          <div className="roadmap-expedition">
            <RoadmapLandscape
              game={game}
              selected={selected}
              stage={stage}
              stageIndex={stageIndex}
              suggested={suggested === selected}
            />
            <RoadmapForward pending={pending} selected={selected} choose={choose} />
            <TrophyStep
              key={anchor(selected)}
              trophy={selected}
              game={game}
              suggested={suggested === selected}
            />
            {!!past.length && (
              <details className="roadmap-past">
                <summary>
                  <Icon name="check" />
                  {t('past', { count: past.length })}
                  <Icon name="chevron-down" />
                </summary>
                <ul>
                  {past.map((trophy) => (
                    <li key={anchor(trophy)}>
                      <button
                        type="button"
                        aria-pressed={selected === trophy}
                        onClick={() => choose(trophy)}
                      >
                        <Icon name="check" />
                        <span>{trophy.name}</span>
                        <Icon name="chevron-right" />
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          {stage.kind !== 'phase' && (
            <p className="roadmap-context-note">{t(`${stage.kind}Note`)}</p>
          )}
          <footer className="roadmap-footer">
            {target && selected !== target && (
              <button type="button" className="quiet" onClick={() => choose(target)}>
                {t('resume')}
              </button>
            )}
            <JourneyLink className="roadmap-ask" to={nexoHref(game.np, game.name)}>
              <Icon name="nexo" />
              {t('talk')}
            </JourneyLink>
            <details className="roadmap-basis">
              <summary>{t('order')}</summary>
              <p>{t('basis')}</p>
            </details>
          </footer>
        </>
      )}
    </section>
  )
}

export function TrophyRoadmapSkeleton() {
  return (
    <section className="trophy-roadmap" aria-hidden="true">
      <header className="roadmap-intro">
        <div>
          <Sk w="110px" h={12} />
          <Sk w="200px" h={28} />
        </div>
        <Sk w="150px" h={14} />
      </header>
      <div className="roadmap-chapters">
        <Sk w="60%" h={24} />
      </div>
      <div className="roadmap-expedition">
        <div className="roadmap-landscape">
          <div className="roadmap-chapter-caption">
            <Sk w="80%" h={16} />
          </div>
          <div className="roadmap-destination">
            <Sk w="64px" h={64} />
            <span className="roadmap-destination-copy">
              <Sk w="60%" h={12} />
              <Sk w="90%" h={32} />
              <Sk w="30%" h={12} />
            </span>
          </div>
        </div>
        <div className="roadmap-forward">
          <Sk w="55%" h={20} />
          <div className="roadmap-route">
            <Sk w="100%" h={160} />
          </div>
        </div>
        <div className="roadmap-content">
          <Sk w="65%" h={24} />
          <Sk w="100%" h={16} />
          <Sk w="90%" h={16} />
          <Sk w="75%" h={16} />
        </div>
      </div>
    </section>
  )
}
