import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { evaluateJourney } from '../../../../shared/journey/model'
import { reviewedJourney } from '../../../../shared/journey/registry'
import { defineMessages, getLocale, Language, useMessages } from '../i18n/i18n'
import { roadPoint, roadSegment } from '../lib/roadmap-motion'
import { ongoingObjectives, trophyAdvice, trophyRoadmap } from '../lib/trophy-roadmap'
import type { CurrentGame, Trophy } from '../lib/types'
import { useGameSpoilers } from '../lib/use-game-spoilers'
import { Icon } from '../ui/icon'
import { GuideText } from '../ui/markdown'
import { Sk } from '../ui/skeleton'
import { toast } from '../ui/toast'
import { TrophyArt } from '../ui/trophy-art'
import { image } from './game-showcase'
import { JourneyLink } from './journey-link'
import { nexoHref } from './tip'
import './trophy-roadmap.css'

type RoadmapGame = Pick<CurrentGame, 'game' | 'name' | 'np' | 'trophies' | 'guide' | 'focus'> & {
  /** Catalog chat keeps game:id; the PSN edition is a separate identity. */
  edition?: string
  journey?: ReturnType<typeof evaluateJourney<Trophy>>
}

const messages = defineMessages({
  [Language.PtBR]: {
    reviewed: 'Roteiro revisado · {name}',
    routeView: 'Visualização da rota',
    routeJump: 'Explorar objetivo',
    routeChoose: 'Escolha um objetivo',
    routePosition: 'Marco {index} de {total}',
    routeNow: 'Voltar ao próximo objetivo',
    routeExtras: 'A rota inclui {count} troféus adicionais após a platina.',
    routePending: 'Pendentes · {count}',
    routeAll: 'Rota completa · {count}',
    routeComplete: 'Rota completa',
    routeReference:
      'Ordem de referência do roteiro, não a sequência em que você conquistou os troféus.',
    routeEarned: 'Conquistado',
    quickRead: 'Seu próximo movimento',
    nextObjective: 'Prioridade sugerida',
    upcomingObjectives: 'Depois, avalie',
    viewObjective: 'Ver objetivo: {name}',
    chapterWhen: 'Capítulo {chapter} · confira seu save',
    recoverWhen: 'Recuperação · capítulo {chapter}',
    parallelWhen: 'Ao longo da jornada · em paralelo',
    postWhen: 'Pós-campanha · conferir progressão',
    unknownWhen: 'Conferir disponibilidade no jogo',
    quickNote: 'Isto organiza suas opções, sem prometer quando cada troféu será desbloqueado.',
    reviewedBasis:
      'Base revisada para esta edição: oportunidades por capítulo, preparação e recuperação. Novas conquistas reavaliam a sugestão, sem mudar a ordem de referência nem inferir sua posição. ',
    known:
      'Capítulo {chapter} concluído na PSN. Sua posição atual e o estado do save não são informados.',
    unknown:
      'Sem marco de capítulo confirmado. A rota inicial é uma referência; não pressupõe que você nunca jogou.',
    incomplete:
      'A lista recebida não corresponde a todos os objetivos revisados. A sugestão personalizada ficará disponível quando estiver completa.',
    openWorldBasis:
      'Objetivos paralelos do jogo base. Novas conquistas atualizam a sugestão; a ordem é uma referência, não um trajeto obrigatório. DLC fica separado.',
    openWorldKnown:
      'Conquistas confirmadas orientam a sugestão. Sua região, nível, inventário e missões abertas continuam desconhecidos.',
    checkState:
      'Confira a disponibilidade no seu diário ou menu do jogo antes de planejar esta ação.',
    quest: 'Oportunidades durante missões',
    preparationNote:
      'Escolha um objetivo para ver a ação e os requisitos a conferir. Não há contador presumido nem checklist obrigatório.',
    preparation: 'Prepare enquanto avança',
    collectible: 'Exploração e colecionáveis',
    upgrade: 'Ferramentas e melhorias',
    skill: 'Habilidades que ainda faltam',
    counterGroup: 'Ações que acumulam progresso',
    sources: 'Fontes e recuperação',
    completeState: 'Conquista confirmada pela PSN.',
    availableState:
      'Oportunidade para planejar agora; confira se esse trecho corresponde ao seu save.',
    prepareState: 'Prepare durante a campanha; o desbloqueio pode acontecer mais tarde.',
    laterState:
      'Mais adiante na referência de roteiro. Não é uma afirmação de bloqueio no seu save.',
    recoverState: 'Há um marco posterior confirmado. Confira se precisa recuperar este objetivo.',
    verifyState:
      'Confira a sincronização e o save antes de repetir um trecho. Não presumimos conquista nem perda.',
    title: 'O caminho à frente',
    ongoing: 'Ao longo da jornada',
    ongoingNote:
      'Cuide destes objetivos enquanto avança. A seleção da trilha não indica sua posição real no jogo.',
    repeated: 'Citado em vários pontos do roteiro',
    counter: 'Objetivo com contador da PSN',
    duration: 'Acompanhamento durante a campanha',
    early: 'Orientação para o início',
    counterProgress: 'PSN: {value} / {target}',
    previewStart: 'Ver desde o início',
    previewBack: 'Voltar ao meu progresso',
    previewLabel: 'PRÉVIA DO INÍCIO',
    previewNote: 'Comparação sem progresso pessoal. Nenhuma conquista ou dado da conta é alterado.',
    catalogCount: '{total} troféus no jogo base · sem progresso pessoal',
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
    reveal: 'Revelar ocultos',
    hide: 'Ocultar segredos',
    revealScope: 'Preferência deste jogo salva na sua conta.',
    revealFailed: 'Não foi possível salvar a preferência. Tente novamente.',
    progress: 'Progresso informado pela PSN: {value} / {target}',
    empty:
      'Os troféus ainda não estão disponíveis. O roteiro aparece quando a sincronização os trouxer.',
    bronze: 'Bronze',
    silver: 'Prata',
    gold: 'Ouro',
    platinumType: 'Platina',
  },
  [Language.En]: {
    reviewed: 'Reviewed roadmap · {name}',
    routeView: 'Route view',
    routeJump: 'Explore objective',
    routeChoose: 'Choose an objective',
    routePosition: 'Milestone {index} of {total}',
    routeNow: 'Return to the next objective',
    routeExtras: 'The route includes {count} additional trophies after the platinum.',
    routePending: 'Pending · {count}',
    routeAll: 'Full route · {count}',
    routeComplete: 'Full route',
    routeReference: 'Roadmap reference order, not the sequence in which you earned trophies.',
    routeEarned: 'Earned',
    quickRead: 'Your next move',
    nextObjective: 'Suggested priority',
    upcomingObjectives: 'Then consider',
    viewObjective: 'View objective: {name}',
    chapterWhen: 'Chapter {chapter} · check your save',
    recoverWhen: 'Recovery · chapter {chapter}',
    parallelWhen: 'Throughout the journey · in parallel',
    postWhen: 'After the story · check progression',
    unknownWhen: 'Check availability in your game',
    quickNote: 'This organizes your options without promising when each trophy will unlock.',
    reviewedBasis:
      'Reviewed knowledge for this edition: chapter opportunities, preparation and recovery. New unlocks re-evaluate the suggestion without changing the reference order or inferring your location. ',
    known:
      'Chapter {chapter} completed on PSN. Your current location and save state are not reported.',
    unknown:
      'No confirmed chapter milestone. The opening route is a reference, not an assumption that you have never played.',
    incomplete:
      'The received list does not match all reviewed objectives. Personalized guidance will be available once it is complete.',
    openWorldBasis:
      'Parallel base-game objectives. New unlocks update the suggestion; the order is a reference, not a mandatory route. DLC stays separate.',
    openWorldKnown:
      'Confirmed unlocks inform the suggestion. Your region, level, inventory and open quests remain unknown.',
    checkState: 'Check availability in your journal or game menu before planning this action.',
    quest: 'Opportunities during quests',
    preparationNote:
      'Choose an objective to see its action and requirements to check. No presumed counter or mandatory checklist.',
    preparation: 'Prepare as you go',
    collectible: 'Exploration and collectibles',
    upgrade: 'Tools and upgrades',
    skill: 'Remaining skills',
    counterGroup: 'Actions that accumulate progress',
    sources: 'Sources and recovery',
    completeState: 'Achievement confirmed by PSN.',
    availableState: 'An opportunity to plan now; check whether this section matches your save.',
    prepareState: 'Prepare during the campaign; the unlock may come later.',
    laterState: 'Later in the reference route. This does not assert a lock in your save.',
    recoverState:
      'A later milestone is confirmed. Check whether you need to recover this objective.',
    verifyState:
      'Check synchronization and your save before replaying a section. We presume neither completion nor loss.',
    title: 'The path ahead',
    ongoing: 'Throughout the journey',
    ongoingNote:
      'Keep these objectives in mind as you play. Selecting a milestone does not indicate your actual location in the game.',
    repeated: 'Mentioned at several points in the roadmap',
    counter: 'Objective with a PSN counter',
    duration: 'Follow throughout the campaign',
    early: 'Guidance for the start',
    counterProgress: 'PSN: {value} / {target}',
    previewStart: 'Preview from the start',
    previewBack: 'Return to my progress',
    previewLabel: 'START PREVIEW',
    previewNote:
      'Comparison without personal progress. No achievements or account data are changed.',
    catalogCount: '{total} base-game trophies · no personal progress',
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
    reveal: 'Reveal hidden trophies',
    hide: 'Hide secrets',
    revealScope: 'This game’s preference saved to your account.',
    revealFailed: 'Could not save this preference. Try again.',
    progress: 'Progress reported by PSN: {value} / {target}',
    empty: 'Trophies are not available yet. The roadmap appears once they have been synced.',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinumType: 'Platinum',
  },
})

