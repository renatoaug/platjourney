import type { JourneyModel, JourneyObjective, JourneyText } from './model.ts'

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
const story: JourneyObjective[] = chapters.map(([pt, en], i) => ({
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
const optional: JourneyObjective[] = [
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
const collectibles: JourneyObjective[] = [
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
const upgrades: JourneyObjective[] = [
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
const skills: JourneyObjective[] = [
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
const misc: JourneyObjective[] = [
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
export const requiem: JourneyModel = {
  name: 'Requiem',
  version: 1,
  reviewedAt: '2026-11-03',
  planning: { kind: 'chapters', finalChapter: 17 },
  objectives: [
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
  ],
}
