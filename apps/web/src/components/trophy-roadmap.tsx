import {
  type CSSProperties,
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { achievementHistory, earnedTimestamp } from '../../../../shared/journey/history'
import { evaluateJourney } from '../../../../shared/journey/model'
import { reviewedJourney } from '../../../../shared/journey/registry'
import { defineMessages, getLocale, Language, useMessages } from '../i18n/i18n'
import { roadPoint, roadSegment, roadStop } from '../lib/roadmap-motion'
import {
  ongoingObjectives,
  personalRoadmap,
  trophyAdvice,
  trophyRoadmap,
} from '../lib/trophy-roadmap'
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
    campaign: 'Caminho até a platina',
    origin: 'Início da rota',
    confirmedCount: '{count} conquistados',
    destination: 'Destino',
    mapNote: 'Rota sugerida, não sua localização no jogo.',
    historyMapNote: 'Conquistas confirmadas · próximos objetivos recalculados.',
    undated: 'Data indisponível',
    undatedNote:
      'Conquistas sem data aparecem agrupadas após as datadas, sem ordem cronológica conhecida. Datas iguais não informam a ordem entre si.',
    parallelTrail: 'Enquanto avança',
    extraRoute: 'Conteúdo adicional · {count}',
    baseRoute: 'Voltar ao jogo base',
    reviewed: 'Roteiro revisado · {name}',
    routeComplete: 'Rota completa',
    routeEarned: 'Conquistado',
    quickRead: 'Outras oportunidades',
    exploreRoute: 'Explorar o caminho',
    exploreRouteNote: 'Veja o que já conquistou e o que ainda falta.',
    readAdvice: 'Ler dica deste objetivo',
    routeOptions: 'Prévia e troféus ocultos',
    progressContext: 'Seu progresso e objetivos paralelos',
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
      'Base revisada para esta edição: oportunidades por capítulo, preparação e recuperação. Conquistas seguem as datas informadas pela PSN. O restante se reajusta à próxima ação sugerida, sem inferir sua posição. ',
    known:
      'Capítulo {chapter} concluído na PSN. Sua posição atual e o estado do save não são informados.',
    unknown:
      'Sem marco de capítulo confirmado. A rota inicial é uma referência; não pressupõe que você nunca jogou.',
    incomplete:
      'A lista recebida não corresponde a todos os objetivos revisados. A sugestão personalizada ficará disponível quando estiver completa.',
    openWorldBasis:
      'Conquistas seguem as datas da PSN. A próxima ação e o percurso restante se reajustam; atividades paralelas continuam flexíveis. DLC fica separado.',
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
    adviceDetails: 'Como fazer e cuidados',
    completeState: 'Conquista confirmada pela PSN.',
    availableState:
      'Oportunidade para planejar agora; confira se esse trecho corresponde ao seu save.',
    prepareState: 'Prepare durante a campanha; o desbloqueio pode acontecer mais tarde.',
    laterState:
      'Mais adiante na referência de roteiro. Não é uma afirmação de bloqueio no seu save.',
    recoverState: 'Há um marco posterior confirmado. Confira se precisa recuperar este objetivo.',
    verifyState:
      'Confira a sincronização e o save antes de repetir um trecho. Não presumimos conquista nem perda.',
    title: 'Sua jornada da platina',
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
    suggestion: 'Sugestão para agora',
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
    campaign: 'Path to platinum',
    origin: 'Route beginning',
    confirmedCount: '{count} earned',
    destination: 'Destination',
    mapNote: 'Suggested route, not your location in the game.',
    historyMapNote: 'Confirmed achievements · next objectives recalculated.',
    undated: 'Date unavailable',
    undatedNote:
      'Undated achievements are grouped after dated ones, without a known chronological order. Equal timestamps do not establish order between them.',
    parallelTrail: 'Along the way',
    extraRoute: 'Additional content · {count}',
    baseRoute: 'Back to the base game',
    reviewed: 'Reviewed roadmap · {name}',
    routeComplete: 'Full route',
    routeEarned: 'Earned',
    quickRead: 'Other opportunities',
    exploreRoute: 'Explore the path',
    exploreRouteNote: 'See what you have earned and what remains.',
    readAdvice: 'Read this objective’s advice',
    routeOptions: 'Preview and hidden trophies',
    progressContext: 'Your progress and parallel objectives',
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
      'Reviewed knowledge for this edition: chapter opportunities, preparation and recovery. Achievements follow PSN timestamps. The remaining path rebases on the next suggested action without inferring your location. ',
    known:
      'Chapter {chapter} completed on PSN. Your current location and save state are not reported.',
    unknown:
      'No confirmed chapter milestone. The opening route is a reference, not an assumption that you have never played.',
    incomplete:
      'The received list does not match all reviewed objectives. Personalized guidance will be available once it is complete.',
    openWorldBasis:
      'Achievements follow PSN timestamps. The next action and remaining path adapt; parallel activities remain flexible. DLC stays separate.',
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
    adviceDetails: 'How to do it and what to watch for',
    completeState: 'Achievement confirmed by PSN.',
    availableState: 'An opportunity to plan now; check whether this section matches your save.',
    prepareState: 'Prepare during the campaign; the unlock may come later.',
    laterState: 'Later in the reference route. This does not assert a lock in your save.',
    recoverState:
      'A later milestone is confirmed. Check whether you need to recover this objective.',
    verifyState:
      'Check synchronization and your save before replaying a section. We presume neither completion nor loss.',
    title: 'Your platinum journey',
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
    suggestion: 'Suggested for now',
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
        <p>{reviewed.objective.action[language]}</p>
        <details className="roadmap-advice-details" key={reviewed.objective.key}>
          <summary>{t('adviceDetails')}</summary>
          <p className="roadmap-context-note">{t(`${reviewed.state}State`)}</p>
          <p>{reviewed.objective.placement.evidence[language]}</p>
          {reviewed.objective.approach && <p>{reviewed.objective.approach[language]}</p>}
          {reviewed.objective.availability && <p>{reviewed.objective.availability[language]}</p>}
          {reviewed.objective.recovery && reviewed.state !== 'complete' && (
            <p>{reviewed.objective.recovery[language]}</p>
          )}
          <details className="roadmap-basis">
            <summary>{t('sources')}</summary>
            <ul>
              {[
                ...new Set([
                  ...reviewed.objective.sources,
                  ...reviewed.objective.placement.sources,
                ]),
              ].map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {new URL(url).hostname}
                  </a>
                </li>
              ))}
            </ul>
          </details>
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
        <h4>{t('guidance')}</h4>
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

