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
import { trophyWhen } from '../../../../shared/journey/places'
import { defineMessages, getLocale, Language, useMessages } from '../i18n/i18n'
import { type RoadStopGeometry, roadPoint, roadSegment, roadStop } from '../lib/roadmap-motion'
import {
  ongoingObjectives,
  personalRoadmap,
  phasePlan,
  trophyAdvice,
  trophyKind,
  trophyMentions,
  trophyRoadmap,
} from '../lib/trophy-roadmap'
import type { CurrentGame, RouteTip, Trophy, TrophyKind } from '../lib/types'
import { useGameSpoilers } from '../lib/use-game-spoilers'
import { Icon } from '../ui/icon'
import { GuideText } from '../ui/markdown'
import { Sk } from '../ui/skeleton'
import { toast } from '../ui/toast'
import { TrophyArt } from '../ui/trophy-art'
import { image } from './game-showcase'
import { JourneyLink } from './journey-link'
import { TrophyAsks } from './nexo-asks'
import { nexoHref } from './tip'
import './trophy-roadmap.css'

type RoadmapGame = Pick<CurrentGame, 'game' | 'name' | 'np' | 'trophies' | 'guide' | 'focus'>

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
    phasePlan: 'Plano da fase',
    betaLabel: 'BETA:',
    betaNote:
      'A jornada ainda está em testes. A ordem e as dicas ainda estão passando por avaliações de qualidade.',
    tipsCount: { one: 'Ver {count} ponto do roteiro', other: 'Ver os {count} pontos do roteiro' },
    extraRoute: 'Conteúdo adicional · {count}',
    baseRoute: 'Voltar ao jogo base',
    routeComplete: 'Rota completa',
    routeEarned: 'Conquistado',
    readAdvice: 'Ler dica deste objetivo',
    progressContext: 'Seu progresso e objetivos paralelos',
    title: 'Sua jornada da platina',
    ongoing: 'Ao longo da jornada',
    ongoingNote:
      'Cuide destes objetivos enquanto avança. A seleção da trilha não indica sua posição real no jogo.',
    repeated: 'Citado em vários pontos do roteiro',
    counter: 'Objetivo com contador da PSN',
    duration: 'Acompanhamento durante a campanha',
    long: 'Contagem longa, segundo o guia',
    early: 'Orientação para o início',
    counterProgress: 'PSN: {value} / {target}',
    catalogCount: '{total} troféus',
    ahead: 'Caminho à frente',
    past: 'Conquistas anteriores ({count})',
    stageDone: 'Caminho concluído',
    previous: 'Marco anterior',
    next: 'Próximo marco',
    resume: 'Voltar à sugestão',
    selected: 'Desafio em foco',
    guidance: 'Objetivo',
    map: 'MAPA DA JORNADA',
    missable: 'Perdível',
    finale: 'Platina',
    kind: { natural: 'Natural', hunt: 'Caçada', grind: 'Grind' },
    kindCount: {
      platinum: { one: '{count} platina', other: '{count} platinas' },
      natural: { one: '{count} natural', other: '{count} naturais' },
      hunt: { one: '{count} caçada', other: '{count} caçadas' },
      grind: { one: '{count} grind', other: '{count} grinds' },
    },
    count: '{earned} de {total} conquistados',
    unplacedNote:
      'Estes troféus não têm uma correspondência única nas fases do guia. Esses marcos seguem a lista PSN, não uma recomendação.',
    platinum: 'A conquista final',
    platinumNote: 'A platina só aparece concluída quando a PSN confirma sua conquista.',
    dlc: 'Além do jogo base',
    dlcNote:
      'Troféus adicionais, separados da rota da platina. Sua preferência de progresso continua valendo no resumo do jogo.',
    earned: 'Conquistado',
    suggestion: 'Sugestão para agora',
    note: 'Como fazer',
    helpful: 'Essa dica ajudou?',
    helpfulYes: 'Sim',
    helpfulNo: 'Não',
    helpfulThanks: 'Valeu! Isso ajuda a melhorar as dicas.',
    whyTitle: 'Valeu! O que faltou?',
    why: {
      detail: 'Faltou detalhe',
      wrong: 'Está errada',
      unclear: 'Não entendi',
      own: 'Outro',
    },
    whyNote: 'Conte o que faltou',
    whySend: 'Enviar',
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
    progress: 'Progresso do troféu na PSN: {value} / {target}',
    whenStory: 'Acontece naturalmente pela história.',
    whenAt: 'Acontece {place}.',
    whenAtNatural: 'Acontece {place}, naturalmente pela história.',
    whenRange: 'Dá para fazer {span}.',
    whenAhead: '{count} {unit} à frente de você.',
    whenHere: 'É onde você está agora.',
    whenBehind: 'Acontecia {place}, que ficou para trás. Dá para voltar pela seleção de {units}.',
    whenBehindNoReplay: 'Acontecia {place}, que ficou para trás.',
    whenPace: 'No seu ritmo, fecha {place}.',
    whenLate: 'No seu ritmo atual, só fecha depois da história.',
    place: {
      mission: 'na missão {n}',
      chapter: 'no capítulo {n}',
      episode: 'no episódio {n}',
      act: 'no ato {n}',
      level: 'na fase {n}',
    },
    span: {
      mission: 'da missão {from} à {to}',
      chapter: 'do capítulo {from} ao {to}',
      episode: 'do episódio {from} ao {to}',
      act: 'do ato {from} ao {to}',
      level: 'da fase {from} à {to}',
    },
    unit: {
      mission: { one: 'missão', other: 'missões' },
      chapter: { one: 'capítulo', other: 'capítulos' },
      episode: { one: 'episódio', other: 'episódios' },
      act: { one: 'ato', other: 'atos' },
      level: { one: 'fase', other: 'fases' },
    },
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
    phasePlan: 'Phase plan',
    betaLabel: 'BETA:',
    betaNote:
      'The journey is still being tested. The order and tips are still going through quality reviews.',
    tipsCount: { one: 'See {count} route point', other: 'See all {count} route points' },
    extraRoute: 'Additional content · {count}',
    baseRoute: 'Back to the base game',
    routeComplete: 'Full route',
    routeEarned: 'Earned',
    readAdvice: 'Read this objective’s advice',
    progressContext: 'Your progress and parallel objectives',
    title: 'Your platinum journey',
    ongoing: 'Throughout the journey',
    ongoingNote:
      'Keep these objectives in mind as you play. Selecting a milestone does not indicate your actual location in the game.',
    repeated: 'Mentioned at several points in the roadmap',
    counter: 'Objective with a PSN counter',
    duration: 'Follow throughout the campaign',
    long: 'A long count, per the guide',
    early: 'Guidance for the start',
    counterProgress: 'PSN: {value} / {target}',
    catalogCount: '{total} trophies',
    ahead: 'The road ahead',
    past: 'Previous achievements ({count})',
    stageDone: 'Path complete',
    previous: 'Previous milestone',
    next: 'Next milestone',
    resume: 'Return to suggestion',
    selected: 'Challenge in focus',
    guidance: 'Objective',
    map: 'JOURNEY MAP',
    missable: 'Missable',
    finale: 'Platinum',
    kind: { natural: 'Natural', hunt: 'Hunt', grind: 'Grind' },
    kindCount: {
      platinum: { one: '{count} platinum', other: '{count} platinums' },
      natural: { one: '{count} natural', other: '{count} natural' },
      hunt: { one: '{count} hunt', other: '{count} hunts' },
      grind: { one: '{count} grind', other: '{count} grinds' },
    },
    count: '{earned} of {total} earned',
    unplacedNote:
      'These trophies do not have a unique match in the guide phases. These milestones follow the PSN list, not a recommendation.',
    platinum: 'The final achievement',
    platinumNote: 'Platinum only appears complete when PSN confirms it has been earned.',
    dlc: 'Beyond the base game',
    dlcNote:
      'Additional trophies, separate from the platinum route. Your progress preference still applies to the game summary.',
    earned: 'Earned',
    suggestion: 'Suggested for now',
    note: 'How to do it',
    helpful: 'Did this tip help?',
    helpfulYes: 'Yes',
    helpfulNo: 'No',
    helpfulThanks: 'Thanks! This helps us improve the tips.',
    whyTitle: 'Thanks! What was missing?',
    why: {
      detail: 'Not enough detail',
      wrong: 'It is wrong',
      unclear: 'Hard to follow',
      own: 'Other',
    },
    whyNote: 'Tell us what was missing',
    whySend: 'Send',
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
    progress: 'Trophy progress on PSN: {value} / {target}',
    whenStory: 'Comes naturally with the story.',
    whenAt: 'Happens {place}.',
    whenAtNatural: 'Happens {place}, naturally with the story.',
    whenRange: 'You can work on it {span}.',
    whenAhead: '{count} {unit} ahead of you.',
    whenHere: 'That is where you are now.',
    whenBehind:
      'Happened {place}, which is behind you. You can go back by picking {units} in the menu.',
    whenBehindNoReplay: 'Happened {place}, which is behind you.',
    whenPace: 'At your pace, it closes {place}.',
    whenLate: 'At your current pace, it only closes after the story.',
    place: {
      mission: 'in mission {n}',
      chapter: 'in chapter {n}',
      episode: 'in episode {n}',
      act: 'in act {n}',
      level: 'in level {n}',
    },
    span: {
      mission: 'from mission {from} to {to}',
      chapter: 'from chapter {from} to {to}',
      episode: 'from episode {from} to {to}',
      act: 'from act {from} to {to}',
      level: 'from level {from} to {to}',
    },
    unit: {
      mission: { one: 'mission', other: 'missions' },
      chapter: { one: 'chapter', other: 'chapters' },
      episode: { one: 'episode', other: 'episodes' },
      act: { one: 'act', other: 'acts' },
      level: { one: 'level', other: 'levels' },
    },
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
  const advice = trophyAdvice(trophy, game.guide)
  // A trophy's own trick already says how: the guide's other mentions of it only repeat it. Without
  // one, a tip beside the warning says the same thing, and steps that repeat a tip add nothing.
  const trick = advice.trick
  const tips = trick
    ? []
    : advice.tips.filter((tip) => !(tip.kind === 'missable' && advice.warning))
  const said = tips.map((tip) => tip.text).join(' ')
  const steps = trick
    ? []
    : trophyMentions(trophy, game.trophies, game.guide).filter((s) => !said.includes(s))
  // Once earned there is nothing left to lose.
  const warning = trophy.earned ? undefined : advice.warning
  const hasAdvice =
    trick || warning || advice.online || advice.bug || !!tips.length || !!steps.length
  // A story trophy with nothing to watch for has nothing to ask: it comes by playing.
  const quiet = !hasAdvice && trophyKind(trophy, game.guide) === 'natural'
  return (
    <div className="roadmap-advice">
      {hasAdvice && (
        <span className="roadmap-advice-label">
          <Icon name="nexo" />
          {t('note')}
        </span>
      )}
      {trick && <TrickSteps text={trick} />}
      <RoadmapTips tips={tips} />
      {steps.map((step) => (
        <p key={step}>
          <GuideText text={step} />
        </p>
      ))}
      {warning && (
        <div className="roadmap-caution">
          <b>
            <Icon name="warning" />
            {t('warning')}
          </b>
          <p>
            <GuideText text={warning.when} />
          </p>
          {!trick && (
            <p>
              <GuideText text={warning.how} />
            </p>
          )}
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
      {hasAdvice && <TipRating trophy={trophy} />}
      {!quiet && (
        <AdviceAsk trophy={trophy} game={game} advice={!!hasAdvice} missable={!!warning} />
      )}
    </div>
  )
}

/** A trophy still to get: the questions about it, sent from here; an earned one links the chat. */
function AdviceAsk({
  trophy,
  game,
  advice,
  missable,
}: {
  trophy: Trophy
  game: RoadmapGame
  advice: boolean
  missable: boolean
}) {
  const t = useMessages(messages)
  if (game.np && !trophy.earned)
    return (
      <TrophyAsks
        np={game.np}
        name={game.name}
        trophy={trophy.name}
        advice={advice}
        counter={(trophy.progressTarget ?? 0) > 1}
        missable={missable}
        className="roadmap-ask"
      />
    )
  return (
    <JourneyLink className="roadmap-ask" to={nexoHref(game.np, game.name, trophy.name)}>
      <Icon name="nexo" />
      {t('ask')}
    </JourneyLink>
  )
}

/** A trick written one step per line reads as a numbered list; a single line stays a paragraph. */
function TrickSteps({ text }: { text: string }) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2)
    return (
      <p>
        <GuideText text={text} />
      </p>
    )
  return (
    <ol className="roadmap-steps">
      {lines.map((line) => (
        <li key={line}>
          <GuideText text={line} />
        </li>
      ))}
    </ol>
  )
}

