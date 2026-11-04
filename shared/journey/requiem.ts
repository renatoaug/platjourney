import type { JourneyDraft, JourneyModel, JourneyObjective, JourneyText } from './model.ts'

const primary = 'https://www.powerpyx.com/a-plague-tale-requiem-trophy-guide-roadmap/'
const secondary = 'https://platget.com/guides/a-plague-tale-requiem-trophy-guide/'
const text = (pt: string, en: string): JourneyText => ({ pt, en })
const replay = text(
  'Se esse trecho já passou, consulte a seleção de capítulos. A conquista só será concluída após confirmação da PSN.',
  'If you have passed this section, check chapter select. Only PSN confirmation completes the trophy.',
)
const chapters = [
  ['Sob um Novo Sol', 'Under a New Sun'],
  ['Recém-chegados', 'Newcomers'],
  ['Fardo de Sangue', 'A Burden of Blood'],
  ['Dever da Protetora', 'Protector’s Duty'],
  ['Em Nosso Encalço', 'In our Wake'],
  ['Tudo para Trás', 'Leaving all Behind'],
  ['Malfeitores', 'Felons'],
  ['Mar de Promessas', 'A Sea of Promises'],
  ['Contos e Revelações', 'Tales and Revelations'],
  ['Linhagem', 'Bloodline'],
  ['Berço Secular', 'The Cradle of Centuries'],
  ['A Vida que Merecemos', 'The Life We Deserve'],
  ['Não Sobrou Nada', 'Nothing Left'],
  ['Feridas Curadas', 'Healing our Wounds'],
  ['Sol Mortiço', 'Dying Sun'],
  ['Rei Hugo', 'King Hugo'],
  ['Cavaleiros!', 'Knights!'],
] as const
const story: JourneyDraft[] = chapters.map(([pt, en], i) => ({
  key: `chapter-${i + 1}`,
  names: [pt, en],
  kind: 'story',
  chapter: i + 1,
  order: (i + 1) * 10,
  action: text(
    `Para continuar a campanha, confira as oportunidades do capítulo ${i + 1} antes de encerrá-lo. A ordem é uma referência, não uma indicação de onde você está.`,
    `To continue the campaign, check chapter ${i + 1} opportunities before finishing it. This order is a reference, not your current location.`,
  ),
  sources: [primary, secondary],
}))
const optional: JourneyDraft[] = [
  {
    key: 'perfect-shot',
    names: ['Mira perfeita', 'Perfect shot'],
    chapter: 1,
    action: text(
      'No desafio das pinhas, conclua os disparos exigidos. Confira a dica específica antes de encerrar o trecho.',
      'Complete the required shots in the pinecone challenge. Check its specific instructions before leaving.',
    ),
  },
  {
    key: 'mercy',
    names: ['Piedade', 'Mercy'],
    chapter: 4,
    action: text(
      'No encontro das docas, preserve a vida do guarda. Consulte a orientação antes de usar munição nele.',
      'At the docks encounter, keep the guard alive. Check the instructions before using ammunition on him.',
    ),
  },
  {
    key: 'perfect-throw',
    names: ['Arremesso perfeito', 'Perfect throw'],
    chapter: 8,
    action: text(
      'No minijogo das coroas, complete todos os arremessos. É uma oportunidade do trecho, não uma tarefa para depois da história.',
      'Complete every throw in the crowns minigame. This is a section opportunity rather than a post-story task.',
    ),
  },
  {
    key: 'old-protector',
    names: ['Antiga protetora', 'Old protector'],
    chapter: 9,
    action: text(
      'No santuário, examine os itens opcionais antes de avançar a conversa que encerra a visita.',
      'In the sanctuary, examine the optional items before advancing the conversation that ends the visit.',
    ),
  },
].map((x) => ({
  ...x,
  names: x.names as [string, string],
  kind: 'chapter',
  order: x.chapter * 10 - 1,
  risk: 'replay',
  recovery: replay,
  sources: [primary, secondary],
}))
const collectAction = text(
  'Aproveite a exploração para procurar os itens deste objetivo. Consulte as indicações por capítulo; não é necessário marcar cada item no app.',
  'Look for this objective’s items as you explore. Consult chapter guidance; there is no need to check off each item in the app.',
)
const collectibles: JourneyDraft[] = [
  ['herbalist', 'Herbalista', 'Herbalist'],
  ['ornithologist', 'Ornitóloga', 'Ornithologist'],
  ['explorer', 'Exploradora', 'Explorer'],
  ['memories', 'Memórias imortais', 'Immortal memories'],
].map(([key, pt, en], i) => ({
  key,
  names: [pt, en],
  kind: 'collectible',
  order: 180 + i,
  prepareFrom: 1,
  action:
    key === 'explorer'
      ? text(
          'Reserve uma faca para abrir baús secretos. Usá-la em combate pode exigir voltar a um trecho anterior para buscar outra.',
          'Keep a knife for secret chests. Using it in combat may require returning to an earlier section for another.',
        )
      : collectAction,
  recovery: replay,
  sources: [primary, secondary],
}))
const upgradeAction = text(
  'Recolha ferramentas e peças ao explorar e confira as melhorias restantes nas bancadas. Continue com recursos obtidos no jogo; este roteiro não depende de fechar o app para desfazer compras.',
  'Collect tools and pieces while exploring and check remaining workbench upgrades. Use resources earned in the game; this route does not rely on closing the app to undo purchases.',
)
const upgrades: JourneyDraft[] = [
  ['sling', 'Brinquedo nada', 'Not a toy anymore'],
  ['crossbow', 'Balestra aprimorada', 'Improved crossbow'],
  ['gear', 'Bolsos e mais bolsos', 'Handful of pockets'],
  ['instruments', 'Instrumentos eficazes', 'Effective instruments'],
  ['alchemy', 'Laboratório de bolso', 'Pocket laboratory'],
].map(([key, pt, en], i) => ({
  key,
  names: [pt, en],
  kind: 'upgrade',
  order: 190 + i,
  prepareFrom: 1,
  action: upgradeAction,
  recovery: text(
    'Confira os recursos e melhorias mantidos no seu save antes de escolher continuar ou usar New Game+.',
    'Check the resources and upgrades retained in your save before choosing to continue or use New Game+.',
  ),
  sources: [primary, secondary],
}))
const skillAction = text(
  'Quando o menu de habilidades estiver disponível, confira esta barra antes de escolher como abordar o próximo encontro. Não é possível deduzir a barra pela ausência do troféu. Na New Game+, priorize as habilidades que ainda faltam.',
  'Once the skills menu is available, check this bar before choosing how to approach the next encounter. A missing trophy does not reveal its progress. In New Game+, prioritize the skills still missing.',
)
const skills: JourneyDraft[] = [
  ['prudence', 'Discreta', 'Sneaky'],
  ['aggressive', 'Lutadora', 'Fighter'],
  ['opportunism', 'Maligna', 'Malignant'],
].map(([key, pt, en], i) => ({
  key,
  names: [pt, en],
  kind: 'skill',
  order: 210 + i,
  prepareFrom: 1,
  risk: 'skill-carryover',
  action: skillAction,
  approach:
    key === 'prudence'
      ? text(
          'Para desenvolver prudência, atravesse os encontros evitando eliminar inimigos. Confira a barra após o encontro antes de repetir a abordagem.',
          'To develop Prudence, pass encounters while avoiding enemy kills. Check the bar afterward before repeating the approach.',
        )
      : key === 'aggressive'
        ? text(
            'Para desenvolver combate, priorize eliminar os inimigos do encontro. Confira a barra depois; não estimamos o avanço restante.',
            'To develop Aggressive, prioritize eliminating the encounter’s enemies. Check the bar afterward; we do not estimate the remaining progress.',
          )
        : text(
            'Para desenvolver oportunismo, procure eliminar aproximadamente metade dos inimigos de cada encontro e deixe os demais vivos. Confira a barra após concluir o encontro.',
            'To develop Opportunism, aim to eliminate roughly half the enemies in each encounter and leave the others alive. Check the bar after completing the encounter.',
          ),
  recovery: text(
    'Antes de avançar muito na segunda campanha, confira as barras restantes. Voltar por seleção de capítulo restaura o estado daquele ponto e pode exigir rejogar os trechos seguintes.',
    'Before advancing far into the second campaign, check remaining skill bars. Chapter select restores the state at that point and may require replaying subsequent sections.',
  ),
  sources: [primary, secondary],
}))
const misc: JourneyDraft[] = [
  {
    key: 'night-guard',
    names: ['Guarda noturna', 'Night guard'],
    kind: 'counter',
    order: 200,
    prepareFrom: 3,
    action: text(
      'Quando Extinguis estiver disponível, aproveite os fogos que encontrar para avançar este objetivo. Sem contador confirmado, não estimamos quantos faltam.',
      'Once Extinguis is available, use fires you encounter to advance this objective. Without a confirmed counter, we do not estimate how many remain.',
    ),
    recovery: replay,
    sources: [primary, secondary],
  },
  {
    key: 'alchemist',
    names: ['Alquimista', 'Alchemist'],
    kind: 'counter',
    order: 201,
    prepareFrom: 3,
    action: text(
      'Fabrique munições com os recursos encontrados: o objetivo exige 100 fabricações, não uma combinação de tipos. Sem contador confirmado, não estimamos quantas faltam.',
      'Craft ammunition using resources you find: the objective requires 100 crafts, not a combination of types. Without a confirmed counter, we do not estimate how many remain.',
    ),
    recovery: replay,
    sources: [primary, secondary],
  },
]
const objectives = [...story, ...optional, ...collectibles, ...upgrades, ...skills, ...misc]

