import { evaluateJourney, type JourneyItem } from '../../../shared/journey/model.ts'
import { reviewedJourney } from '../../../shared/journey/registry.ts'
import { selectJourneySession } from '../../../shared/journey/session.ts'
import { defineMessages, Language, translator } from './i18n.ts'
import type { GameContext } from './nexo.ts'
import type { PlanStep, SessionPlan } from './planner.ts'
import type { TrophyStatus } from './psn.ts'
import type { User } from './repository/user.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    summary: 'Tempo reservado para avançar nos objetivos da jornada, sem promessa de desbloqueio.',
    budget:
      'Os minutos são blocos reservados, não estimativas. A duração restante e a posição no save não são conhecidas.',
    check:
      'Antes de começar, confira no jogo se o trecho, missão, equipamento e recursos necessários estão disponíveis. Se não estiverem, escolha outro objetivo.',
    prepare: 'Avance neste objetivo enquanto joga; não há garantia de concluí-lo nesta sessão.',
    recover: 'Confira a forma de recuperação antes de retomar este objetivo.',
    why: 'Selecionado pela mesma base revisada da jornada.',
    incomplete:
      'A lista de troféus não corresponde à base revisada. Atualize os dados antes de montar esta sessão.',
    unavailable:
      'Não há ações visíveis elegíveis para esta sessão. Confira os objetivos e a preferência de troféus ocultos na jornada.',
    unobtainable:
      'O guia indica uma platina indisponível. Confira essa limitação antes de planejar a sessão.',
    invalid: 'Escolha entre 15 e 600 minutos.',
    hidden: 'Troféu oculto',
    protected: 'Nome, descrição e orientação protegidos pela sua preferência de spoilers.',
    changed:
      'Este objetivo precisa ser conferido novamente. Monte outro roteiro com o estado atualizado da jornada.',
    sources: 'Fontes',
  },
  [Language.En]: {
    summary: 'Time reserved to work on journey objectives, without promising an unlock.',
    budget:
      'Minutes are reserved blocks, not estimates. Remaining duration and save location are unknown.',
    check:
      'Before starting, check that the required section, quest, equipment and resources are available in your game. Otherwise choose another objective.',
    prepare:
      'Work toward this objective as you play; completion in this session is not guaranteed.',
    recover: 'Check the recovery method before resuming this objective.',
    why: 'Selected from the same reviewed knowledge as the journey.',
    incomplete:
      'The trophy list does not match the reviewed knowledge. Refresh the data before building this session.',
    unavailable:
      'No visible actions are eligible for this session. Check the objectives and hidden-trophy preference in the journey.',
    unobtainable:
      'The guide marks this platinum as unobtainable. Check this limitation before planning the session.',
    invalid: 'Choose between 15 and 600 minutes.',
    hidden: 'Hidden trophy',
    protected: 'Name, description and guidance protected by your spoiler preference.',
    changed:
      'This objective needs checking again. Build another route with the updated journey state.',
    sources: 'Sources',
  },
})

export class JourneySessionUnavailable extends Error {}

const revealedFor = (user: User, ctx: GameContext) =>
  user.revealed_trophy_games?.includes(ctx.game.id) === true

function guidance(item: JourneyItem<TrophyStatus>, user: User) {
  const t = translator(messages, user)
  const language = user.locale === 'en' ? 'en' : 'pt'
  const o = item.objective
  return [
    t('check'),
    item.state === 'prepare' ? t('prepare') : item.state === 'recover' ? t('recover') : '',
    o.action[language],
    o.placement.evidence[language],
    o.approach?.[language],
    o.availability?.[language],
    item.state === 'recover' ? o.recovery?.[language] : undefined,
    `${t('sources')}: ${o.sources.map((url) => `[${new URL(url).hostname}](${url})`).join(' · ')}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Reviewed editions use deterministic selection; other editions keep the existing generator. */
export function journeySession(user: User, ctx: GameContext, minutes: number, avoid: string[]) {
  const edition = ctx.title.npCommunicationId
  const model = reviewedJourney({ ...ctx.game, np: edition })
  if (!model) return undefined
  const t = translator(messages, user)
  if (ctx.guide?.unobtainable) throw new JourneySessionUnavailable(t('unobtainable'))
  const selection = selectJourneySession(
    model,
    ctx.trophies,
    minutes,
    revealedFor(user, ctx),
    avoid,
  )
  if (selection.reason)
    throw new JourneySessionUnavailable(
      t(
        selection.reason === 'incomplete'
          ? 'incomplete'
          : selection.reason === 'invalid-time'
            ? 'invalid'
            : 'unavailable',
      ),
    )
  const steps: PlanStep[] = selection.steps.map((item) => ({
    trophy: item.trophy.name,
    trophyId: item.trophy.id,
    minutes: item.minutes,
    how: guidance(item, user),
    why: t('why'),
    trick: null,
    flexible: false,
    earns: false,
    journey: { edition, version: model.version, objective: item.objective.key },
  }))
  return {
    summary: t('summary'),
    steps,
    totalMinutes: steps.reduce((sum, step) => sum + step.minutes, 0),
    warnings: [t('budget')],
    ifTimeLeft: null,
  }
}

export const isJourneySession = (plan: Pick<SessionPlan, 'steps'>) =>
  plan.steps.length > 0 && plan.steps.every((step) => !!step.journey)

/** Re-evaluate a saved selection without writing history or silently adding new tasks. */
export function refreshJourneySession(plan: SessionPlan, ctx: GameContext | undefined, user: User) {
  const t = translator(messages, user)
  const edition = plan.npCommunicationId
  const model = edition ? reviewedJourney({ np: edition }) : undefined
  const same = ctx?.game.id === plan.game && ctx.title.npCommunicationId === edition
  const journey = model && same ? evaluateJourney(model, ctx.trophies) : undefined
  const complete = !!journey && journey.covered === journey.expected && !journey.unmatched.length
  const candidates = complete ? (journey?.candidates ?? []) : []
  const reveal = !!(same && revealedFor(user, ctx))
  const steps = plan.steps.map((step) => {
    const meta = step.journey
    const item = journey?.items.find(
      (x) => x.objective.key === meta?.objective && x.trophy.id === step.trophyId,
    )
    if (!item || (item.trophy.hidden && !item.trophy.earned && !reveal))
      return {
        ...step,
        journey: undefined,
        trophy: t('hidden'),
        how: t('protected'),
        why: t('why'),
        trick: null,
        done: false,
        iconUrl: null,
        detail: null,
        type: null,
        blocked: true,
      }
    const valid = complete && meta?.edition === edition && meta?.version === model?.version
    return {
      ...step,
      trophy: item.trophy.name,
      how:
        valid && (item.trophy.earned || candidates.includes(item))
          ? guidance(item, user)
          : t('changed'),
      why: t('why'),
      trick: null,
      done: item.trophy.earned,
      iconUrl: item.trophy.iconUrl ?? null,
      detail: item.trophy.detail ?? null,
      type: item.trophy.type,
      blocked: !item.trophy.earned && (!valid || !candidates.includes(item)),
    }
  })
  const next = candidates.find((item) =>
    steps.some((s) => !s.done && !s.blocked && s.trophyId === item.trophy.id),
  )
  return { steps, nextIndex: next ? steps.findIndex((s) => s.trophyId === next.trophy.id) : -1 }
}