function RoadmapBackdrop({ game }: { game: RoadmapGame }) {
  const art =
    game.game.art_url ??
    (game.game.screenshot_ids?.[0]
      ? image(game.game.screenshot_ids[0], 't_1080p')
      : game.game.cover_url)
  const [failedArt, setFailedArt] = useState<string | null>(null)
  return (
    <>
      {art && failedArt !== art && (
        <img className="roadmap-scene" src={art} alt="" onError={() => setFailedArt(art)} />
      )}
      <div className="roadmap-horizon" aria-hidden="true" />
    </>
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
  return (
    <div className="roadmap-landscape">
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
          {!hidden && !selected.earned && (
            <RoadmapSignal
              missable={
                game.journey
                  ? game.journey.items.find((item) => item.trophy === selected)?.objective.risk ===
                    'opportunity'
                  : !!trophyAdvice(selected, game.guide).warning
              }
              final={selected.type === 'platinum'}
            />
          )}
        </span>
      </div>
    </div>
  )
}

function RoadmapFocus({
  game,
  selected,
  target,
}: {
  game: RoadmapGame
  selected: Trophy
  target?: Trophy
}) {
  return (
    <div id="roadmap-focus" className="roadmap-focus">
      <RoadmapLandscape game={game} selected={selected} suggested={target === selected} />
      <TrophyStep
        key={anchor(selected)}
        trophy={selected}
        game={game}
        suggested={target === selected}
      />
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

function RoadmapParallel({
  game,
  choose,
}: {
  game: RoadmapGame
  choose: (trophy: Trophy) => void
}) {
  const t = useMessages(messages)
  const items = useMemo(
    () =>
      game.journey
        ? game.journey.ongoing.map((x) => x.trophy).filter((x) => !x.hidden && !x.earned)
        : ongoingObjectives(game.trophies, game.guide).map((x) => x.trophy),
    [game.journey, game.trophies, game.guide],
  )
  if (!items.length) return null
  return (
    <section className="roadmap-parallel" aria-label={t('parallelTrail')}>
      <h3>
        <Icon name="target" />
        <span>
          {t('parallelTrail')} <small>· {items.length}</small>
        </span>
      </h3>
      <p>{t('ongoingNote')}</p>
      <div>
        {items.map((trophy) => (
          <button
            type="button"
            className="quiet"
            key={anchor(trophy)}
            onClick={() => choose(trophy)}
          >
            <TrophyArt url={trophy.iconUrl} />
            <span>{trophy.name}</span>
            {roadmapRisk(game, trophy) && (
              <span className="roadmap-parallel-risk">
                <Icon name="warning" />
                {t('missable')}
              </span>
            )}
            <Icon name="chevron-right" />
          </button>
        ))}
      </div>
    </section>
  )
}

function RoadmapNavigation({
  game,
  ordered,
  selected,
  target,
  choose,
}: {
  game: RoadmapGame
  ordered: Trophy[]
  selected: Trophy
  target?: Trophy
  choose: (trophy: Trophy) => void
}) {
  const t = useMessages(messages)
  const platinum = ordered.find((x) => x.groupId === 'default' && x.type === 'platinum')
  const first = ordered[0]
  const extra = selected.groupId !== 'default'
  const route = ordered.filter((x) => (x.groupId !== 'default') === extra)
  const extras = ordered.filter((x) => x.groupId !== 'default')
  return (
    <section className="roadmap-campaign" aria-label={t('campaign')}>
      <RoadmapBackdrop game={game} />
      <div className="roadmap-endpoints">
        <button
          type="button"
          className="roadmap-origin"
          onClick={() => {
            if (first) choose(first)
          }}
        >
          <Icon name="compass" />
          <span>
            {t('origin')}
            <small>
              {t('confirmedCount', {
                count: ordered.filter((x) => x.earned && x.groupId === 'default').length,
              })}
            </small>
          </span>
        </button>
        <span className="roadmap-endpoint-line" aria-hidden="true" />
        {platinum && (
          <button type="button" className="roadmap-finish" onClick={() => choose(platinum)}>
            <span>
              <small>{t('destination')}</small>
              <strong>{t('finale')}</strong>
            </span>
            <TrophyArt url={platinum.hidden && !platinum.earned ? undefined : platinum.iconUrl} />
          </button>
        )}
      </div>
      <RoadmapForward
        key={String(extra)}
        game={game}
        pending={route}
        order={ordered}
        complete
        selected={selected}
        target={target}
        choose={choose}
      />
      <div className="roadmap-map-note">
        <p>{t(route.some((x) => x.earned) ? 'historyMapNote' : 'mapNote')}</p>
        <a href="#roadmap-focus" className="roadmap-map-advice">
          <Icon name="chevron-down" />
          {t('readAdvice')}
        </a>
        {target && selected !== target && (
          <button type="button" className="quiet" onClick={() => choose(target)}>
            <Icon name="target" />
            {t('resume')}
          </button>
        )}
      </div>
      {!!extras.length && (
        <div className="roadmap-extra-route">
          <button
            type="button"
            className="quiet"
            onClick={() =>
              choose(extra ? (target?.groupId === 'default' ? target : first) : extras[0])
            }
          >
            <Icon name="compass" />
            {extra ? t('baseRoute') : t('extraRoute', { count: extras.length })}
          </button>
        </div>
      )}
    </section>
  )
}

function RouteNumber({ trophy, index }: { trophy: Trophy; index: number }) {
  if (trophy.earned) return <Icon name="check" />
  if (trophy.type === 'platinum') return <Icon name="trophy" />
  return String(index + 1).padStart(2, '0')
}

function EarnedDate({ trophy }: { trophy: Trophy }) {
  const t = useMessages(messages)
  const time = earnedTimestamp(trophy)
  return time === undefined ? (
    <small>{t('undated')}</small>
  ) : (
    <time dateTime={new Date(time).toISOString()}>
      {new Date(time).toLocaleString(getLocale())}
    </time>
  )
}

function RoadmapTiming({ game, trophy }: { game: RoadmapGame; trophy: Trophy }) {
  const t = useMessages(messages)
  const reviewed = game.journey?.items.find((x) => x.trophy === trophy)
  if (trophy.earned || trophy.hidden || trophy.type === 'platinum' || !reviewed) return null
  const language = getLocale() === Language.En ? 'en' : 'pt'
  return (
    <small>
      {reviewed.state === 'recover' && reviewed.objective.chapter
        ? t('recoverWhen', { chapter: reviewed.objective.chapter })
        : reviewed.objective.placement.label[language]}
    </small>
  )
}

function roadmapRisk(game: RoadmapGame, trophy: Trophy) {
  if (trophy.hidden || trophy.earned) return false
  const reviewed = game.journey?.items.find((x) => x.trophy === trophy)
  return reviewed
    ? reviewed.objective.risk === 'opportunity'
    : !!trophyAdvice(trophy, game.guide).warning
}

function measuredRoadGeometry(first: HTMLElement | null) {
  const pin = first?.querySelector('.roadmap-route-pin')?.getBoundingClientRect()
  const firstRect = first?.getBoundingClientRect()
  const second = first?.nextElementSibling
  const secondPin = second?.querySelector('.roadmap-route-pin')?.getBoundingClientRect()
  return pin?.width && firstRect
    ? {
        x: pin.left - firstRect.left + pin.width / 2,
        rim: pin.width / 2 + 6,
        low: pin.top - firstRect.top + pin.height / 2,
        high:
          secondPin && second
            ? secondPin.top - second.getBoundingClientRect().top + secondPin.height / 2
            : pin.top - firstRect.top + pin.height / 2,
      }
    : undefined
}

function RoadmapForward({
  pending,
  selected,
  choose,
  game,
  complete = false,
  order,
  target,
}: {
  target?: Trophy
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
  const signature = pending.map(anchor).join('|')
  const previousRoute = useRef(signature)
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
      const geometry = measuredRoadGeometry(first)
      const columns = Math.max(1, Math.round(track.clientWidth / width))
      const page = Math.floor(Math.max(0, at) / columns)
      const tail = (columns - (pending.length % columns)) % columns
      track.style.setProperty('--roadmap-tail', `${tail * width}px`)
      track.querySelectorAll<SVGSVGElement>('.roadmap-route-line').forEach((svg, index) => {
        svg.setAttribute('viewBox', `0 0 ${width} 150`)
        svg.querySelectorAll('path').forEach((path) => {
          path.setAttribute('d', roadSegment(index, width, geometry))
        })
      })
      const paint = (value: number, scroll: number) => {
        position.current = value
        const point = roadPoint(value, width, geometry)
        track.style.setProperty('--roadmap-cursor-x', `${point.x - 6}px`)
        track.style.setProperty('--roadmap-cursor-y', `${point.y - 6}px`)
        track.scrollTo?.({ left: scroll, behavior: 'auto' })
        track.dataset.positioned = 'true'
      }
      const destination = roadStop(Math.max(0, at), columns)
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
    place(previousRoute.current !== signature)
    previousRoute.current = signature
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
  }, [at, pending.length, signature])
  return (
    <div className="roadmap-forward">
      <div className="roadmap-forward-heading">
        <div>
          <h4>
            {pending[0]?.groupId !== 'default' && pending.length
              ? t('dlc')
              : complete
                ? t('routeComplete')
                : pending.length
                  ? t('ahead')
                  : t('stageDone')}
          </h4>
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
          style={{ '--roadmap-stops': Math.min(5, pending.length) } as CSSProperties}
          ref={rail}
          aria-label={t(complete ? 'routeComplete' : 'ahead')}
        >
          {pending.map((trophy, i) => {
            const hidden = trophy.hidden && !trophy.earned
            const current = selected === trophy
            const missable = roadmapRisk(game, trophy)
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
                data-suggested={target === trophy}
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
                    {target === trophy && !trophy.earned && (
                      <small className="roadmap-suggested-label">{t('suggestion')}</small>
                    )}
                    <RoadmapTiming game={game} trophy={trophy} />
                    {trophy.earned ? (
                      <>
                        <span className="roadmap-route-finale">{t('routeEarned')}</span>
                        {earnedTimestamp(trophy) === undefined && <small>{t('undated')}</small>}
                      </>
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
      className="roadmap-visibility"
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

function roadmapOrder(game: RoadmapGame, reference: Trophy[], focus?: Trophy) {
  const plan = game.journey
  if (plan && plan.covered === plan.expected && !plan.unmatched.length)
    return personalRoadmap(
      reference,
      plan.remaining.map((x) => x.trophy),
    )
  return personalRoadmap(
    reference,
    focus ? reference.filter((x) => x.id === focus.id && x.groupId === focus.groupId) : [],
  )
}

function RoadmapBasis({ game }: { game: RoadmapGame }) {
  const t = useMessages(messages)
  const plan = game.journey
  const context =
    plan?.mode === 'open-world'
      ? t('openWorldKnown')
      : plan?.confirmedChapter
        ? t('known', { chapter: plan.confirmedChapter })
        : t('unknown')
  return (
    <details className="roadmap-basis">
      <summary>{t('order')}</summary>
      <p>{t(roadmapBasis(game))}</p>
      {plan && <p>{context}</p>}
      {plan && (plan.covered !== plan.expected || !!plan.unmatched.length) && (
        <p>{t('incomplete')}</p>
      )}
    </details>
  )
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
  const reference = stages.flatMap((s) => s.trophies)
  const ordered = roadmapOrder(game, reference, focus)
  const suggested = ordered.find(
    (x) => !x.earned && x.id === focus?.id && x.groupId === focus.groupId,
  )
  const target =
    suggested ??
    ordered.find((x) => !x.earned && x.type !== 'platinum') ??
    ordered.find((x) => !x.earned) ??
    ordered.find((x) => x.type === 'platinum' && x.groupId === 'default') ??
    ordered.at(-1)
  const [selection, setSelection] = useState<string | null>(null)
  const selected = ordered.find((x) => anchor(x) === selection) ?? target
  const stageIndex = stages.findIndex((s) => selected && s.trophies.includes(selected))
  const stage = stages[stageIndex]
  const history = achievementHistory(ordered)
  const past = [...history.dated, ...history.undated]
  const choose = useCallback((trophy: Trophy) => {
    setSelection(anchor(trophy))
  }, [])
  const inspect = useCallback(
    (trophy: Trophy) => {
      choose(trophy)
      document.getElementById('roadmap-focus')?.scrollIntoView({ block: 'start' })
    },
    [choose],
  )
  return (
    <section className="trophy-roadmap" id="journey-roadmap" aria-labelledby="roadmap-heading">
      <header className="roadmap-intro">
        <div>
          <span className="eyebrow">{t('map')}</span>
          <h2 id="roadmap-heading">{t('title')}</h2>
        </div>
        <div className="roadmap-intro-actions">
          <span className="roadmap-total">
            <Icon name="trophy" />
            {inspecting
              ? t('catalogCount', { total: base.length })
              : t('count', { earned: base.filter((x) => x.earned).length, total: base.length })}
          </span>
          {source.trophies.some((trophy) => trophy.hidden) && (
            <RoadmapVisibility revealed={revealed} setRevealed={setRevealed} saving={saving} />
          )}
        </div>
      </header>
      {inspecting && (
        <p className="roadmap-preview-notice" role="status">
          <strong>{t('previewLabel')}</strong> {t('previewNote')}
        </p>
      )}
      {!selected || !stage ? (
        <p>{t('empty')}</p>
      ) : (
        <>
          <div className="roadmap-expedition">
            <RoadmapNavigation
              game={game}
              ordered={ordered}
              selected={selected}
              target={target}
              choose={choose}
            />
            <RoadmapFocus game={game} selected={selected} target={target} />
            <RoadmapParallel game={game} choose={inspect} />
            {!!past.length && (
              <details className="roadmap-past">
                <summary>
                  <Icon name="check" />
                  {t('past', { count: past.length })}
                  <Icon name="chevron-down" />
                </summary>
                <p className="roadmap-context-note" hidden={!history.uncertain}>
                  {t('undatedNote')}
                </p>
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
                          <EarnedDate trophy={trophy} />
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
            {!game.journey && (
              <details className="roadmap-context-details">
                <summary>{t('progressContext')}</summary>
                <RoadmapOngoing game={game} choose={inspect} />
              </details>
            )}
          </div>
          {stage.kind !== 'phase' && (
            <p className="roadmap-context-note">{t(`${stage.kind}Note`)}</p>
          )}
          <footer className="roadmap-footer">
            <JourneyLink className="roadmap-ask" to={nexoHref(game.np, game.name)}>
              <Icon name="nexo" />
              {t('talk')}
            </JourneyLink>
            {!preview && (
              <button
                type="button"
                className="roadmap-visibility"
                aria-pressed={fromStart}
                onClick={() => {
                  setFromStart(!fromStart)
                  setSelection(null)
                }}
              >
                {t(fromStart ? 'previewBack' : 'previewStart')}
              </button>
            )}
            <RoadmapBasis game={game} />
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
        <div className="roadmap-intro-actions">
          <Sk w="150px" h={14} />
          <Sk w="120px" h={44} />
        </div>
      </header>
      <div className="roadmap-expedition">
        <div className="roadmap-campaign roadmap-campaign-loading">
          <div className="roadmap-endpoints">
            <Sk w="95px" h={44} />
            <Sk w="95px" h={44} />
          </div>
          <div className="roadmap-forward-heading">
            <Sk w="130px" h={20} />
            <Sk w="92px" h={44} />
          </div>
          <div className="roadmap-loading-path">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="roadmap-loading-stop">
                <span className="roadmap-loading-pin">
                  <Sk w="100%" style={{ height: '100%' }} />
                </span>
                <Sk w="85%" h={18} />
              </div>
            ))}
          </div>
          <Sk w="75%" h={14} />
        </div>
        <div className="roadmap-focus">
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
          <div className="roadmap-content">
            <Sk w="65%" h={24} />
            <Sk w="100%" h={16} />
            <Sk w="90%" h={16} />
            <Sk w="75%" h={16} />
            <Sk w="180px" h={44} />
          </div>
        </div>
        <div className="roadmap-parallel roadmap-parallel-loading">
          <h3>
            <Sk w="160px" h={20} />
          </h3>
          <p>
            <Sk w="75%" h={14} />
          </p>
          <div>
            {[0, 1, 2].map((i) => (
              <div className="roadmap-parallel-placeholder" key={i}>
                <Sk w="40px" h={40} />
                <Sk w="65%" h={18} />
              </div>
            ))}
          </div>
        </div>
        <div className="roadmap-loading-disclosures">
          <Sk w="100%" h={64} />
        </div>
      </div>
    </section>
  )
}
