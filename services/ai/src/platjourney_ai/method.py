"""How Nexo thinks, kept in one place: how to pick the next platinum, plan a session and give a
trophy tip. Nexo's own prompts are built from these, and the app hands the same text to the
assistants a player connects through MCP, so a change here changes both."""

# Which game to platinum next, given the player's games, their last platinums and what they feel
# like now.
PICK = (
    'Weigh: a game they already started (high '
    'progress is a quick win), the length and difficulty after their last platinums (after two '
    'long or hard ones, something shorter; after short ones, they can take a big one), missables '
    'and online trophies (online first while servers are up), and their taste. Games under '
    '"Playing now" are not options: the player is on them, so the pick is what comes after; '
    'you may mention them. When the player says what they feel like right now (easy, short, to '
    'relax, after work, a challenge), that weighs more than anything else: hours and difficulty '
    'tell what is easy or short, genres tell what relaxes. If no game fits it, choose the closest, '
    'set fits to false and say so plainly in why. Use only the numbers given; never invent hours '
    'or difficulty.'
)

# Game names the player will look for on screen: a translated mission is one they cannot find.
NAMES = (
    'Missões, locais, itens e personagens vão escritos exatamente como no guia ou nos trechos: '
    'nunca traduza nem ajuste a grafia (se o trecho diz "Caida Libre", é "Caida Libre").'
)

# One play session: which missing trophies, in which order, within the time the player has.
PLAN = (
    'Escolha só troféus '
    'da lista "Faltando" que o jogador consegue pegar a partir de onde ele está (inferido pelos '
    'últimos conquistados e pelo roadmap do guia), priorizando: missables que estão por vir, '
    'troféus que saem naturalmente na história, e grinds que rendem mais se começados cedo. Some '
    'os minutos com folga e não ultrapasse o tempo disponível. Nunca inclua a platina nem '
    'troféus de DLC, a menos que não reste outro. A ordem importa: os passos são um roteiro, do '
    'primeiro ao último. Comece de onde o jogador parou: se ele conquistou troféus nos últimos '
    'dias, o primeiro passo continua daquele ponto do jogo (o mesmo capítulo, área ou modo), não '
    'de um ponto que ele já passou ou ainda não alcançou. Se ele pedir outro roteiro, monte um '
    'caminho diferente: troque os troféus do roteiro atual por outros que também cabem agora; '
    'repita um só se não houver outro possível, e diga por quê. Nenhum passo ocupa quase a '
    'sessão inteira: um troféu da história que leva muito tempo vem junto dos que saem no caminho '
    '(colecionáveis, desafios e extras das mesmas missões), para o jogador ver o roteiro andar.'
    f' {NAMES}'
)

# A tip about the game being played: what to put first, and what never to say.
TIP = (
    'Priorize: 1) troféus missables que o jogador ainda pode perder no ponto em que está; '
    '2) o que fazer agora; 3) o que evitar.\n'
    'Um troféu marcado "(já conquistado)" no guia já foi: nunca o sugira. Nunca invente nome de '
    'troféu: use só os da lista fornecida. Ao citar um troféu, use o nome em português (é o que '
    'aparece no console dele); os guias usam o nome em inglês, que está entre parênteses na lista. '
    f'{NAMES}'
)
