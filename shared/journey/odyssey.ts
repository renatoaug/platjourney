import type { JourneyDraft, JourneyModel } from './model.ts'

/** Reviewed base-game knowledge only. Save location, counters and quest state remain unknown. */
const objectives: JourneyDraft[] = [
  {
    key: 'prologue',
    names: ['Isso. É. Esparta!', 'This is Sparta!'],
    kind: 'story',
    order: 0,
    action: {
      pt: 'Confira no diário a próxima missão da campanha e seu nível recomendado. Este marco organiza a referência de história; não identifica sua missão atual.',
      en: 'Check the next campaign quest and its recommended level in the journal. This milestone organizes the story reference; it does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
  },
  {
    key: 'episode-1',
    names: ['Uma Odisseia em Progresso', 'An Odyssey in the Making'],
    kind: 'story',
    order: 10,
    action: {
      pt: 'Confira no diário a próxima missão da campanha e seu nível recomendado. Este marco organiza a referência de história; não identifica sua missão atual.',
      en: 'Check the next campaign quest and its recommended level in the journal. This milestone organizes the story reference; it does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
  },
  {
    key: 'episode-2',
    names: ['Erros Passados', 'Past Mistakes'],
    kind: 'story',
    order: 20,
    action: {
      pt: 'Confira no diário a próxima missão da campanha e seu nível recomendado. Este marco organiza a referência de história; não identifica sua missão atual.',
      en: 'Check the next campaign quest and its recommended level in the journal. This milestone organizes the story reference; it does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
  },
  {
    key: 'episode-3',
    names: ['Mal Descoberto', 'Evil Unearthed'],
    kind: 'story',
    order: 30,
    action: {
      pt: 'Confira no diário a próxima missão da campanha e seu nível recomendado. Este marco organiza a referência de história; não identifica sua missão atual.',
      en: 'Check the next campaign quest and its recommended level in the journal. This milestone organizes the story reference; it does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
  },
  {
    key: 'episode-4',
    names: ['Mentes Brilhantes', 'The Bright Minds'],
    kind: 'story',
    order: 40,
    action: {
      pt: 'Confira no diário a próxima missão da campanha e seu nível recomendado. Este marco organiza a referência de história; não identifica sua missão atual.',
      en: 'Check the next campaign quest and its recommended level in the journal. This milestone organizes the story reference; it does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
  },
  {
    key: 'episode-5',
    names: ['Das Cinzas', 'From the Ashes'],
    kind: 'story',
    order: 50,
    action: {
      pt: 'Confira no diário a próxima missão da campanha e seu nível recomendado. Este marco organiza a referência de história; não identifica sua missão atual.',
      en: 'Check the next campaign quest and its recommended level in the journal. This milestone organizes the story reference; it does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
  },
  {
    key: 'episode-6',
    names: ['A Queda da Democracia', 'Democracy Falls'],
    kind: 'story',
    order: 60,
    action: {
      pt: 'Confira no diário a próxima missão da campanha e seu nível recomendado. Este marco organiza a referência de história; não identifica sua missão atual.',
      en: 'Check the next campaign quest and its recommended level in the journal. This milestone organizes the story reference; it does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
  },
  {
    key: 'episode-7',
    names: ['Uma Lenda se Formando', 'Legend in the Making'],
    kind: 'story',
    order: 70,
    action: {
      pt: 'Confira no diário a próxima missão da campanha e seu nível recomendado. Este marco organiza a referência de história; não identifica sua missão atual.',
      en: 'Check the next campaign quest and its recommended level in the journal. This milestone organizes the story reference; it does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
  },
  {
    key: 'episode-8',
    names: ['Retomando Atenas', 'Taking Back Athens'],
    kind: 'story',
    order: 80,
    action: {
      pt: 'Confira no diário a próxima missão da campanha e seu nível recomendado. Este marco organiza a referência de história; não identifica sua missão atual.',
      en: 'Check the next campaign quest and its recommended level in the journal. This milestone organizes the story reference; it does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
  },
  {
    key: 'episode-9',
    names: ['Fim da Odisseia', 'Odyssey’s End'],
    kind: 'story',
    order: 90,
    action: {
      pt: 'Confira no diário a próxima missão da campanha e seu nível recomendado. Este marco organiza a referência de história; não identifica sua missão atual.',
      en: 'Check the next campaign quest and its recommended level in the journal. This milestone organizes the story reference; it does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
  },
  {
    key: 'romance',
    names: ['Nos Braços de Afrodite', 'Aphrodite’s Embrace'],
    kind: 'quest',
    order: 100,
    action: {
      pt: 'Quando surgir uma resposta com coração, acompanhe a oportunidade de romance até sua conclusão. Só escolher a fala não garante o troféu; não sabemos quais oportunidades restam no seu save.',
      en: 'When a heart-marked reply appears, follow the romance opportunity through to completion. Choosing a reply alone does not guarantee the trophy; we do not know which opportunities remain in your save.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
    risk: 'opportunity',
    recovery: {
      pt: 'Há várias oportunidades, mas as restantes no seu save são desconhecidas. O fim da história não prova que você perdeu todas elas.',
      en: 'There are multiple opportunities, but those remaining in your save are unknown. Finishing the story does not prove all of them are lost.',
    },
  },
  {
    key: 'contracts',
    names: ['Misthios Em Treinamento', 'Misthios in Training'],
    kind: 'counter',
    order: 110,
    action: {
      pt: 'Ao passar por um Quadro de Mensagens, aceite tarefas compatíveis com o que já pretende fazer e acompanhe os requisitos no diário. O objetivo são 20 recompensas, contratos de guerra ou missões navais desses quadros.',
      en: 'At a message board, accept tasks that overlap with your intended activities and track their requirements in the journal. The objective is 20 board bounties, war contracts or naval quests.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'shiny',
    names: ['Brilhante!', 'Shiny!'],
    kind: 'task',
    order: 120,
    action: {
      pt: 'Confira o inventário e equipe um item lendário que já possua. A conquista de história não informa o que está equipado agora.',
      en: 'Check your inventory and equip a legendary item you own. A story unlock does not reveal your current equipment.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['episode-2', 'legend', 'armor-set'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'first-upgrade',
    names: ['Melhor, Mais Rápido, Mais Forte', 'Harder, Better, Faster, Stronger'],
    kind: 'upgrade',
    order: 130,
    action: {
      pt: 'Quando tiver acesso ao menu da Adrasteia, compare os materiais disponíveis e faça uma melhoria. Não há necessidade de esperar o fim da campanha.',
      en: 'Once you can access the Adrestia menu, compare available materials and purchase an upgrade. You do not need to wait until the campaign ends.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['episode-1', 'ship', 'ram'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'hunt',
    names: ['Mestre da Caça', 'Master of the Hunt'],
    kind: 'quest',
    order: 140,
    action: {
      pt: 'Confira a missão das Filhas de Ártemis em Fócida. Planeje as caçadas pelo nível mostrado no seu jogo e conclua a sequência, sem presumir que todos os alvos já estão acessíveis.',
      en: 'Check the Daughters of Artemis quest in Phokis. Plan hunts using the levels shown in your game and complete the chain; we do not assume every target is already accessible.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'markos',
    names: ['"Todos saem ganhando!"', 'Everybody Benefits'],
    kind: 'quest',
    order: 150,
    action: {
      pt: 'Em Cós, procure o início da linha de Markos e acompanhe suas missões no diário até a conclusão. A PSN não informa quais etapas intermediárias estão abertas.',
      en: 'On Kos, look for the beginning of Markos’s questline and follow its journal entries to completion. PSN does not report intermediate quest availability.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'doctor',
    names: ['Confie em Mim, Eu Sou um Doutor', 'Trust Me, I’m a Doctor'],
    kind: 'quest',
    order: 160,
    action: {
      pt: 'Confira o diário e as missões de Hipócrates na Beócia. Se a sequência ainda não aparecer, verifique as tarefas locais e o avanço da campanha; não tratamos ausência do troféu como missão já liberada.',
      en: 'Check the journal and Hippokrates quests in Boeotia. If the chain has not appeared, check local tasks and campaign progress; a missing trophy does not mean the quest is unlocked.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'xenia',
    names: ['Uma Vida de Pirata Para Mim', 'A Pirate’s Life for Me'],
    kind: 'quest',
    order: 170,
    action: {
      pt: 'Confira em Ceos se a sequência de mapas de Xenia está no diário. Complete os requisitos mostrados pelo jogo antes de procurar os tesouros; ter encontrado a personagem não confirma que toda a linha abriu.',
      en: 'Check whether Xenia’s map questline is in your journal on Keos. Complete the in-game requirements before hunting treasures; meeting the character does not confirm the whole chain is open.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'olympics',
    names: ['Em Busca do Ouro', 'Going For Gold'],
    kind: 'quest',
    order: 180,
    action: {
      pt: 'Quando a sequência olímpica aparecer na campanha, siga suas missões pelo diário até concluir. Não deduzimos a missão atual pelo último troféu.',
      en: 'When the Olympic sequence appears in the campaign, follow its journal quests to completion. The last trophy does not identify your current quest.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'war-master',
    names: ['Mestre da Guerra', 'War Master'],
    kind: 'task',
    order: 190,
    action: {
      pt: 'Fora de Mégaris, reduza os recursos da região antes de eliminar o líder. Confira a condição na barra de poder regional; matar o líder antes disso não cumpre o objetivo.',
      en: 'Outside Megaris, lower the region’s resources before eliminating its leader. Check the regional power bar; killing the leader too early does not fulfill the objective.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'conquest',
    names: ['Herói Sob Contrato', 'Hero for Hire'],
    kind: 'task',
    order: 200,
    action: {
      pt: 'Fora de Mégaris, confira se há uma batalha de conquista terrestre disponível e vença uma. Escolha pelo mapa e pelo seu nível atual, que não recebemos da PSN.',
      en: 'Outside Megaris, check for an available land conquest battle and win one. Choose using your map and current level, which PSN does not provide.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'islands',
    names: ['De Ilha em Ilha', 'Island Hopper'],
    kind: 'counter',
    order: 210,
    action: {
      pt: 'Quando visitar Pefka, as ilhas Obsidianas ou Abântidas, aproveite as missões secundárias locais para a meta de 20. Não confunda esse objetivo com os contratos de Quadro de Mensagens.',
      en: 'When visiting Pephka, the Obsidian or Abantis islands, use local side quests toward the target of 20. Do not confuse this objective with message-board contracts.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'hermes',
    names: ['Companheiro de Hermes', 'Hermes’s Homie'],
    kind: 'collectible',
    order: 220,
    action: {
      pt: 'Ao viajar, revele sub-regiões e visite as pequenas ilhas. Não é necessário limpar todos os pontos de interrogação para esse objetivo; consulte o mapa do seu save para decidir o próximo trecho.',
      en: 'As you travel, reveal sub-regions and visit small islands. Clearing every question mark is not required for this objective; use your save’s map to choose the next area.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'poseidon',
    names: ['Cria de Poseidon', 'Child of Poseidon'],
    kind: 'collectible',
    order: 230,
    action: {
      pt: 'Ao encontrar um local submerso, use Ikaros para localizar os objetivos e complete o local. A meta cobre os locais subaquáticos do jogo base; não sabemos quais você já visitou.',
      en: 'When you find an underwater location, use Ikaros to locate its objectives and complete the site. The target covers base-game underwater locations; we do not know which you have visited.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'eye',
    names: ['Olhar de Desprezo', 'Stink Eye'],
    kind: 'task',
    order: 240,
    action: {
      pt: 'Depois da oportunidade inicial da campanha, volte a Cefalônia e confira a dica deste objetivo antes de procurar o item nas cabras. A obtenção é aleatória; não há número garantido de tentativas.',
      en: 'After the opening campaign opportunity, return to Kephallonia and check this objective’s guide before searching goats for the item. The drop is random; there is no guaranteed attempt count.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['episode-1'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'birthright',
    names: ['Legado', 'Birthright'],
    kind: 'quest',
    order: 250,
    action: {
      pt: 'Confira se a missão A Family’s Legacy está disponível após o requisito de campanha indicado no diário. Siga essa linha do jogo base; ela não exige comprar a expansão de Atlântida.',
      en: 'Check whether A Family’s Legacy is available after its campaign requirement in the journal. Follow this base-game questline; it does not require purchasing the Atlantis expansion.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'cyclops',
    names: ['De Olho na Recompensa', 'Eye on the Prize'],
    kind: 'quest',
    order: 260,
    action: {
      pt: 'Consulte a linha de missões ligada a este encontro e o nível recomendado no jogo. Prepare equipamento antes do combate; ausência do troféu não informa se a missão já abriu.',
      en: 'Check this encounter’s questline and the recommended level in your game. Prepare equipment before combat; a missing trophy does not reveal whether its quest is open.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'minotaur',
    names: ['Labi(rindo) do Minotauro', 'A-maze-ing Victory!'],
    kind: 'quest',
    order: 270,
    action: {
      pt: 'Confira no diário a linha de missões deste encontro e conclua seus requisitos antes de buscar o combate. Não assumimos seu nível ou localização.',
      en: 'Check this encounter’s questline in the journal and complete its requirements before seeking the fight. We do not assume your level or location.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'sphinx',
    names: ['Enigma da Esfinge', 'Riddle Me This'],
    kind: 'quest',
    order: 280,
    action: {
      pt: 'Quando a missão deste encontro estiver disponível, anote as perguntas e confira as respostas antes de confirmar os símbolos. Não precisamos revelar as soluções narrativas antecipadamente.',
      en: 'Once this encounter’s quest is available, note the questions and check the answers before confirming symbols. Narrative solutions do not need to be revealed in advance.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'medusa',
    names: ['À Imagem de Perseu', 'In Perseus’s Image'],
    kind: 'quest',
    order: 290,
    action: {
      pt: 'Confira no diário os requisitos e o nível recomendado deste encontro. Prepare-se pelo estado real do personagem antes de tentar; o roteiro não estima seu poder de combate.',
      en: 'Check this encounter’s requirements and recommended level in the journal. Prepare using your actual character state; the roadmap does not estimate combat strength.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'epic-ship',
    names: ['Flagelo do Egeu', 'Scourge of the Aegean'],
    kind: 'task',
    order: 300,
    action: {
      pt: 'Durante a navegação, identifique um navio épico pelo marcador e confira se consegue enfrentá-lo. Para este objetivo, afunde o navio.',
      en: 'While sailing, identify an epic ship by its marker and check whether you can handle the fight. Sink the ship for this objective.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['episode-1', 'ram'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'ram',
    names: ['Velocidade Máxima', 'Ramming Speed'],
    kind: 'task',
    order: 310,
    action: {
      pt: 'Enfraqueça um navio inimigo sem abordá-lo e use o aríete contra seu centro em velocidade. Combine com o objetivo de tripulação feminina se já tiver essa aparência disponível.',
      en: 'Weaken an enemy ship without boarding it, then ram its center at speed. Combine this with the female-crew objective if you already have that crew appearance.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['episode-1', 'epic-ship'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'arena-mercenary',
    names: ['Esporte de Sangue', 'Blood Sport'],
    kind: 'task',
    order: 320,
    action: {
      pt: 'Na Arena, confira se um mercenário está entre os adversários disponíveis. Os campeões fixos não substituem esse requisito; volte quando houver um mercenário na lista.',
      en: 'At the Arena, check whether a mercenary is among the available opponents. The fixed champions do not replace this requirement; return when a mercenary is listed.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['arena'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'arena',
    names: ['Não se Divertiram?', 'Are You Not Entertained?'],
    kind: 'task',
    order: 330,
    action: {
      pt: 'Confira os cinco desafios da Arena e avance pelos que correspondem ao seu equipamento e nível. Concluir um combate não significa que todos os campeões foram vencidos.',
      en: 'Check the five Arena challenges and take those suited to your equipment and level. One completed fight does not mean every champion has been defeated.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['arena-mercenary'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'mercenary',
    names: ['Topo da Cadeia Alimentar', 'Top of the Food Chain'],
    kind: 'counter',
    order: 340,
    action: {
      pt: 'Abra o menu de Mercenários e priorize adversários acima da sua posição até chegar ao primeiro patamar. Não basta derrotar qualquer mercenário; confira a progressão no próprio menu.',
      en: 'Open the Mercenaries menu and prioritize opponents above your position until reaching the first tier. Defeating arbitrary mercenaries is not enough; check progress in that menu.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'cult-branch',
    names: ['Uma Cabeça a Menos…', 'One Head Down…'],
    kind: 'task',
    order: 350,
    action: {
      pt: 'Quando o menu do culto estiver aberto, confira pistas de um ramo e resolva os requisitos mostrados. Feche um ramo completo sem presumir que todos os alvos já estão acessíveis.',
      en: 'Once the cult menu is open, check one branch’s clues and resolve the displayed requirements. Complete a branch without assuming every target is already accessible.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['episode-3', 'spear', 'cult'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'cult',
    names: ['O Culto Desmascarado', 'The Cult Unmasked'],
    kind: 'counter',
    order: 360,
    action: {
      pt: 'Use o menu do culto para acompanhar pistas e requisitos de missões durante a campanha. Mantenha os fragmentos obtidos para as melhorias da lança; alguns alvos dependem de outras atividades.',
      en: 'Use the cult menu to track clues and quest requirements during the campaign. Keep obtained fragments for spear upgrades; some targets depend on other activities.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'spear',
    names: ['Legado Restaurado', 'Legacy Restored'],
    kind: 'upgrade',
    order: 370,
    action: {
      pt: 'Confira o nível da lança e os fragmentos no seu save; use a forja quando houver recursos suficientes. O objetivo é nível 6, sem estimar os fragmentos restantes pela lista de troféus.',
      en: 'Check the spear level and fragments in your save; use the forge when resources permit. The objective is tier 6; remaining fragments cannot be estimated from trophies.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'level',
    names: ['Semideus', 'Demigod'],
    kind: 'counter',
    order: 380,
    action: {
      pt: 'Combine missões, contratos e atividades ainda necessárias à platina para ganhar experiência até o nível 50. Sem o nível atual, não estimamos horas ou experiência restantes.',
      en: 'Combine quests, contracts and activities still needed for platinum to gain experience toward level 50. Without your current level, we do not estimate remaining hours or XP.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'lieutenant',
    names: ['Você Trabalha para Mim Agora', 'You Work for Me Now'],
    kind: 'task',
    order: 390,
    action: {
      pt: 'Quando o recrutamento estiver disponível, identifique um NPC lendário, nocauteie sem matar, recrute e designe-o no menu do navio.',
      en: 'Once recruitment is available, identify a legendary NPC, knock them out without killing, recruit them and assign them in the ship menu.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['episode-1', 'argonauts'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'argonauts',
    names: ['Os Argonautas', 'The Argonauts'],
    kind: 'counter',
    order: 400,
    action: {
      pt: 'Durante a exploração, procure recrutas lendários e preserve-os no combate. Confira os espaços liberados no navio e designe quatro tenentes lendários quando puder.',
      en: 'While exploring, look for legendary recruits and spare them in combat. Check unlocked ship slots and assign four legendary lieutenants when possible.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'ship',
    names: ['Senhor dos Mares', 'Lord of the Seas'],
    kind: 'upgrade',
    order: 410,
    action: {
      pt: 'Guarde materiais e tabuletas antigas encontrados na exploração para as melhorias da Adrasteia. Leve as categorias ao status lendário exigido pelo troféu; confira os recursos no menu antes de melhorar.',
      en: 'Save materials and ancient tablets found while exploring for Adrestia upgrades. Bring categories to the legendary status required by the trophy; check resources in the menu before upgrading.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.neoseeker.com/assassins-creed-odyssey/Achievements_%26_Trophies/Achievement_Trophy_Guide',
      'https://www.ubisoft.com/en-au/game/assassins-creed/news/3KW6ZY3smNzX7gKsHFnsuO/assassins-creed-odyssey-114-patch-notes-updates',
    ],
    ongoing: true,
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'legend',
    names: ['Eu Sou a Lenda', 'I am Legend'],
    kind: 'task',
    order: 420,
    action: {
      pt: 'Confira se já possui arma corpo a corpo e peças de armadura lendárias para todos os espaços exigidos. Equipe o conjunto de categorias; não é necessário inferir inventário pela campanha.',
      en: 'Check whether you own a legendary melee weapon and legendary armor for every required slot. Equip those categories; campaign trophies do not reveal inventory.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'armor-set',
    names: ['Credo Fashionista', 'Fashion’s Creed'],
    kind: 'task',
    order: 430,
    action: {
      pt: 'Confira os conjuntos lendários no inventário e equipe todas as peças de um mesmo conjunto. Peças lendárias avulsas não necessariamente formam um conjunto.',
      en: 'Check legendary sets in your inventory and equip all pieces of one set. Separate legendary items do not necessarily form a set.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['hunt'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'engrave',
    names: ['Deixe Sua Marca', 'Make It Your Own'],
    kind: 'task',
    order: 440,
    action: {
      pt: 'Em um ferreiro, confira as gravações liberadas e os materiais para gravar um item. Escolha uma melhoria útil para o equipamento que usa.',
      en: 'At a blacksmith, check unlocked engravings and materials to engrave an item. Choose an improvement useful for your equipment.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['midas'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'midas',
    names: ['Toque de Midas', 'The Midas Touch'],
    kind: 'task',
    order: 450,
    action: {
      pt: 'No ferreiro, aplique um efeito lendário liberado a um item lendário compatível. Confira efeito, item e recursos antes de confirmar.',
      en: 'At a blacksmith, apply an unlocked legendary effect to a compatible legendary item. Check effect, item and resources before confirming.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['shiny', 'legend'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'ability',
    names: ['Poder dos Deuses', 'Godly Power'],
    kind: 'task',
    order: 460,
    action: {
      pt: 'Confira os requisitos da árvore de habilidades e da lança para comprar o terceiro nível de uma habilidade ativa. Um troféu de campanha não comprova que esses requisitos estão atendidos.',
      en: 'Check the ability tree and spear requirements to purchase tier three of an active ability. A campaign trophy does not prove those requirements are met.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'overpower',
    names: ['Eu Tenho a Força', 'I Have the Power'],
    kind: 'task',
    order: 470,
    action: {
      pt: 'Quando as habilidades de ataque avassalador estiverem disponíveis, use-as com cada tipo de arma exigido, incluindo arco. Confira as habilidades e adrenalina no jogo antes de tentar.',
      en: 'Once Overpower abilities are available, use them with each required weapon type, including the bow. Check abilities and adrenaline in-game before attempting.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'bounty',
    names: ['Infame', 'Infamous'],
    kind: 'task',
    order: 480,
    action: {
      pt: 'Confira a barra de recompensa e prepare equipamento antes de elevá-la ao máximo. Não pague a recompensa enquanto tenta esse objetivo; não sabemos o nível atual da barra.',
      en: 'Check the bounty meter and prepare equipment before raising it to maximum. Do not pay the bounty while attempting this objective; we do not know its current level.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'amazons',
    names: ['A Ira das Amazonas', 'Wrath of the Amazons'],
    kind: 'task',
    order: 490,
    action: {
      pt: 'Se já tiver uma aparência de tripulação feminina, equipe-a e parta um navio com o aríete. A aparência da tripulação é diferente dos espaços de tenentes.',
      en: 'If you own a female crew appearance, equip it and cleave a ship by ramming. Crew appearance is distinct from lieutenant slots.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    evidenceAny: ['hunt', 'olympics'],
    availability: {
      pt: 'Confira no jogo a missão, nível, recursos ou equipamento necessários. Troféus não confirmam o estado atual do seu save.',
      en: 'Check the required quest, level, resources or equipment in-game. Trophies do not confirm your current save state.',
    },
  },
  {
    key: 'platinum',
    names: ['Ciclo Épico', 'Epic Cycle'],
    kind: 'platinum',
    order: 999,
    action: {
      pt: 'Conclua os 50 outros troféus do jogo base e aguarde a confirmação da PSN. DLC e contos adicionais não são requisitos desta platina.',
      en: 'Complete the other 50 base-game trophies and wait for PSN confirmation. DLC and additional tales are not requirements for this platinum.',
    },
    sources: [
      'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/',
      'https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/',
    ],
    requires: [
      'prologue',
      'episode-1',
      'episode-2',
      'episode-3',
      'episode-4',
      'episode-5',
      'episode-6',
      'episode-7',
      'episode-8',
      'episode-9',
      'romance',
      'contracts',
      'shiny',
      'first-upgrade',
      'hunt',
      'markos',
      'doctor',
      'xenia',
      'olympics',
      'war-master',
      'conquest',
      'islands',
      'hermes',
      'poseidon',
      'eye',
      'birthright',
      'cyclops',
      'minotaur',
      'sphinx',
      'medusa',
      'epic-ship',
      'ram',
      'arena-mercenary',
      'arena',
      'mercenary',
      'cult-branch',
      'cult',
      'spear',
      'level',
      'lieutenant',
      'argonauts',
      'ship',
      'legend',
      'armor-set',
      'engrave',
      'midas',
      'ability',
      'overpower',
      'bounty',
      'amazons',
    ],
  },
]

const ids: Record<string, number> = {
  prologue: 1,
  'episode-1': 2,
  'episode-2': 3,
  'episode-3': 4,
  'episode-4': 5,
  'episode-5': 6,
  'episode-6': 7,
  'episode-7': 8,
  'episode-8': 9,
  'episode-9': 10,
  romance: 39,
  contracts: 45,
  shiny: 14,
  'first-upgrade': 37,
  hunt: 30,
  markos: 31,
  doctor: 32,
  xenia: 33,
  olympics: 34,
  'war-master': 44,
  conquest: 48,
  islands: 46,
  hermes: 23,
  poseidon: 11,
  eye: 22,
  birthright: 41,
  cyclops: 26,
  minotaur: 25,
  sphinx: 27,
  medusa: 24,
  'epic-ship': 35,
  ram: 42,
  'arena-mercenary': 36,
  arena: 16,
  mercenary: 20,
  'cult-branch': 40,
  cult: 21,
  spear: 19,
  level: 17,
  lieutenant: 13,
  argonauts: 29,
  ship: 28,
  legend: 15,
  'armor-set': 38,
  engrave: 12,
  midas: 50,
  ability: 18,
  overpower: 43,
  bounty: 47,
  amazons: 49,
  platinum: 0,
}

const source = 'https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/'
// Source-backed opportunity placement, never a requirement to unlock in this order.
const windows: Record<
  string,
  { order: number; after: string; before: string; pt: string; en: string }
> = {
  'first-upgrade': {
    order: 11,
    after: 'episode-1',
    before: 'episode-2',
    pt: 'Com acesso ao navio',
    en: 'With ship access',
  },
  shiny: {
    order: 21,
    after: 'episode-2',
    before: 'episode-3',
    pt: 'Após o episódio 2',
    en: 'After episode 2',
  },
  romance: {
    order: 29,
    after: 'episode-2',
    before: 'episode-3',
    pt: 'Oportunidades no ep. 3 e depois',
    en: 'Opportunities in ep. 3 and later',
  },
  birthright: {
    order: 68,
    after: 'episode-6',
    before: 'episode-7',
    pt: 'Missão disponível no ep. 7',
    en: 'Quest available in ep. 7',
  },
  olympics: {
    order: 69,
    after: 'episode-6',
    before: 'episode-7',
    pt: 'Cadeia de missões no ep. 7',
    en: 'Questline in ep. 7',
  },
}
const evidence: Record<string, { pt: string; en: string }> = {
  'first-upgrade': {
    pt: 'A primeira melhoria depende do menu do navio e de materiais, não do fim da campanha. O marco do episódio 1 é evidência de acesso, não de recursos suficientes.',
    en: 'The first upgrade needs the ship menu and materials, not campaign completion. Episode 1 provides access evidence, not proof of enough resources.',
  },
  shiny: {
    pt: 'O episódio 2 concede um item lendário; é preciso equipá-lo. Outros itens lendários também servem, e o troféu pode ser conquistado em outro momento.',
    en: 'Episode 2 awards a legendary item; it must be equipped. Other legendary items also qualify, and the trophy may unlock at another time.',
  },
  romance: {
    pt: 'Há uma oportunidade documentada no episódio 3 e outras posteriores. O marco não garante que a missão está ativa ou que uma oportunidade foi perdida.',
    en: 'A documented opportunity exists in episode 3, with others later. The milestone does not prove an active quest or a lost opportunity.',
  },
  birthright: {
    pt: 'A missão é liberada durante o episódio 7, após uma missão principal específica. Ter ou não o troféu final do episódio não identifica o ponto exato do diário.',
    en: 'The quest unlocks during episode 7 after a specific main quest. The episode trophy does not identify the exact journal state.',
  },
  olympics: {
    pt: 'A cadeia começa durante o episódio 7. Confira as missões no diário; não precisa aguardar o final da campanha.',
    en: 'The questline begins during episode 7. Check the journal; campaign completion is not required.',
  },
}
function placement(o: JourneyDraft): JourneyModel['objectives'][number]['placement'] {
  const window = windows[o.key]
  if (o.kind === 'story') {
    const episode = o.key.startsWith('episode-') ? Number(o.key.slice(8)) : 0
    return {
      kind: 'story',
      after: episode === 1 ? 'prologue' : episode > 1 ? `episode-${episode - 1}` : undefined,
      label: {
        pt: episode ? `Episódio ${episode}` : 'Prólogo',
        en: episode ? `Episode ${episode}` : 'Prologue',
      },
      evidence: {
        pt: 'Sequência dos marcos da campanha; não representa sua localização atual nem impõe ordem às atividades paralelas.',
        en: 'Campaign milestone sequence; it does not represent your current location or impose order on parallel activities.',
      },
      sources: [source],
    }
  }
  if (window)
    return {
      kind: 'window',
      after: window.after,
      before: window.before,
      label: { pt: window.pt, en: window.en },
      evidence: evidence[o.key],
      sources: [source],
    }
  if (o.kind === 'platinum')
    return {
      kind: 'destination',
      label: { pt: 'Destino', en: 'Destination' },
      evidence: {
        pt: 'Depende dos 50 demais troféus do jogo base. DLC não é necessário.',
        en: 'Requires the other 50 base-game trophies. DLC is not needed.',
      },
      sources: [source],
    }
  return {
    kind: 'parallel',
    label: { pt: 'Ordem flexível', en: 'Flexible order' },
    evidence: {
      pt: 'Pode ser trabalhado em paralelo quando os requisitos no jogo estiverem disponíveis. A posição entre atividades é editorial; não há evidência de uma sequência obrigatória.',
      en: 'Can be pursued in parallel once its in-game requirements are available. Placement among activities is editorial; no mandatory sequence is established.',
    },
    sources: [source],
  }
}
export const odyssey: JourneyModel = {
  edition: 'NPWR13822_00',
  name: 'Odyssey',
  version: 2,
  reviewedAt: '2026-11-04',
  planning: { kind: 'open-world', finale: 'episode-9' },
  objectives: objectives.map((o) => ({
    ...o,
    trophyId: ids[o.key],
    groupId: 'default',
    order: windows[o.key]?.order ?? o.order,
    placement: placement(o),
  })),
}