// "other" is also a plural category, so its text sits under another key.
const REASONS = ['detail', 'wrong', 'unclear', 'other'] as const
/** Room for the note inside a usage event, after its name and the trophy. */
const NOTE_LIMIT = 80

/**
 * Whether the tip helped. Nothing here talks to the server: the usage plugin reads each click from
 * `data-rate`, `data-reason` and the note form, with the trophy in `data-trophy` and the game in the
 * roadmap's `data-game`. A dislike counts on its own; the reason after it is optional.
 */
function TipRating({ trophy }: { trophy: Trophy }) {
  const t = useMessages(messages)
  const [step, setStep] = useState<'ask' | 'why' | 'note' | 'done'>('ask')
  const [note, setNote] = useState('')
  const label = `roadmap-rate-${trophy.id}`
  return (
    <div className="roadmap-rate" data-trophy={`${trophy.groupId}:${trophy.id}`}>
      {step === 'done' && <p role="status">{t('helpfulThanks')}</p>}
      {step === 'ask' && (
        <>
          <span id={label}>{t('helpful')}</span>
          <fieldset aria-labelledby={label}>
            {(['yes', 'no'] as const).map((answer) => (
              <button
                key={answer}
                type="button"
                className="chip"
                data-rate={answer}
                aria-label={t(answer === 'yes' ? 'helpfulYes' : 'helpfulNo')}
                title={t(answer === 'yes' ? 'helpfulYes' : 'helpfulNo')}
                onClick={() => setStep(answer === 'yes' ? 'done' : 'why')}
              >
                <Icon name={answer === 'yes' ? 'thumbs-up' : 'thumbs-down'} />
              </button>
            ))}
          </fieldset>
        </>
      )}
      {step === 'why' && (
        <>
          <span id={label} role="status">
            {t('whyTitle')}
          </span>
          <fieldset aria-labelledby={label} className="roadmap-rate-why">
            {REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                className="chip"
                data-reason={reason}
                onClick={() => setStep(reason === 'other' ? 'note' : 'done')}
              >
                {t(`why.${reason === 'other' ? 'own' : reason}`)}
              </button>
            ))}
          </fieldset>
        </>
      )}
      {step === 'note' && (
        <form
          className="roadmap-rate-note"
          onSubmit={(e) => {
            e.preventDefault()
            if (note.trim()) setStep('done')
          }}
        >
          <input
            type="text"
            aria-label={t('whyNote')}
            placeholder={t('whyNote')}
            maxLength={NOTE_LIMIT}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            // biome-ignore lint/a11y/noAutofocus: the field opens because the player asked to type
            autoFocus
          />
          <button type="submit" className="chip" disabled={!note.trim()}>
            {t('whySend')}
          </button>
        </form>
      )}
    </div>
  )
}

