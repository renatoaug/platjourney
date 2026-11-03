import { useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { trophyAdvice, trophyRoadmap } from '../lib/trophy-roadmap'
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
    ahead: 'Caminho à frente',
    past: 'Conquistas anteriores ({count})',
    stageDone: 'Caminho concluído',
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
    missable: 'Perdível',
    finale: 'Platina',
    order: 'Como este caminho é definido',
    subtitle:
      'Todos os troféus conectados ao roteiro. Cada conquista acompanha seu progresso na PSN.',
    basis:
      'Ordem sugerida pelo guia, não uma sequência garantida. Objetivos podem ser feitos em paralelo; sua posição no jogo não é confirmada pelos troféus.',
    count: '{earned} de {total} conquistados no jogo base',
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
    note: 'Orientação do Nexo',
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
    ahead: 'The road ahead',
    past: 'Previous achievements ({count})',
    stageDone: 'Path complete',
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
    missable: 'Missable',
    finale: 'Platinum',
    order: 'How this path is defined',
    subtitle: 'Every trophy connected to the roadmap. Each achievement follows your PSN progress.',
    basis:
      'Suggested guide order, not a guaranteed sequence. Objectives can run in parallel; trophies do not confirm your location in the game.',
    count: '{earned} of {total} earned in the base game',
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
    note: 'Nexo guidance',
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

const roadCurves = ['M48 96 C110 96 166 56 228 56', 'M48 56 C110 56 166 96 228 96']

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
        <Icon name="target" />
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
  suggested,
}: {
  game: CurrentGame
  selected: Trophy
  suggested: boolean
}) {
  const t = useMessages(messages)
  const hidden = selected.hidden && !selected.earned
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

function RoadmapSignal({ missable, final }: { missable: boolean; final: boolean }) {
  const t = useMessages(messages)
  if (missable)
    return (
      <span className="roadmap-route-risk">
        <Icon name="warning" />
        {t('missable')}
      </span>
    )
  if (final)
    return (
      <span className="roadmap-route-finale">
        <Icon name="trophy" />
        {t('finale')}
      </span>
    )
  return null
}

function RoadmapForward({
  pending,
  selected,
  choose,
  game,
}: {
  game: CurrentGame
  pending: Trophy[]
  selected: Trophy
  choose: (trophy: Trophy) => void
}) {
  const t = useMessages(messages)
  const rail = useRef<HTMLOListElement>(null)
  const at = pending.indexOf(selected)
  const activeId = selected ? anchor(selected) : null
  useEffect(() => {
    const track = rail.current
    if (!track) return
    const place = () => {
      const node = track.querySelector<HTMLElement>(`[data-trophy="${activeId}"]`)
      if (node)
        track.scrollTo?.({
          left: Math.min(node.offsetLeft, Math.max(0, track.scrollWidth - track.clientWidth)),
          behavior: 'auto',
        })
    }
    place()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    observer?.observe(track)
    return () => observer?.disconnect()
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
          {pending.map((trophy, i) => {
            const hidden = trophy.hidden
            const current = selected === trophy
            const missable = !hidden && !!trophyAdvice(trophy, game.guide).warning
            const final = trophy.type === 'platinum'
            const path = roadCurves[i % 2]
            return (
              <li
                key={anchor(trophy)}
                data-trophy={anchor(trophy)}
                className={current ? 'is-current' : ''}
                data-missable={missable}
                data-final={final}
              >
                <svg
                  className="roadmap-route-line"
                  viewBox="0 0 180 150"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path className="roadmap-road-bed" d={path} />
                  <path className="roadmap-road-edge" d={path} />
                  <path className="roadmap-road-trail" d={path} />
                </svg>
                <button
                  type="button"
                  aria-pressed={current}
                  tabIndex={current ? 0 : -1}
                  onClick={() => choose(trophy)}
                >
                  <span className="roadmap-route-pin">
                    <span className="roadmap-route-art">
                      <TrophyArt url={hidden ? undefined : trophy.iconUrl} />
                    </span>
                    <span className="roadmap-route-number" aria-hidden="true">
                      {final ? <Icon name="trophy" /> : String(i + 1).padStart(2, '0')}
                    </span>
                  </span>
                  <span className="roadmap-route-caption">
                    <span className="roadmap-route-name">{hidden ? t('secret') : trophy.name}</span>
                    <RoadmapSignal missable={missable} final={final} />
                  </span>
                </button>
              </li>
            )
          })}
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
  const past = ordered.filter((x) => x.earned)
  const choose = (trophy: Trophy) => setSelection(anchor(trophy))
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
          <div className="roadmap-expedition">
            <RoadmapLandscape game={game} selected={selected} suggested={suggested === selected} />
            <RoadmapForward game={game} pending={pending} selected={selected} choose={choose} />
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
                        aria-label={trophy.name}
                        aria-describedby={
                          trophy.detail ? `${anchor(trophy)}-earned-detail` : undefined
                        }
                        onClick={() => choose(trophy)}
                      >
                        <span className="roadmap-earned-art">
                          <TrophyArt url={trophy.iconUrl} />
                          <span className="roadmap-earned-check">
                            <Icon name="check" />
                          </span>
                        </span>
                        <span className="roadmap-earned-copy">
                          <strong>{trophy.name}</strong>
                          {trophy.detail && (
                            <span id={`${anchor(trophy)}-earned-detail`}>{trophy.detail}</span>
                          )}
                        </span>
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
      <div className="roadmap-expedition">
        <div className="roadmap-landscape">
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
          <div className="roadmap-forward-heading roadmap-loading-heading">
            <div>
              <Sk w="65%" h={18} />
              <p>
                <Sk w="90%" h={14} />
              </p>
            </div>
            <span className="roadmap-route-controls">
              <Sk w="44px" h={44} />
              <Sk w="44px" h={44} />
            </span>
          </div>
          <div className="roadmap-route roadmap-route-loading">
            {[0, 1, 2].map((step) => (
              <div key={step} className="roadmap-loading-stop">
                <span className="roadmap-loading-art">
                  <Sk w="80px" h={80} style={{ borderRadius: 'var(--radius-round)' }} />
                </span>
                <Sk w="85%" h={18} />
                <Sk w="55%" h={14} />
              </div>
            ))}
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