const anchor = (trophy: Trophy) => `roadmap-${encodeURIComponent(trophy.groupId)}-${trophy.id}`

function TrophyAdvice({ trophy, game }: { trophy: Trophy; game: RoadmapGame }) {
  const t = useMessages(messages)
  const reviewed = game.journey?.items.find((x) => x.trophy === trophy)
  const language = getLocale() === Language.En ? 'en' : 'pt'
  const advice = trophyAdvice(trophy, game.guide)
  if (reviewed)
    return (
      <div className="roadmap-advice">
        <span className="roadmap-advice-label">
          <Icon name="nexo" />
          {t('note')}
        </span>
        <p className="roadmap-context-note">{t(`${reviewed.state}State`)}</p>
        <p>{reviewed.objective.action[language]}</p>
        {reviewed.objective.approach && <p>{reviewed.objective.approach[language]}</p>}
        {reviewed.objective.availability && <p>{reviewed.objective.availability[language]}</p>}
        {reviewed.objective.recovery && reviewed.state !== 'complete' && (
          <p>{reviewed.objective.recovery[language]}</p>
        )}
        <details className="roadmap-basis">
          <summary>{t('sources')}</summary>
          <ul>
            {reviewed.objective.sources.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {new URL(url).hostname}
                </a>
              </li>
            ))}
          </ul>
        </details>
        <JourneyLink className="roadmap-ask" to={nexoHref(game.np, game.name, trophy.name)}>
          <Icon name="nexo" />
          {t('ask')}
        </JourneyLink>
      </div>
    )
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
  game: RoadmapGame
  suggested: boolean
}) {
  const t = useMessages(messages)
  const hidden = trophy.hidden && !trophy.earned
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
      {!hidden && (
        <>
          {trophy.progressValue != null && trophy.progressTarget != null && (
            <p className="roadmap-progress">
              {t('progress', { value: trophy.progressValue, target: trophy.progressTarget })}
            </p>
          )}
          <TrophyAdvice trophy={trophy} game={game} />
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
  game: RoadmapGame
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

function RoadmapOverview({
  game,
  choose,
}: {
  game: RoadmapGame
  choose: (trophy: Trophy) => void
}) {
  const t = useMessages(messages)
  const plan = game.journey
  if (!plan || plan.covered !== plan.expected || plan.unmatched.length) return null
  const candidates = plan.candidates.filter((x) => !x.trophy.hidden).slice(0, 4)
  if (!candidates.length) return null
  const when = (item: (typeof candidates)[number]) => {
    const o = item.objective
    if (o.chapter)
      return t(item.state === 'recover' ? 'recoverWhen' : 'chapterWhen', { chapter: o.chapter })
    if (o.kind === 'skill' && plan.storyComplete) return t('postWhen')
    if (item.state === 'prepare') return t('parallelWhen')
    return t('unknownWhen')
  }
  return (
    <section className="roadmap-overview" aria-label={t('quickRead')}>
      <h3>{t('quickRead')}</h3>
      <ol>
        {candidates.map((item, index) => (
          <li key={item.objective.key}>
            <button
              type="button"
              aria-label={t('viewObjective', { name: item.trophy.name })}
              onClick={() => choose(item.trophy)}
            >
              <span className="roadmap-overview-art">
                <TrophyArt url={item.trophy.iconUrl} />
              </span>
              <span>
                <small>{t(index === 0 ? 'nextObjective' : 'upcomingObjectives')}</small>
                <strong>{item.trophy.name}</strong>
                <span>{when(item)}</span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ol>
      <p>{t('quickNote')}</p>
    </section>
  )
}

function RoadmapNavigation({
  game,
  ordered,
  pending,
  selected,
  target,
  choose,
}: {
  game: RoadmapGame
  ordered: Trophy[]
  pending: Trophy[]
  selected: Trophy
  target?: Trophy
  choose: (trophy: Trophy) => void
}) {
  const [complete, setComplete] = useState(false)
  return (
    <>
      <RoadmapViewControls
        complete={complete}
        pending={pending.length}
        total={ordered.length}
        onChange={(full) => {
          setComplete(full)
          if (!full && target) choose(target)
        }}
      />
      <RoadmapJump
        route={complete ? ordered : pending}
        ordered={ordered}
        selected={selected}
        target={target}
        choose={choose}
        resume={() => {
          setComplete(false)
          if (target) choose(target)
        }}
      />
      <RoadmapForward
        key={String(complete)}
        game={game}
        pending={complete ? ordered : pending}
        order={ordered}
        complete={complete}
        selected={selected}
        choose={choose}
      />
    </>
  )
}

function RoadmapJump({
  route,
  ordered,
  selected,
  target,
  choose,
  resume,
}: {
  route: Trophy[]
  ordered: Trophy[]
  selected: Trophy
  target?: Trophy
  choose: (trophy: Trophy) => void
  resume: () => void
}) {
  const t = useMessages(messages)
  const position = ordered.indexOf(selected)
  const extras = ordered.filter((x) => (x.groupId ?? 'default') !== 'default').length
  return (
    <div className="roadmap-jump">
      <label>
        <span>{t('routeJump')}</span>
        <select
          value={route.includes(selected) ? anchor(selected) : ''}
          onChange={(event) => {
            const trophy = route.find((x) => anchor(x) === event.target.value)
            if (trophy) choose(trophy)
          }}
        >
          <option value="" disabled>
            {t('routeChoose')}
          </option>
          {route.map((x) => (
            <option key={anchor(x)} value={anchor(x)}>
              {ordered.indexOf(x) + 1} · {x.hidden && !x.earned ? t('secret') : x.name} ·{' '}
              {t(x.earned ? 'earned' : 'pending')}
            </option>
          ))}
        </select>
      </label>
      <div className="roadmap-jump-status">
        {position >= 0 && (
          <span aria-live="polite">
            {t('routePosition', { index: position + 1, total: ordered.length })}
          </span>
        )}
        {target && selected !== target && (
          <button type="button" className="ghost" onClick={resume}>
            <Icon name="target" />
            {t('routeNow')}
          </button>
        )}
      </div>
      {extras > 0 && <p>{t('routeExtras', { count: extras })}</p>}
    </div>
  )
}

function RoadmapViewControls({
  complete,
  pending,
  total,
  onChange,
}: {
  complete: boolean
  pending: number
  total: number
  onChange: (full: boolean) => void
}) {
  const t = useMessages(messages)
  return (
    <div className="roadmap-view-controls">
      <fieldset aria-label={t('routeView')}>
        <button
          type="button"
          className="quiet"
          aria-pressed={!complete}
          onClick={() => onChange(false)}
        >
          {t('routePending', { count: pending })}
        </button>
        <button
          type="button"
          className="quiet"
          aria-pressed={complete}
          onClick={() => onChange(true)}
        >
          {t('routeAll', { count: total })}
        </button>
      </fieldset>
      {complete && <p>{t('routeReference')}</p>}
    </div>
  )
}

function RouteNumber({ trophy, index }: { trophy: Trophy; index: number }) {
  if (trophy.earned) return <Icon name="check" />
  if (trophy.type === 'platinum') return <Icon name="trophy" />
  return String(index + 1).padStart(2, '0')
}

function RoadmapForward({
  pending,
  selected,
  choose,
  game,
  complete = false,
  order,
}: {
  game: RoadmapGame
  pending: Trophy[]
  selected: Trophy
  choose: (trophy: Trophy) => void
  complete?: boolean
  order: Trophy[]
}) {
  const t = useMessages(messages)
  const rail = useRef<HTMLOListElement>(null)
  const position = useRef<number | null>(null)
  const at = pending.indexOf(selected)
  useLayoutEffect(() => {
    const track = rail.current
    if (!track) return
    let frame = 0
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const place = (resizing = false) => {
      cancelAnimationFrame(frame)
      const first = track.querySelector<HTMLElement>('li')
      const width = first?.getBoundingClientRect().width || first?.offsetWidth || 0
      if (!width || !track.clientWidth) return
      const columns = Math.max(1, Math.round(track.clientWidth / width))
      const page = Math.floor(Math.max(0, at) / columns)
      const tail = (columns - (pending.length % columns)) % columns
      track.style.setProperty('--roadmap-tail', `${tail * width}px`)
      track.querySelectorAll<SVGSVGElement>('.roadmap-route-line').forEach((svg, index) => {
        svg.setAttribute('viewBox', `0 0 ${width} 150`)
        svg.querySelectorAll('path').forEach((path) => {
          path.setAttribute('d', roadSegment(index, width))
        })
      })
      const paint = (value: number, scroll: number) => {
        position.current = value
        const point = roadPoint(value, width)
        track.style.setProperty('--roadmap-cursor-x', `${point.x - 6}px`)
        track.style.setProperty('--roadmap-cursor-y', `${point.y - 6}px`)
        track.scrollTo?.({ left: scroll, behavior: 'auto' })
        track.dataset.positioned = 'true'
      }
      const destination = Math.max(0, at)
      const targetScroll = page * columns * width
      if (position.current === null || resizing || motion.matches) {
        paint(destination, targetScroll)
        return
      }
      const from = position.current
      const scrollFrom = track.scrollLeft
      const start = performance.now()
      const tick = (now: number) => {
        const fraction = Math.min(1, Math.max(0, (now - start) / 240))
        paint(
          from + (destination - from) * fraction,
          scrollFrom + (targetScroll - scrollFrom) * fraction,
        )
        if (fraction < 1) frame = requestAnimationFrame(tick)
      }
      paint(from, scrollFrom)
      frame = requestAnimationFrame(tick)
    }
    place()
    let measured = `${track.clientWidth}:${track.querySelector<HTMLElement>('li')?.offsetWidth}`
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            const size = `${track.clientWidth}:${track.querySelector<HTMLElement>('li')?.offsetWidth}`
            if (size === measured) return
            measured = size
            place(true)
          })
    const reduce = () => {
      if (motion.matches) place(true)
    }
    motion.addEventListener('change', reduce)
    observer?.observe(track)
    if (track.firstElementChild) observer?.observe(track.firstElementChild)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      motion.removeEventListener('change', reduce)
    }
  }, [at, pending.length])
  return (
    <div className="roadmap-forward">
      <div className="roadmap-forward-heading">
        <div>
          <h4>{complete ? t('routeComplete') : pending.length ? t('ahead') : t('stageDone')}</h4>
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
        <ol
          className="roadmap-route"
          ref={rail}
          aria-label={t(complete ? 'routeComplete' : 'ahead')}
        >
          {pending.map((trophy, i) => {
            const hidden = trophy.hidden && !trophy.earned
            const current = selected === trophy
            const missable = !hidden && !trophy.earned && !!trophyAdvice(trophy, game.guide).warning
            const final = trophy.type === 'platinum'
            const path = roadSegment(i, 180)
            return (
              <li
                key={anchor(trophy)}
                data-trophy={anchor(trophy)}
                className={current ? 'is-current' : ''}
                data-missable={missable}
                data-final={final}
                data-earned={trophy.earned}
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
                      <RouteNumber trophy={trophy} index={order.indexOf(trophy)} />
                    </span>
                  </span>
                  <span className="roadmap-route-caption">
                    <span className="roadmap-route-name">{hidden ? t('secret') : trophy.name}</span>
                    {trophy.earned ? (
                      <span className="roadmap-route-finale">{t('routeEarned')}</span>
                    ) : (
                      <RoadmapSignal missable={missable} final={final} />
                    )}
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

function ReviewedPreparation({
  game,
  choose,
}: {
  game: RoadmapGame
  choose: (trophy: Trophy) => void
}) {
  const t = useMessages(messages)
  const plan = game.journey
  if (!plan) return null
  const groups = ['quest', 'collectible', 'upgrade', 'skill', 'counter'] as const
  const language = getLocale() === Language.En ? 'en' : 'pt'
  const preparation =
    !plan.storyComplete &&
    plan.ongoing.find((x) => x.objective.key === 'explorer' && !x.trophy.hidden)
  return (
    <aside className="roadmap-reviewed" aria-label={t('reviewed', { name: plan.name })}>
      <strong>{t('reviewed', { name: plan.name })}</strong>
      <p>
        {plan.mode === 'open-world'
          ? t('openWorldKnown')
          : plan.confirmedChapter
            ? t('known', { chapter: plan.confirmedChapter })
            : t('unknown')}
      </p>
      {(plan.covered !== plan.expected || !!plan.unmatched.length) && <p>{t('incomplete')}</p>}
      {preparation && <p>{preparation.objective.action[language]}</p>}
      {plan.ongoing.some((x) => !x.trophy.hidden) && (
        <details>
          <summary>{t('preparation')}</summary>
          <p>{t('preparationNote')}</p>
          {groups.map((kind) => {
            const items = plan.ongoing.filter((x) => x.objective.kind === kind && !x.trophy.hidden)
            if (!items.length) return null
            return (
              <div className="roadmap-preparation-group" key={kind}>
                <h4>{t(kind === 'counter' ? 'counterGroup' : kind)}</h4>

                <div>
                  {items.map(({ trophy }) => (
                    <button
                      key={anchor(trophy)}
                      type="button"
                      className="quiet"
                      onClick={() => choose(trophy)}
                    >
                      {trophy.name}
                      {plan.items.find((x) => x.trophy === trophy)?.objective.risk ===
                        'opportunity' && (
                        <span className="roadmap-preparation-risk">
                          <Icon name="warning" />
                          {t('missable')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </details>
      )}
    </aside>
  )
}

const RoadmapOngoing = memo(function RoadmapOngoing({
  game,
  choose,
}: {
  game: RoadmapGame
  choose: (trophy: Trophy) => void
}) {
  const t = useMessages(messages)
  const objectives = useMemo(
    () => ongoingObjectives(game.trophies, game.guide),
    [game.trophies, game.guide],
  )
  if (!objectives.length) return null
  return (
    <aside className="roadmap-ongoing" aria-label={t('ongoing')}>
      <header>
        <Icon name="target" />
        <h4>{t('ongoing')}</h4>
      </header>
      <p>{t('ongoingNote')}</p>
      <ul>
        {objectives.map(({ trophy, basis, warning, early }) => (
          <li key={anchor(trophy)} data-missable={!!warning}>
            <button
              type="button"
              className="roadmap-ongoing-select"
              onClick={() => choose(trophy)}
              aria-label={trophy.name}
            >
              <span className="roadmap-ongoing-art">
                <TrophyArt url={trophy.iconUrl} />
              </span>
              <span>
                <strong>{trophy.name}</strong>
                <small>{t(basis)}</small>
              </span>
              <Icon name="chevron-right" />
            </button>
            {early && (
              <p>
                <GuideText text={early} />
              </p>
            )}
            {warning && (
              <p className="roadmap-ongoing-warning">
                <Icon name="warning" />
                <GuideText text={warning.when} />
              </p>
            )}
            {trophy.progressValue != null &&
              trophy.progressTarget != null &&
              trophy.progressValue >= 0 &&
              trophy.progressValue <= trophy.progressTarget && (
                <p className="roadmap-ongoing-progress">
                  {t('counterProgress', {
                    value: trophy.progressValue,
                    target: trophy.progressTarget,
                  })}
                </p>
              )}
          </li>
        ))}
      </ul>
    </aside>
  )
})

function RoadmapVisibility({
  revealed,
  setRevealed,
  saving,
}: {
  revealed: boolean
  setRevealed: (value: boolean) => Promise<void>
  saving: boolean
}) {
  const t = useMessages(messages)
  return (
    <button
      type="button"
      className="quiet"
      aria-pressed={revealed}
      disabled={saving}
      aria-busy={saving}
      title={t('revealScope')}
      onClick={async () => {
        try {
          await setRevealed(!revealed)
        } catch {
          toast(t('revealFailed'))
        }
      }}
    >
      <Icon name="eye" />
      {t(revealed ? 'hide' : 'reveal')}
    </button>
  )
}

function roadmapView(source: RoadmapGame, inspecting: boolean, revealed: boolean): RoadmapGame {
  const projected = inspecting
    ? {
        ...source,
        focus: null,
        trophies: source.trophies.map((trophy) => ({
          ...trophy,
          earned: false,
          earnedAt: undefined,
          progressValue: undefined,
          progressRate: undefined,
        })),
      }
    : source
  return revealed
    ? { ...projected, trophies: projected.trophies.map((trophy) => ({ ...trophy, hidden: false })) }
    : projected
}

function roadmapBasis(game: RoadmapGame) {
  return game.journey?.mode === 'open-world'
    ? 'openWorldBasis'
    : game.journey
      ? 'reviewedBasis'
      : 'basis'
}

function roadmapFocus(game: RoadmapGame, done: boolean) {
  if (done || game.guide?.unobtainable) return undefined
  const plan = game.journey
  if (!plan) return game.focus?.trophy
  return plan.covered === plan.expected && !plan.unmatched.length ? plan.next?.trophy : undefined
}

export function TrophyRoadmap({
  game: source,
  preview = false,
}: {
  game: RoadmapGame
  preview?: boolean
}) {
  const t = useMessages(messages)
  const [fromStart, setFromStart] = useState(false)
  const { revealed, setRevealed, saving } = useGameSpoilers(source.game.id)
  const inspecting = preview || fromStart
  const projected = useMemo(
    () => roadmapView(source, inspecting, revealed),
    [source, inspecting, revealed],
  )
  const game = useMemo(() => {
    const model = reviewedJourney({
      ...projected.game,
      np: projected.edition ?? (projected.np.startsWith('game:') ? undefined : projected.np),
    })
    return model ? { ...projected, journey: evaluateJourney(model, projected.trophies) } : projected
  }, [projected])
  const stages = useMemo(() => {
    if (!game.journey) return trophyRoadmap(game.trophies, game.guide)
    const ordered = game.journey.items
      .filter((x) => x.objective.kind !== 'platinum')
      .map((x) => x.trophy)
    return [
      { kind: 'phase' as const, trophies: ordered },
      { kind: 'unplaced' as const, trophies: game.journey.unmatched },
      {
        kind: 'platinum' as const,
        trophies: game.journey.items
          .filter((x) => x.objective.kind === 'platinum')
          .map((x) => x.trophy),
      },
      { kind: 'dlc' as const, trophies: game.trophies.filter((x) => x.groupId !== 'default') },
    ].filter((x) => x.trophies.length)
  }, [game.trophies, game.guide, game.journey])
  const base = game.trophies.filter((x) => x.groupId === 'default')
  const done = base.some((x) => x.type === 'platinum' && x.earned)
  const focus = roadmapFocus(game, done)
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
  const choose = useCallback((trophy: Trophy) => {
    setSelection(anchor(trophy))
  }, [])
  return (
    <section className="trophy-roadmap" id="journey-roadmap" aria-labelledby="roadmap-heading">
      <header className="roadmap-intro">
        <div>
          <span className="eyebrow">{t('map')}</span>
          <h2 id="roadmap-heading">{t('title')}</h2>
        </div>
        <span className="roadmap-total">
          <Icon name="trophy" />
          {inspecting
            ? t('catalogCount', { total: base.length })
            : t('count', { earned: base.filter((x) => x.earned).length, total: base.length })}
        </span>
      </header>
      <div className="roadmap-preview-controls">
        {source.trophies.some((trophy) => trophy.hidden) && (
          <RoadmapVisibility revealed={revealed} setRevealed={setRevealed} saving={saving} />
        )}
        {!preview && (
          <button
            type="button"
            className="quiet"
            aria-pressed={fromStart}
            onClick={() => {
              setFromStart(!fromStart)
              setSelection(null)
            }}
          >
            {t(fromStart ? 'previewBack' : 'previewStart')}
          </button>
        )}
        {inspecting && (
          <p role="status">
            <strong>{t('previewLabel')}</strong> {t('previewNote')}
          </p>
        )}
      </div>
      {!selected || !stage ? (
        <p>{t('empty')}</p>
      ) : (
        <>
          <div className="roadmap-expedition">
            <RoadmapOverview game={game} choose={choose} />
            <RoadmapLandscape game={game} selected={selected} suggested={suggested === selected} />
            {game.journey ? (
              <ReviewedPreparation game={game} choose={choose} />
            ) : (
              <RoadmapOngoing game={game} choose={choose} />
            )}
            <RoadmapNavigation
              game={game}
              ordered={ordered}
              pending={pending}
              selected={selected}
              target={target}
              choose={choose}
            />
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
              <p>{t(roadmapBasis(game))}</p>
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
      <div className="roadmap-preview-controls">
        <Sk w="180px" h={44} />
      </div>
      <div className="roadmap-expedition">
        <div className="roadmap-overview">
          <Sk w="190px" h={24} />
          {[0, 1, 2].map((i) => (
            <Sk key={i} w="100%" h={64} />
          ))}
        </div>
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
        <div className="roadmap-reviewed">
          <Sk w="190px" h={18} />
          <p>
            <Sk w="95%" h={16} />
          </p>
          <p>
            <Sk w="75%" h={16} />
          </p>
          <Sk w="190px" h={44} />
        </div>
        <div className="roadmap-forward">
          <div className="roadmap-view-controls">
            <Sk w="240px" h={44} />
          </div>
          <div className="roadmap-jump">
            <Sk w="40%" h={14} />
            <Sk w="100%" h={44} />
            <Sk w="35%" h={14} />
          </div>
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