/** The guide's words for this trophy along the route. A long checklist stays folded. */
function RoadmapTips({ tips }: { tips: RouteTip[] }) {
  const t = useMessages(messages)
  if (!tips.length) return null
  const list = (
    <ul className="roadmap-tips">
      {tips.map((tip) => (
        <li key={`${tip.name ?? ''}${tip.text}`}>
          {tip.name && <strong>{tip.name}</strong>}
          {tip.where && <em>{tip.where}</em>}
          {tip.steps?.length ? (
            <ol>
              {tip.steps.map((step) => (
                <li key={step}>
                  <GuideText text={step} />
                </li>
              ))}
            </ol>
          ) : (
            <GuideText text={tip.text} />
          )}
          {tip.ifMissed && (
            <small>
              <GuideText text={tip.ifMissed} />
            </small>
          )}
        </li>
      ))}
    </ul>
  )
  if (tips.length < 3) return list
  return (
    <details className="roadmap-advice-details">
      <summary>{t('tipsCount', { count: tips.length })}</summary>
      {list}
    </details>
  )
}

/** What the whole phase is about, apart from any trophy; it changes only with the phase. */
function RoadmapPhase({ game, trophy }: { game: RoadmapGame; trophy: Trophy }) {
  const t = useMessages(messages)
  const phase = trophyAdvice(trophy, game.guide).phase
  const plan = phase ? phasePlan(phase.goal, game.trophies) : ''
  if (!phase || !plan) return null
  return (
    <details className="roadmap-phase" key={phase.phase}>
      <summary>
        <span className="roadmap-phase-title">
          <b>{t('phasePlan')}</b> {phase.phase}
        </span>
        <Icon name="chevron-down" />
      </summary>
      <GuideText text={plan} />
    </details>
  )
}

