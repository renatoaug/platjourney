import type { CurrentGame, GuideDetail, Trophy } from '../lib/types'
import { current } from './index'

/** A made-up game whose guide has a route: synthetic names and progress, never a player's account. */
const NAMES = [
  ['platinum', 'Lenda', 'Conquiste todos os outros troféus.'],
  ['bronze', 'Primeiro Passo', 'Termine o capítulo 1.'],
  ['bronze', 'Mira Certeira', 'Acerte os cinco alvos do capítulo 2.'],
  ['bronze', 'Segundo Ato', 'Termine o capítulo 2.'],
  ['silver', 'Piedade', 'Poupe o guarda no capítulo 3.'],
  ['bronze', 'Terceiro Ato', 'Termine o capítulo 3.'],
  ['gold', 'Colecionador', 'Encontre todas as relíquias.'],
  ['silver', 'Perito', 'Vença o duelo sem levar dano.'],
  ['bronze', 'Fim da Jornada', 'Termine a história.'],
  ['silver', 'Sem Atalho', 'Conclua uma tarefa que o guia só cita de passagem.'],
] as const

const guide: GuideDetail = {
  ...(current.guide as GuideDetail),
  roadmap: [
    {
      phase: 'Fase 1 — História',
      goal: 'Avance pela história e pegue o que só existe em cada capítulo.',
      trophies: ['Primeiro Passo', 'Mira Certeira', 'Segundo Ato', 'Piedade', 'Terceiro Ato'],
    },
    {
      phase: 'Fase 2 — Reta final',
      goal: 'Termine a história e feche os objetivos longos.',
      trophies: ['Colecionador', 'Perito', 'Fim da Jornada'],
    },
    {
      phase: 'Fase 3 — Limpeza',
      goal: 'Volte pela seleção de capítulo para o que faltou.',
      trophies: ['Colecionador', 'Sem Atalho'],
    },
  ],
  milestones: [
    {
      after: 'Primeiro Passo',
      tips: [
        {
          kind: 'trophy',
          trophy: 'Mira Certeira',
          text: 'Carregue cada disparo: errar um alvo reinicia o desafio.',
        },
        {
          kind: 'collectible',
          trophy: 'Colecionador',
          text: 'Relíquia 1/3: atrás da fonte.',
          name: 'Relíquia 1/3',
          where: 'Praça do mercado',
          steps: ['Siga até a fonte', 'Contorne pela esquerda'],
          ifMissed: 'Volte pela seleção de capítulo.',
        },
      ],
    },
    {
      after: 'Segundo Ato',
      tips: [
        { kind: 'missable', trophy: 'Piedade', text: 'Não ataque o guarda ferido.' },
        {
          kind: 'collectible',
          trophy: 'Colecionador',
          text: 'Relíquia 2/3: no telhado da capela.',
        },
      ],
    },
    {
      after: 'Terceiro Ato',
      tips: [
        {
          kind: 'collectible',
          trophy: 'Colecionador',
          text: 'Relíquia 3/3: no porão da torre.',
        },
      ],
    },
  ],
  missables: [
    {
      trophy: 'Piedade',
      when: 'Capítulo 3, antes do portão',
      how: 'Passe pelo guarda ferido sem atacar.',
    },
  ],
  tricks: [{ trophy: 'Perito', trick: 'Use o bloqueio no terceiro golpe.' }],
  earlyTips: [],
  onlineTrophies: [],
  buggy: [],
  unobtainable: null,
}

function routeTrophies(earned: string[] = []): Trophy[] {
  return NAMES.map(([type, name, detail], id) => ({
    id,
    groupId: 'default',
    name,
    detail,
    type,
    earned: earned.includes(name),
  }))
}

/** The focus the server would send: the first open trophy in the guide's order. */
export function routeFocus(trophies: Trophy[]): CurrentGame['focus'] {
  const name = guide.roadmap
    .flatMap((phase) => phase.trophies)
    .find((n) => trophies.some((t) => t.name === n && !t.earned))
  const trophy = trophies.find((t) => t.name === name)
  return trophy ? ({ trophy, phases: [] } as unknown as CurrentGame['focus']) : null
}

export function routeGame(earned: string[] = []): CurrentGame {
  const trophies = routeTrophies(earned)
  return {
    ...current,
    game: { id: 'game:900001', name: 'Caminho de Exemplo' },
    name: 'Caminho de Exemplo',
    np: 'NPWR90000_00',
    icon: '',
    guide,
    trophies,
    focus: routeFocus(trophies),
  }
}