const collectibleSource =
  'https://www.powerpyx.com/a-plague-tale-requiem-all-collectibles-locations-guide/'
const ids: Record<string, number> = {
  herbalist: 18,
  ornithologist: 19,
  explorer: 20,
  memories: 21,
  sling: 22,
  crossbow: 23,
  gear: 24,
  instruments: 25,
  alchemy: 26,
  'night-guard': 27,
  alchemist: 28,
  prudence: 29,
  aggressive: 30,
  opportunism: 31,
  'perfect-shot': 32,
  'perfect-throw': 33,
  'old-protector': 34,
  mercy: 35,
  platinum: 0,
}
const finishes: Record<string, [number, number]> = {
  memories: [13, 126],
  ornithologist: [13, 127],
  explorer: [13, 128],
  herbalist: [16, 159],
}
function placement(o: JourneyDraft): JourneyObjective['placement'] {
  const chapter = o.chapter ?? 0
  const finish = finishes[o.key]?.[0]
  if (o.kind === 'story')
    return {
      kind: 'story',
      after: chapter > 1 ? `chapter-${chapter - 1}` : undefined,
      label: text(`Capítulo ${chapter}`, `Chapter ${chapter}`),
      evidence: text(
        `Este troféu confirma a conclusão do capítulo ${chapter}, não a posição atual do save.`,
        `This trophy confirms chapter ${chapter} completion, not the current save location.`,
      ),
      sources: o.sources,
    }
  if (finish)
    return {
      kind: 'window',
      after: `chapter-${finish - 1}`,
      before: `chapter-${finish}`,
      label: text(`Pode concluir no cap. ${finish}`, `Can finish in ch. ${finish}`),
      evidence: text(
        `O último item deste conjunto está no capítulo ${finish}. Esta posição só representa a conclusão possível se os anteriores foram obtidos; a preparação começa antes e itens perdidos podem ser recuperados.`,
        `The last item in this set is in chapter ${finish}. This is only a possible completion point if earlier items were collected; preparation starts earlier and missing items can be recovered.`,
      ),
      sources: [collectibleSource],
    }
  if (o.kind === 'chapter')
    return {
      kind: 'window',
      after: chapter > 1 ? `chapter-${chapter - 1}` : undefined,
      before: `chapter-${chapter}`,
      label: text(`Oportunidade · cap. ${chapter}`, `Opportunity · ch. ${chapter}`),
      evidence: text(
        `A oportunidade ocorre dentro do capítulo ${chapter}, antes do troféu de encerramento. Pode ser recuperada depois por seleção de capítulos.`,
        `This opportunity occurs within chapter ${chapter}, before its completion trophy. It can be recovered later through chapter select.`,
      ),
      sources: o.sources,
    }
  if (o.kind === 'platinum')
    return {
      kind: 'destination',
      label: text('Destino', 'Destination'),
      evidence: text(
        'Exige os demais troféus do jogo base, sem DLC.',
        'Requires the other base-game trophies, without DLC.',
      ),
      sources: o.sources,
    }
  return {
    kind: 'parallel',
    label: text('Em paralelo', 'In parallel'),
    evidence: text(
      'A ordem entre estes objetivos depende da exploração, recursos e estilo de jogo. A posição no mapa não é uma previsão de desbloqueio.',
      'Order depends on exploration, resources and playstyle. Map position is not an unlock prediction.',
    ),
    sources: o.sources,
  }
}
function identify(drafts: JourneyDraft[]): JourneyObjective[] {
  return drafts.map((o) => ({
    ...o,
    trophyId: o.kind === 'story' ? Number(o.key.slice(8)) : ids[o.key],
    groupId: 'default',
    order: finishes[o.key]?.[1] ?? o.order,
    prepareFrom: o.key === 'crossbow' ? 5 : o.kind === 'skill' ? 2 : o.prepareFrom,
    completionChapter: finishes[o.key]?.[0],
    placement: placement(o),
  }))
}

export const requiem: JourneyModel = {
  edition: 'NPWR22997_00',
  name: 'Requiem',
  version: 2,
  reviewedAt: '2026-11-04',
  planning: { kind: 'chapters', finalChapter: 17 },
  objectives: identify([
    ...objectives,
    {
      key: 'platinum',
      names: ['Réquiem', 'Requiem'],
      kind: 'platinum',
      order: 999,
      requires: objectives.map((x) => x.key),
      action: text(
        'Conclua os demais troféus do jogo base e aguarde a confirmação da platina pela PSN.',
        'Complete the other base-game trophies and wait for PSN to confirm the platinum.',
      ),
      sources: [primary, secondary],
    },
  ]),
}