const capital = (text: string) => text.charAt(0).toLocaleUpperCase(getLocale()) + text.slice(1)

// Guides that say a step can be played again (mission or chapter select).
const REPLAY =
  /sele[cç][aã]o de (?:miss|cap[ií]t|epis|fase)|(?:mission|chapter|episode|level) select/i

function replayable(guide: RoadmapGame['guide']) {
  const text = [guide?.overview, guide?.postgame, ...(guide?.roadmap ?? []).map((p) => p.goal)]
  return text.some((x) => !!x && REPLAY.test(x))
}

type When = NonNullable<ReturnType<typeof trophyWhen>>
type Translate = ReturnType<typeof useMessages<typeof messages>>

// How far a step is from the player, when it is ahead: the counter the map also shows.
function distance(t: Translate, when: When, step: number) {
  if (when.at === undefined || step < when.at) return []
  if (step === when.at) return [t('whenHere')]
  const count = step - when.at
  return [t('whenAhead', { count, unit: t(`unit.${when.unit}`, { count }) })]
}

// A count or a collection: its range, then where it closes at the player's pace.
function rangeLine(t: Translate, when: When, counted: boolean) {
  const end = when.to ?? when.from
  const span = t(`span.${when.unit}`, { from: when.from, to: end })
  // Inside the range already: no distance to tell.
  const ahead = when.at !== undefined && when.at < when.from ? distance(t, when, when.from) : []
  const first = [t('whenRange', { span }), ...ahead]
  if (when.late) return [...first, t('whenLate')]
  if (!counted || when.expected === end) return first
  return [...first, t('whenPace', { place: t(`place.${when.unit}`, { n: when.expected }) })]
}

