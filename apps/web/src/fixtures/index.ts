/** Sample data for the stories and the tests: a real game guide and trophies, no player data. */

import type { CurrentGame, Tip } from '../lib/types'

export const current: CurrentGame = {
  game: {
    id: 'game:19561',
    name: 'DAYS GONE',
  },
  name: 'DAYS GONE',
  platform: 'PS4',
  icon: 'https://image.api.playstation.com/trophy/np/NPWR17130_00_002D14DB28AA079AB444D1AA3527D40F8F780DBAEE/81687E4B5151D16193E5EC2A558719BBCB6BD363.PNG',
  progress: 13,
  earned: 12,
  total: 61,
  np: 'NPWR17130_00',
  groups: {
    base: {
      definedByType: {
        bronze: 28,
        gold: 2,
        platinum: 1,
        silver: 15,
      },
      earned: 12,
      earnedByType: {
        bronze: 11,
        gold: 0,
        platinum: 0,
        silver: 1,
      },
      remaining: 33,
      total: 46,
    },
    dlc: {
      definedByType: {
        bronze: 9,
        gold: 2,
        platinum: 0,
        silver: 4,
      },
      earned: 0,
      earnedByType: {
        bronze: 0,
        gold: 0,
        platinum: 0,
        silver: 0,
      },
      remaining: 15,
      total: 15,
    },
    dlcNames: [
      'DAYS GONE: Modo de Sobrevivência',
      'DAYS GONE: Modo Desafio',
      'DAYS GONE: Novo Jogo+',
    ],
  },
  hoursPlayed: 18,
  guide: {
    autopop:
      'A lista do PS4 serve para PS4 e PS5 pela retrocompatibilidade. Days Gone Remastered, de PS5, tem lista própria com troféus novos; importar o save do PS4 pelo menu principal do Remastered faz a platina pipocar lá se Um por cento já estiver conquistado. Não conte com auto-pop no sentido contrário, do Remastered para o PS4.',
    buggy: [
      {
        issue:
          'A linha de história trava em 92% mesmo com as 12 zonas de infestação limpas, e o troféu não sai.',
        reported: 'relatos de 2019 na versão de PS4',
        status: 'old',
        trophy: 'Exterminador de Infestações',
        workaround:
          'Faltam os 8 ninhos de corvos infectados (Crier Nests), que só existem em Crater Lake e na Highway 97; queime-os com dardos incendiários. Se ainda assim não sair, recarregar um save anterior à última infestação e refazê-la resolveu para alguns.',
      },
      {
        issue:
          'Segundo relatos, o troféu não registra mesmo parecendo que derrapagem e nitro duraram 5 segundos; a contagem parece exigir derrapagem contínua sem a roda sair do chão.',
        reported: 'relatos de 2019 a 2022 na versão de PS4',
        status: 'old',
        trophy: 'Burnout Apocalipse',
        workaround:
          'Círculo largo em terreno plano, R2 só até a metade e pneus mais fracos; giro parado no lugar não conta.',
      },
    ],
    collectibles:
      'A platina não pede todos: Atração de beira de estrada partida exige mais de 75% dos 240 colecionáveis (181) e Pretendente a caçador de tesouros mais de 50% (121). Dois tipos saem automaticamente com a história, o menu mostra o progresso por tipo e região, e nada necessário é perdível.',
    difficulty: 3,
    difficultyTrophy: null,
    earlyTips: [
      'Saqueie todo corpo humano desde o começo; Tá sujo de vermelho pede 541 itens e, depois da história, humano vira raridade no mapa.',
      'Antes de saquear, gaste ou fabrique itens para abrir espaço no inventário: com a bolsa cheia o item não é recolhido e não conta.',
      'Mate o Quebrador da missão Jogando a Noite Toda (Playing All Night) com a faca: enfraqueça com armas e dê só o último golpe com a faca de bota.',
      'Venda orelhas de Frenético sem medo; Me dê ouvidos conta o total coletado, não o que está na bolsa.',
      'Concentre as compras no Acampamento do Lago Lost, do Iron Mike, para Chuva de grana sair naturalmente; os créditos de cada acampamento são separados.',
    ],
    easiest: {
      trophy: 'De raspão',
      why: "Sai sozinho ao escapar do Crazy Willie's, logo no começo da história.",
    },
    glossary: [
      {
        meaning:
          'os infectados do jogo; cada um deixa uma orelha, e Me dê ouvidos pede 989 delas, que continuam contando mesmo depois de vendidas.',
        term: 'Frenéticos / Freakers',
      },
      {
        meaning:
          'as variantes especiais de Frenético (Breaker, Reacher e Rager); Isto é uma faca pede matar um deles com o golpe final da faca.',
        term: 'Quebrador, Célere e Rábido',
      },
      {
        meaning:
          'grupo de centenas de Frenéticos que anda junto; cada horda derrotada dá muitas orelhas, pontos de habilidade e confiança, e depois dos créditos todas ficam marcadas no mapa.',
        term: 'Horda',
      },
      {
        meaning:
          'base de sobreviventes com créditos e confiança próprios; Chuva de grana pede 20.000 créditos gastos em um só, e Melhores amigos para sempre (na vida) pede Aliado em três.',
        term: 'Acampamento',
      },
      {
        meaning:
          'o nível 3 de confiança de um acampamento; é ele que libera as melhores peças, como o Nitro 3 do Acampamento do Lago Diamond, e é o que os troféus de amizade pedem.',
        term: 'Confiança Aliado',
      },
      {
        meaning:
          'as três atividades de limpeza do mapa; cada uma tem sua linha de história com troféu, e Hora da festa, galera pede todas as três limpas numa mesma região.',
        term: 'Emboscadas, Infestações e Pontos de Controle da NERO',
      },
      {
        meaning:
          'as injeções guardadas nos Pontos de Controle e locais de pesquisa da NERO que melhoram Saúde, Energia ou Foco; Desempenho melhorado pede um desses três no máximo.',
        term: 'NERO Injectors',
      },
      {
        meaning:
          'ninhos de corvos infectados que só aparecem nas duas últimas regiões; sem queimá-los, Exterminador de Infestações trava em 92%.',
        term: 'Crier Nests',
      },
    ],
    hardest: {
      trophy: 'Burnout Apocalipse',
      why: 'Não é difícil de entender, mas é o mais inconsistente da platina: exige o Nitro 3, que só sai com confiança Aliado no Lago Diamond, e manter derrapagem e nitro juntos por 5 segundos, o que costuma levar de meia hora a uma hora de tentativas.',
    },
    hasMissables: false,
    hasOnline: false,
    hours: 70,
    missables: [],
    mostTedious: {
      trophy: 'Tá sujo de vermelho',
      why: 'São 541 itens tirados só de corpos humanos, com o inventário precisando de espaço a cada saque; quem ignora durante a campanha passa de 10 a 15 horas no pós-jogo caçando humanos.',
    },
    onlineTrophies: [],
    overview:
      'A platina de Days Gone é longa, mas bem tranquila: não tem troféu online, nada é perdível de verdade e nenhum troféu da platina depende de dificuldade, então dá para jogar no fácil. O trabalho está nos contadores grandes (541 itens de corpos humanos, 989 orelhas, 45 habilidades e confiança Aliado em três acampamentos) e num troféu de moto inconsistente, Burnout Apocalipse, que só dá para tentar com o Nitro 3.',
    playthroughs: 1,
    pointOfNoReturn:
      'Há dois pontos sem volta temporários, no fim da região do Lago Lost e no fim de Crater Lake: eles bloqueiam áreas por um tempo, mas depois dos créditos o mapa inteiro reabre e dá para limpar acampamentos, hordas, colecionáveis e troféus restantes.',
    postgame:
      'Depois dos créditos o mapa inteiro reabre em mundo livre, com todas as hordas marcadas, e dá para limpar qualquer troféu que faltou. O Novo Jogo+ e os modos Sobrevivência e Desafio, que vieram em atualizações gratuitas, têm troféus próprios fora da platina.',
    roadmap: [
      {
        goal: 'Zere a campanha fazendo os trabalhos dos acampamentos e limpando emboscadas, infestações e Pontos de Controle da NERO conforme aparecem. O saque de corpos humanos precisa andar desde já, porque depois da história sobra pouco humano no mapa. Na missão Jogando a Noite Toda (Playing All Night) aproveite o Quebrador com barra de vida para Isto é uma faca.',
        phase: 'Fase 1 — História em qualquer dificuldade, saqueando todo humano',
        trophies: [
          'De raspão',
          'Entrega especial',
          'Os fins e os meios',
          'Achados e perdidos',
          'Irmãos de armas',
          'Recupere seu nome',
          'Rodando NÔMADE',
          'Segura firme',
          'Tá começando a esfriar',
          'Morior Invictus',
          'Eu tava esperando por isso',
          'Days Done',
          'Tá sujo de vermelho',
          'Isto é uma faca',
          'Caçador de  Emboscadas',
          'Exterminador de Infestações',
          'Caçador de Saqueadores',
          'Fim do mundo',
          'Primeira Compra',
          'Vivendo melhor com a química',
          'Ele é o Bom ',
          'Faça você mesmo no Oregon',
          'Entregador da cozinha',
          'Quem achar primeiro',
          'Variedade dá gosto à vida',
          'Velha e confiável ',
          'O fantasma de Farewell',
          'A arte de consertar motocicletas',
          'Sobreviver não é viver',
          'Original de Farewell',
          'Chuva de grana',
        ],
      },
      {
        goal: 'Depois dos créditos o mapa reabre e as hordas ficam marcadas. Matá-las fecha a confiança Aliado em três acampamentos, as 45 habilidades e as orelhas; com o Lago Diamond no Aliado, compre o Nitro 3.',
        phase: 'Fase 2 — Pós-jogo: hordas, confiança e habilidades',
        trophies: [
          'Uma já foi',
          'Me dê ouvidos',
          'Melhores amigos para sempre',
          'Melhores amigos para sempre (na vida)',
          'Sou o dono da festa',
          'Não uso espelho pra me pentear',
          'Pertenço aos dez mais',
          'Desempenho melhorado',
        ],
      },
      {
        goal: 'Chegue a mais de 75% dos colecionáveis, derrube as pilhas de pedra Anarquistas, confira a limpeza de uma região inteira e faça os dois troféus de derrapagem.',
        phase: 'Fase 3 — Colecionáveis, moto e clean-up',
        trophies: [
          'Pretendente a caçador de tesouros',
          'Atração de beira de estrada partida',
          'Chuta-pedra',
          'Hora da festa, galera',
          'Derrapagem de Farewell',
          'Burnout Apocalipse',
          'Um por cento',
        ],
      },
      {
        goal: 'Modo Sobrevivência, Modo Desafio e Novo Jogo+ têm troféus próprios que não contam para Um por cento. Só vale se você quiser a lista completa: exigem dificuldade alta (Sobrevivência, Difícil II ou Sobrevivência II) e medalhas de ouro nos desafios.',
        phase: 'Fase 4 — Opcional para 100%, não para a platina',
        trophies: [
          'Sobreviver é viver',
          'Days Gone em 60 segundos',
          'Prêmio de participação',
          'O segundo maioral',
          'Garoto de ouro',
          'Ficou muito bem em mim',
          'Digno',
          'Regras da equipe de ouro',
          'Mandou bem, rapaz',
          'Eu sou rica!',
          'Perdido e condenado',
          'Temos que pegar',
          'Mais uma jornada',
          '+ Days + Gone',
          'A sombra de Logan',
        ],
      },
    ],
    sources: ['Trophy Guides', 'Platinum Forum', 'Trophy Wiki'],
    tricks: [
      {
        source: 'Trophy Guides e Platinum Forum',
        trick:
          'Com o Nitro 3 comprado no Acampamento do Lago Diamond (pede confiança Aliado), vá à margem rasa do lago ao lado do Acampamento do Lago Lost, do Iron Mike, ou ao cruzamento ao norte do Lago Diamond. Ganhe velocidade, vire o analógico todo para um lado segurando Círculo, e quando a traseira soltar acione o nitro com X, segurando o R2 só até a metade. Faça um círculo largo, não um giro parado; trocar para pneus mais fracos ajudou vários jogadores.',
        trophy: 'Burnout Apocalipse',
      },
      {
        source: 'Trophy Guides e Platinum Forum',
        trick:
          "Pare a moto e segure Círculo + analógico para um lado + R2 para girar no lugar; o tempo acumula. Faça isso num posto de combustível, como o do abrigo de O'Leary Mountain, para reabastecer sem sair dali até somar 10 minutos.",
        trophy: 'Derrapagem de Farewell',
      },
      {
        source: 'Trophy Guides e Platinum Forum',
        trick:
          'Na missão da história Jogando a Noite Toda (Playing All Night), em Iron Butte, o Quebrador aparece com barra de vida. Atire até ele ficar quase sem vida e troque para a faca de bota para o último golpe; só o golpe final precisa ser da faca.',
        trophy: 'Isto é uma faca',
      },
      {
        source: 'Trophy Guides e Platinum Forum',
        trick:
          "Os dardos liberam em pontos fixos: Resíduo depois da missão Eles Não Estão Dormindo (They're Not Sleeping), Envenenado depois de Eu Tenho um Plano (I've Got a Plan), Incendiário com 8 Emboscadas limpas e Explosivo com 12. Fabrique um de cada e mate um inimigo comum com cada tipo.",
        trophy: 'Variedade dá gosto à vida',
      },
      {
        source: 'Trophy Guides e Platinum Forum',
        trick:
          'Leve os acampamentos ao nível 2 com trabalhos e missões e deixe o Aliado para o pós-jogo matando hordas, que dão muita confiança. Escolha o Lago Diamond (você precisa dele para o Nitro 3), o Lago Lost e a Ilha Wizard.',
        trophy: 'Melhores amigos para sempre (na vida)',
      },
      {
        source: 'Trophy Guides',
        trick:
          'Deixe o grosso para as hordas do pós-jogo, que têm centenas de Frenéticos cada. Dá para recolher orelhas passando de moto por cima dos corpos, sem descer.',
        trophy: 'Me dê ouvidos',
      },
    ],
    unobtainable: null,
    version: 2,
  },
  trophies: [
    {
      iconUrl:
        'https://image.api.playstation.com/trophy/np/NPWR17130_00_002D14DB28AA079AB444D1AA3527D40F8F780DBAEE/F14D5D4E9ABB8082E3FDFC5FA320CE30D1C19EE7.PNG',
      hidden: true,
      groupId: 'default',
      id: 1,
      name: 'De raspão',
      detail: "Escape do Crazy Willie's",
      nameEn: 'Just a Flesh Wound',
      detailEn: "Get out of Crazy Willie's",
      type: 'bronze',
      rarity: 'Comum',
      earnedRate: 79.6,
      earned: true,
      earnedAt: '2026-09-01T20:00:00Z',
    },
    {
      iconUrl:
        'https://image.api.playstation.com/trophy/np/NPWR17130_00_002D14DB28AA079AB444D1AA3527D40F8F780DBAEE/5D72243529C85C66730543D6120928F7D681D55C.PNG',
      hidden: true,
      groupId: 'default',
      id: 2,
      name: 'Entrega especial',
      detail: 'Faça uma entrega a Tucker ou Copeland',
      nameEn: 'Special Delivery',
      detailEn: 'Make a delivery to Tucker or Copeland',
      type: 'bronze',
      rarity: 'Comum',
      earnedRate: 53.7,
      earned: true,
      earnedAt: '2026-09-01T20:00:00Z',
    },
    {
      iconUrl:
        'https://image.api.playstation.com/trophy/np/NPWR17130_00_002D14DB28AA079AB444D1AA3527D40F8F780DBAEE/E0184026F79387B0501EC3F0F1D0B108D43473C6.PNG',
      hidden: true,
      groupId: 'default',
      id: 3,
      name: 'Os fins e os meios',
      detail: 'Descubra o que aconteceu com a NERO',
      nameEn: 'The Ends and the Means',
      detailEn: 'Discover what happened to NERO',
      type: 'bronze',
      rarity: 'Comum',
      earnedRate: 58.2,
      earned: true,
      earnedAt: '2026-09-01T20:00:00Z',
    },
    {
      iconUrl:
        'https://image.api.playstation.com/trophy/np/NPWR17130_00_002D14DB28AA079AB444D1AA3527D40F8F780DBAEE/BB451D3602FC1E63DA03F708193D82ACFA5A7260.PNG',
      hidden: false,
      groupId: 'default',
      id: 0,
      name: 'Um por cento',
      detail: 'Supere e vá ALÉM, liberando todos os troféus de Days Gone',
      nameEn: 'One Percenter',
      detailEn: 'Go above and BEYOND, unlocking every trophy in Days Gone',
      type: 'platinum',
      rarity: 'Ultra rara',
      earnedRate: 4.2,
      earned: false,
    },
    {
      iconUrl:
        'https://image.api.playstation.com/trophy/np/NPWR17130_00_002D14DB28AA079AB444D1AA3527D40F8F780DBAEE/973B649AA5477007096BD2B2CC137668FA298A73.PNG',
      hidden: true,
      groupId: 'default',
      id: 5,
      name: 'Irmãos de armas',
      detail: 'Fale com o Boozer',
      nameEn: 'Brothers in Arm',
      detailEn: 'Check up on Boozer',
      type: 'bronze',
      rarity: 'Rara',
      earnedRate: 36.5,
      earned: false,
    },
    {
      iconUrl:
        'https://image.api.playstation.com/trophy/np/NPWR17130_00_002D14DB28AA079AB444D1AA3527D40F8F780DBAEE/87196E878BBEDA7E5AA2DEB938675891F4EE9269.PNG',
      hidden: true,
      groupId: 'default',
      id: 6,
      name: 'Recupere seu nome',
      detail: 'Retribua o favor',
      nameEn: 'Take Back Your Name',
      detailEn: 'Return the favor',
      type: 'bronze',
      rarity: 'Rara',
      earnedRate: 33.2,
      earned: false,
    },
    {
      iconUrl:
        'https://image.api.playstation.com/trophy/np/NPWR17130_00_002D14DB28AA079AB444D1AA3527D40F8F780DBAEE/5F0CABB93984CA1E843F4D0D9E3B104195DF0F54.PNG',
      hidden: true,
      groupId: 'default',
      id: 7,
      name: 'Rodando NÔMADE',
      detail: 'Pegue a estrada sozinho',
      nameEn: 'Riding NOMAD',
      detailEn: 'Take to the road alone',
      type: 'bronze',
      rarity: 'Rara',
      earnedRate: 32.6,
      earned: false,
    },
    {
      iconUrl:
        'https://image.api.playstation.com/trophy/np/NPWR17130_00_002D14DB28AA079AB444D1AA3527D40F8F780DBAEE/34A9ABC7CDAFC61FD986854068294A3905485B79.PNG',
      hidden: true,
      groupId: 'default',
      id: 8,
      name: 'Segura firme',
      detail: 'Veja um rosto conhecido',
      nameEn: 'Hold on Tight',
      detailEn: 'See a familiar face',
      type: 'bronze',
      rarity: 'Rara',
      earnedRate: 32.4,
      earned: false,
    },
  ],
}

export const tips: Tip[] = [
  {
    id: 'tip:0',
    kind: 'unlock',
    content: '🏆 Achados e perdidos (bronze, 40.2% de quem joga) em DAYS GONE',
    created_at: '2026-09-29T15:44:53Z',
    game: { id: 'game:19561', name: 'Days Gone' },
  },
  {
    id: 'tip:1',
    kind: 'session',
    content: 'Boa sessão: caiu **Faça você mesmo no Oregon** e você tá com 11/46 do jogo base.',
    created_at: '2026-09-28T22:10:00Z',
    game: { id: 'game:19561', name: 'Days Gone' },
  },
  {
    id: 'tip:2',
    kind: 'start',
    content: 'Começou Days Gone. O guia já está pronto: 3/10, ~70h, sem perdíveis.',
    created_at: '2026-09-20T18:00:00Z',
    game: { id: 'game:19561', name: 'Days Gone' },
  },
]