// A trophy of a single moment: where it happens, and how far it is from the player.
function momentLine(t: Translate, when: When, natural: boolean, replay: boolean) {
  const place = t(`place.${when.unit}`, { n: when.from })
  if (when.behind)
    return [
      replay
        ? t('whenBehind', { place, units: t(`unit.${when.unit}`, { count: 2 }) })
        : t('whenBehindNoReplay', { place }),
    ]
  return [t(natural ? 'whenAtNatural' : 'whenAt', { place }), ...distance(t, when, when.from)]
}

/** When an open trophy happens along the game, from the guide's places; the map uses the same steps. */
function TrophyWhen({ trophy, game }: { trophy: Trophy; game: RoadmapGame }) {
  const t = useMessages(messages)
  if (trophy.earned || trophy.groupId !== 'default' || trophy.type === 'platinum') return null
  const base = game.trophies.filter((x) => x.groupId === 'default')
  const when = trophyWhen(trophy, base, game.guide)
  const natural = trophyKind(trophy, game.guide) === 'natural'
  if (!when && !natural) return null
  const parts = !when
    ? [t('whenStory')]
    : when.to !== undefined && when.to > when.from
      ? rangeLine(t, when, !!trophy.progressValue)
      : momentLine(t, when, natural, replayable(game.guide))
  return <p className="roadmap-progress roadmap-when">{parts.join(' ')}</p>
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
      <p className="roadmap-objective">
        <Icon name="target" />
        <span>
          <b>{t('guidance')}</b> {hidden ? t('secretNote') : trophy.detail}
        </span>
      </p>
      {!hidden && (
        <>
          {trophy.progressValue != null && trophy.progressTarget != null && (
            <p className="roadmap-progress">
              {t('progress', { value: trophy.progressValue, target: trophy.progressTarget })}
            </p>
          )}
          <TrophyWhen trophy={trophy} game={game} />
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
  const kind = trophyKind(selected, game.guide)
  return (
    <div className="roadmap-landscape">
      <div className="roadmap-destination" data-tier={selected.type} key={anchor(selected)}>
        <span className="roadmap-destination-art">
          <TrophyArt url={hidden ? undefined : selected.iconUrl} />
        </span>
        <span className="roadmap-destination-copy">
          <span className="roadmap-state">
            {selected.earned ? t('earned') : suggested ? t('suggestion') : t('selected')}
          </span>
          <h3>{hidden ? t('secret') : selected.name}</h3>
          <span className="roadmap-destination-meta">
            <span className="roadmap-destination-type">
              <Icon name="trophy" />
              {t(selected.type === 'platinum' ? 'platinumType' : selected.type)}
            </span>
            {!hidden && kind && <span className={`roadmap-kind ${kind}`}>{t(`kind.${kind}`)}</span>}
            {!hidden && !selected.earned && (
              <RoadmapSignal
                missable={!!trophyAdvice(selected, game.guide).warning}
                final={selected.type === 'platinum'}
              />
            )}
          </span>
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
    () => ongoingObjectives(game.trophies, game.guide).map((x) => x.trophy),
    [game.trophies, game.guide],
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

function roadmapRisk(game: RoadmapGame, trophy: Trophy) {
  if (trophy.hidden || trophy.earned) return false
  return !!trophyAdvice(trophy, game.guide).warning
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
        stops: measuredStops(first?.parentElement ?? null),
      }
    : undefined
}

/**
 * Every stop's centre and rim inside its own column, since natural trophies are drawn smaller. The
 * road ends at a natural stop's border; the marker (`ring`) always goes round the outer ring line,
 * which a natural stop shows once selected.
 */
function measuredStops(track: HTMLElement | null, ring = false): RoadStopGeometry[] | undefined {
  const items = track ? [...track.querySelectorAll<HTMLElement>(':scope > li')] : []
  const stops = items.map((item) => {
    const box = item.getBoundingClientRect()
    const pin = item.querySelector('.roadmap-route-pin')?.getBoundingClientRect()
    // Big stops wear a 6px halo outside their border; small natural ones end at the border. It goes
    // by the kind, not the selection, so the road holds still while the selection moves along it.
    const halo = ring || item.dataset.kind !== 'natural' ? 6 : 0
    return pin?.width
      ? {
          x: pin.left - box.left + pin.width / 2,
          y: pin.top - box.top + pin.height / 2,
          rim: pin.width / 2 + halo,
        }
      : undefined
  })
  return stops.length && stops.every(Boolean) ? (stops as RoadStopGeometry[]) : undefined
}

/** Under a stop's name: what the trophy asks of the player. */
function RouteKind({ kind }: { kind?: TrophyKind }) {
  const t = useMessages(messages)
  if (!kind) return null
  return <small className="roadmap-route-kind">{t(`kind.${kind}`)}</small>
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
      const marker = geometry && { ...geometry, stops: measuredStops(track, true) }
      const paint = (value: number, scroll: number) => {
        position.current = value
        const point = roadPoint(value, width, marker)
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
            const kind = hidden ? undefined : trophyKind(trophy, game.guide)
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
                data-kind={kind}
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
                    <RouteKind kind={kind} />
                    {target === trophy && !trophy.earned && (
                      <small className="roadmap-suggested-label">{t('suggestion')}</small>
                    )}
                    {trophy.earned ? (
                      <>
                        <span className="sr-only">{t('routeEarned')}</span>
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
      aria-label={t(revealed ? 'hide' : 'reveal')}
      aria-pressed={revealed}
      disabled={saving}
      aria-busy={saving}
      title={`${t(revealed ? 'hide' : 'reveal')}: ${t('revealScope')}`}
      onClick={async () => {
        try {
          await setRevealed(!revealed)
        } catch {
          toast(t('revealFailed'))
        }
      }}
    >
      <Icon name={revealed ? 'eye-off' : 'eye'} />
      <span className="roadmap-visibility-label">{t(revealed ? 'hide' : 'reveal')}</span>
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

function roadmapFocus(game: RoadmapGame, done: boolean) {
  if (done || game.guide?.unobtainable) return undefined
  return game.focus?.trophy
}

export function TrophyRoadmap({
  game: source,
  preview = false,
}: {
  game: RoadmapGame
  preview?: boolean
}) {
  const t = useMessages(messages)
  const { revealed, setRevealed, saving } = useGameSpoilers(source.game.id)
  const inspecting = preview
  const game = useMemo(
    () => roadmapView(source, inspecting, revealed),
    [source, inspecting, revealed],
  )
  const stages = useMemo(
    () => trophyRoadmap(game.trophies, game.guide),
    [game.trophies, game.guide],
  )
  const base = game.trophies.filter((x) => x.groupId === 'default')
  // The platinum counts too, so the numbers add up to the total just above them.
  const parts = (['hunt', 'grind', 'natural', 'platinum'] as const).flatMap((kind) => {
    const count = base.filter((x) =>
      kind === 'platinum' ? x.type === 'platinum' : trophyKind(x, game.guide) === kind,
    ).length
    return count ? [t(`kindCount.${kind}`, { count })] : []
  })
  const classified = base.some((x) => trophyKind(x, game.guide))
  const kindCounts = classified ? parts.join(' · ') : ''
  const done = base.some((x) => x.type === 'platinum' && x.earned)
  const focus = roadmapFocus(game, done)
  const reference = stages.flatMap((s) => s.trophies)
  const ordered = personalRoadmap(reference, game.guide)
  const suggested = ordered.find(
    (x) => !x.earned && x.id === focus?.id && x.groupId === focus.groupId,
  )
  // Inspection still opens a milestone when the engine withholds a recommendation.
  // Only `suggested` may supply recommendation badges and the resume action.
  const defaultSelection =
    suggested ??
    ordered.find((x) => !x.earned && x.type !== 'platinum') ??
    ordered.find((x) => !x.earned) ??
    ordered.find((x) => x.type === 'platinum' && x.groupId === 'default') ??
    ordered.at(-1)
  const [selection, setSelection] = useState<string | null>(null)
  const selected = ordered.find((x) => anchor(x) === selection) ?? defaultSelection
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
    // data-game lets the usage plugin tell which game a tip rating is about, on any screen.
    <section
      className="trophy-roadmap"
      id="journey-roadmap"
      aria-labelledby="roadmap-heading"
      data-game={source.game.id}
    >
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
          {!!kindCounts && <p className="roadmap-kinds">{kindCounts}</p>}
        </div>
      </header>
      <p className="roadmap-preview-notice">
        <strong>
          <Icon name="warning" /> {t('betaLabel')}
        </strong>{' '}
        {t('betaNote')}
      </p>
      {!selected || !stage ? (
        <p>{t('empty')}</p>
      ) : (
        <>
          <div className="roadmap-expedition">
            <RoadmapNavigation
              game={game}
              ordered={ordered}
              selected={selected}
              target={suggested}
              choose={choose}
            />
            <RoadmapFocus game={game} selected={selected} target={suggested} />
            <RoadmapPhase game={game} trophy={selected} />
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
            <details className="roadmap-context-details">
              <summary>{t('progressContext')}</summary>
              <RoadmapOngoing game={game} choose={inspect} />
            </details>
          </div>
          {stage.kind !== 'phase' && (
            <p className="roadmap-context-note">{t(`${stage.kind}Note`)}</p>
          )}
          <footer className="roadmap-footer">
            <JourneyLink className="roadmap-ask" to={nexoHref(game.np, game.name)}>
              <Icon name="nexo" />
              {t('talk')}
            </JourneyLink>
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
