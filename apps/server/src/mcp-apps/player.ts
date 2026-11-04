/** The player's views for assistants that render MCP Apps: the taste profile, a game the assistant
 * recommends and a trophy it explains. The assistant does the thinking, so none of this runs the
 * app's model. A view only shows what the assistant passed and what the app knows, and its buttons
 * call tools through the same path as every other MCP tool. */
import { trophiesFor } from '../demo.ts'
import { defineMessages, Language } from '../i18n.ts'
import { library } from '../library.ts'
import {
  type Args,
  gameArg,
  gameFrom,
  ownCopy,
  type Tool,
  ToolError,
  WHY,
} from '../mcp-tools/shared.ts'
import { catalogTrophies } from '../psn.ts'
import { changedPrefs, emptyPrefs, readPrefs, tasteOf } from '../recommend.ts'
import { listInterests } from '../repository/interest.ts'
import { guideFacts } from '../repository/similar.ts'
import { type User, updateUser } from '../repository/user.ts'
import { currentOrCheck } from '../watcher.ts'
import { IMAGE_HOSTS, type McpApp, view } from './view.ts'

const TASTE_URI = 'ui://platjourney/taste-profile-v6.html'
const PICK_URI = 'ui://platjourney/platinum-pick-v9.html'
const TROPHY_URI = 'ui://platjourney/trophy-card-v9.html'

const localeOf = (user: User) => (user.locale === 'en' ? Language.En : Language.PtBR)

const tasteTexts = defineMessages({
  [Language.PtBR]: {
    title: 'Seu gosto por platinas',
    lead: 'Tire o que não combina, acrescente o que faltou e confira antes de salvar.',
    genres: 'Gêneros',
    traits: 'O que você busca',
    avoid: 'O que prefere evitar',
    add: 'Acrescentar',
    remove: 'Tirar {item}',
    noMissables: 'Sem troféus perdíveis',
    noOnline: 'Sem troféus online',
    review: 'Revisar alterações',
    save: 'Confirmar e salvar',
    nothing: 'Nenhuma alteração para salvar.',
    added: 'Acrescentar: {items}',
    removed: 'Tirar: {items}',
    filterOn: 'Ligar filtro: {name}',
    filterOff: 'Desligar filtro: {name}',
    saved: 'Preferências salvas.',
    empty: 'Ainda não há um perfil. Você já pode dizer o que busca.',
    failed: 'Não foi possível salvar. Nada foi alterado.',
  },
  [Language.En]: {
    title: 'Your platinum taste',
    lead: 'Remove what does not fit, add what is missing and check it before saving.',
    genres: 'Genres',
    traits: 'What you look for',
    avoid: 'What you avoid',
    add: 'Add',
    remove: 'Remove {item}',
    noMissables: 'No missable trophies',
    noOnline: 'No online trophies',
    review: 'Review changes',
    save: 'Confirm and save',
    nothing: 'Nothing to save.',
    added: 'Add: {items}',
    removed: 'Remove: {items}',
    filterOn: 'Turn on filter: {name}',
    filterOff: 'Turn off filter: {name}',
    saved: 'Preferences saved.',
    empty: 'There is no profile yet. You can already say what you look for.',
    failed: 'Could not save. Nothing changed.',
  },
})

const LISTS_HTML = ['genres', 'traits', 'avoid']
  .map(
    (key) =>
      `<div class="stack"><h3 data-t="${key}"></h3><div class="row" id="${key}"></div><div class="row" data-list="${key}"><input type="text" maxlength="40" data-p="add"><button type="button" data-t="add"></button></div></div>`,
  )
  .join('')

const tasteView = view(TASTE_URI, 'PlatJourney: taste profile', {
  messages: tasteTexts,
  body: `<div class="pad"><div class="stack"><span class="lead">PlatJourney</span><h1 data-t="title"></h1><p class="muted" data-t="lead"></p></div><p class="muted" id="empty" data-t="empty" hidden></p>${LISTS_HTML}<div><label><input id="noMissables" type="checkbox"><span data-t="noMissables"></span></label><label><input id="noOnline" type="checkbox"><span data-t="noOnline"></span></label></div><div class="stats" id="summaryBox" hidden><div class="stack"><p id="summary" aria-live="polite"></p></div></div><div class="row"><button id="save" class="primary" type="button" data-t="save" hidden></button><button id="review" type="button" data-t="review"></button></div><p class="error" id="error" role="alert" hidden></p></div>`,
  script: `
const LISTS = ['genres', 'traits', 'avoid'];
const FLAGS = ['noMissables', 'noOnline'];
let base = null, add = {}, remove = {};
const reset = (data) => { base = data; add = { genres: [], traits: [], avoid: [] }; remove = { genres: [], traits: [], avoid: [] }; FLAGS.forEach((f) => { $(f).checked = data.filters?.[f] === true; }); paint(); };
const shown = (key) => [...(base?.profile?.[key] ?? []).filter((x) => !remove[key].includes(x)), ...add[key]];
function paint() {
  $('empty').hidden = !!base?.profile;
  LISTS.forEach((key) => $(key).replaceChildren(...shown(key).map((item) => {
    const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = item;
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', say(T.remove, { item }));
    x.onclick = () => { if (add[key].includes(item)) add[key] = add[key].filter((y) => y !== item); else remove[key].push(item); stale(); paint(); };
    chip.append(x); return chip;
  })));
}
const stale = () => { $('save').hidden = true; $('summaryBox').hidden = true; };
const flagChanges = () => Object.fromEntries(FLAGS.filter((f) => $(f).checked !== (base?.filters?.[f] === true)).map((f) => [f, $(f).checked]));
// The sandbox refuses a form's submit, so the field answers to its button and to Enter directly.
document.querySelectorAll('[data-list]').forEach((row) => {
  const key = row.dataset.list; const input = row.querySelector('input');
  const addItem = () => { const item = input.value.trim(); input.value = ''; if (!item || shown(key).includes(item)) return; if (remove[key].includes(item)) remove[key] = remove[key].filter((y) => y !== item); else add[key].push(item); stale(); paint(); };
  row.querySelector('button').onclick = addItem;
  input.onkeydown = (event) => { if (event.key === 'Enter') addItem(); };
});
FLAGS.forEach((f) => { $(f).onchange = stale; });
$('review').onclick = () => {
  const lines = [];
  LISTS.forEach((key) => { if (add[key].length) lines.push(T[key] + ' · ' + say(T.added, { items: add[key].join(', ') })); if (remove[key].length) lines.push(T[key] + ' · ' + say(T.removed, { items: remove[key].join(', ') })); });
  Object.entries(flagChanges()).forEach(([f, on]) => lines.push(say(on ? T.filterOn : T.filterOff, { name: T[f] })));
  $('summaryBox').hidden = false; $('summary').textContent = lines.join('\\n') || T.nothing; $('save').hidden = !lines.length;
};
$('save').onclick = async () => {
  $('error').hidden = true; $('save').disabled = true;
  try { reset(await callTool('change_taste_preferences', { add, remove, filters: flagChanges() })); $('summary').textContent = T.saved; $('save').hidden = true; }
  catch { $('error').hidden = false; $('error').textContent = T.failed; }
  finally { $('save').disabled = false; }
};
window.onResult = ({ structuredContent: data }) => { if (data) { language(data.locale); reset(data); } };`,
})

const pickTexts = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'Sua próxima platina',
    why: 'Por que este jogo',
    first: 'Por onde começar',
    difficulty: 'Dificuldade',
    hours: 'Tempo até a platina',
    hoursUnit: ' horas',
    progress: 'Progresso',
    add: 'Adicionar aos interesses',
    added: 'Nos seus interesses',
    open: 'Ver no app',
    failed: 'Não foi possível adicionar. Tente de novo.',
  },
  [Language.En]: {
    eyebrow: 'Your next platinum',
    why: 'Why this game',
    first: 'Where to start',
    difficulty: 'Difficulty',
    hours: 'Time to platinum',
    hoursUnit: ' hours',
    progress: 'Progress',
    add: 'Add to interests',
    added: 'In your interests',
    open: 'See in the app',
    failed: 'Could not add it. Try again.',
  },
})

const OPEN_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg>'

const ICONS: Record<string, string> = {
  gauge:
    '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 14l4-4"/><path d="M3.500 18a10 10 0 1 1 17 0"/></svg>',
  clock:
    '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pie: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9h-9z"/></svg>',
  trophy:
    '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/></svg>',
  check:
    '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  target:
    '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
  gem: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9zM2 9h20"/></svg>',
  spark:
    '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.500 6.500L21 12l-6.500 2.500L12 21l-2.500-6.500L3 12l6.500-2.500z"/></svg>',
  flag: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 21V4h13l-3 4 3 4H5"/></svg>',
  compass:
    '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.500 8.500-2 5-5 2 2-5z"/></svg>',
}

// One number on the rule: its icon beside the same two lines, so they all line up.
const STAT = `
const ICONS = ${JSON.stringify(ICONS)};
const stat = (icon, label, value, unit) => {
  const tile = document.createElement('div'); tile.className = 'stat';
  const mark = document.createElement('span'); mark.className = 'stat-icon'; mark.innerHTML = ICONS[icon];
  const name = document.createElement('h3'); name.textContent = label;
  const big = document.createElement('b'); big.textContent = value;
  if (unit) { const small = document.createElement('small'); small.textContent = unit; big.append(small); }
  tile.append(mark, name, big);
  return tile;
};`

const heading = (icon: string, text: string) =>
  `<h2>${ICONS[icon]}<span data-t="${text}"></span></h2>`

const pickView = view(PICK_URI, 'PlatJourney: next platinum', {
  images: true,
  messages: pickTexts,
  body: `<div id="card" hidden><div class="hero" id="hero"><img class="backdrop" id="art" alt="" hidden><span class="lead" data-t="eyebrow"></span><h1 id="name"></h1><div class="row"><button id="interest" class="primary" type="button"></button><button id="open" type="button">${OPEN_ICON}<span data-t="open"></span></button></div></div><div class="pad"><div class="stats" id="facts"></div><div class="stack">${heading('spark', 'why')}<div class="why"><img class="cover" id="cover" alt="" hidden><p id="why"></p></div></div><hr class="rule" id="firstRule" hidden><div class="stack" id="firstBox" hidden>${heading('flag', 'first')}<p id="first"></p></div><p class="error" id="error" role="alert" hidden></p></div></div>`,
  script: `${STAT}
let pick = null;
function show(data) {
  pick = data; language(data.locale);
  $('card').hidden = false; $('name').textContent = data.name;
  $('hero').classList.toggle('bare', !data.artUrl);
  $('art').hidden = !data.artUrl; if (data.artUrl) $('art').src = data.artUrl;
  $('cover').hidden = !data.coverUrl; if (data.coverUrl) $('cover').src = data.coverUrl;
  const number = (n) => n.toLocaleString(data.locale);
  const tiles = [data.difficulty ? stat('gauge', T.difficulty, number(data.difficulty), '/10') : null, data.hours ? stat('clock', T.hours, '~' + number(data.hours), T.hoursUnit) : null, data.progress != null ? stat('pie', T.progress, number(data.progress), '%') : null].filter(Boolean);
  $('facts').hidden = !tiles.length; $('facts').replaceChildren(...tiles);
  rich($('why'), data.reason);
  $('firstBox').hidden = !data.firstStep; $('firstRule').hidden = !data.firstStep; if (data.firstStep) rich($('first'), data.firstStep);
  interest(data.interested);
}
function interest(saved) {
  const button = $('interest');
  button.disabled = saved; button.className = saved ? 'done' : 'primary';
  button.textContent = saved ? T.added : T.add;
}
$('interest').onclick = async () => {
  $('error').hidden = true; $('interest').disabled = true;
  try { await callTool('add_interest', { game: pick.game }); interest(true); }
  catch (error) { $('interest').disabled = false; $('error').hidden = false; $('error').textContent = error.message || T.failed; }
};
$('open').onclick = () => openLink(pick.url);
window.onResult = ({ structuredContent: data }) => { if (data?.game) show(data); };`,
})

const trophyTexts = defineMessages({
  [Language.PtBR]: {
    tip: 'Como conseguir',
    hidden: 'Troféu oculto',
    asks: 'Objetivo',
    status: 'Status',
    earned: 'Conquistado',
    open: 'Pendente',
    tier: 'Tipo',
    rarity: 'Raridade',
    platinum: 'Platina',
    gold: 'Ouro',
    silver: 'Prata',
    bronze: 'Bronze',
    save: 'Salvar dica',
    saved: 'Dica salva',
    game: 'Ver no app',
    failed: 'Não foi possível salvar. Tente de novo.',
  },
  [Language.En]: {
    tip: 'How to get it',
    hidden: 'Hidden trophy',
    asks: 'Objective',
    status: 'Status',
    earned: 'Earned',
    open: 'Pending',
    tier: 'Tier',
    rarity: 'Rarity',
    platinum: 'Platinum',
    gold: 'Gold',
    silver: 'Silver',
    bronze: 'Bronze',
    save: 'Save tip',
    saved: 'Tip saved',
    game: 'See in the app',
    failed: 'Could not save. Try again.',
  },
})

const TROPHY_MARK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.700A2 2 0 0 0 18 8V7h-1Z"/></svg>'

const trophyView = view(TROPHY_URI, 'PlatJourney: trophy', {
  images: true,
  messages: trophyTexts,
  body: `<div id="card" hidden><div class="hero" id="hero"><img class="backdrop" id="art" alt="" hidden><span class="medal"><img id="icon" alt="" hidden><span id="mark">${TROPHY_MARK}</span></span><span class="lead" id="gameName"></span><h1 id="name"></h1><div class="row"><button id="save" class="primary" type="button" hidden></button><button id="open" type="button">${OPEN_ICON}<span data-t="game"></span></button></div></div><div class="pad"><div class="stats" id="facts"></div><div class="stack" id="tipBox" hidden>${heading('compass', 'tip')}<p id="tip"></p></div><hr class="rule" id="askRule" hidden><div class="stack" id="askBox" hidden>${heading('target', 'asks')}<p id="detail"></p></div><p class="error" id="error" role="alert" hidden></p></div></div>`,
  script: `${STAT}
let card = null;
function show(data) {
  card = data; language(data.locale);
  document.documentElement.dataset.tier = data.type;
  $('card').hidden = false; $('name').textContent = data.name; $('gameName').textContent = data.hidden ? data.gameName + ' · ' + T.hidden : data.gameName;
  $('art').hidden = !data.artUrl; if (data.artUrl) $('art').src = data.artUrl;
  $('icon').hidden = !data.iconUrl; $('mark').hidden = !!data.iconUrl; if (data.iconUrl) $('icon').src = data.iconUrl;
  const tiles = [stat('trophy', T.tier, T[data.type] ?? data.type), stat(data.earned ? 'check' : 'target', T.status, T[data.earned ? 'earned' : 'open']), data.rarity ? stat('gem', T.rarity, data.rarity.toLocaleString(data.locale), '%') : null].filter(Boolean);
  $('facts').replaceChildren(...tiles);
  $('tipBox').hidden = !data.tip; if (data.tip) rich($('tip'), data.tip);
  $('askBox').hidden = !data.detail; $('askRule').hidden = !data.detail || !data.tip; $('detail').textContent = data.detail ?? '';
  $('save').hidden = !data.tip; $('save').textContent = T.save;
}
$('save').onclick = async () => {
  $('error').hidden = true; $('save').disabled = true;
  try { await callTool('save_tip', { text: card.name + ': ' + card.tip, game: card.game }); $('save').textContent = T.saved; }
  catch (error) { $('save').disabled = false; $('error').hidden = false; $('error').textContent = error.message || T.failed; }
};
$('open').onclick = () => openLink(card.url);
window.onResult = ({ structuredContent: data }) => { if (data?.name) show(data); };`,
})

// Only the hosts the views' policy allows go into them; anything else would just not load.
const safeImage = (url?: string | null) =>
  url && IMAGE_HOSTS.some((host) => url.startsWith(`${host}/`)) ? url : null

const revealed = (user: User, game: string) => user.revealed_trophy_games?.includes(game) === true
const gameUrl = (id: string, base?: string) => `${base ?? ''}/title/game/${encodeURIComponent(id)}`

const showTaste: Tool = {
  name: 'show_taste_profile',
  description:
    "Open the player's taste profile in an interactive view where they review changes before saving. Use it when the player wants to adjust their taste or preferences. The player sees everything on the card, so after calling this do not retell it: say one short sentence at most.",
  inputSchema: { type: 'object', properties: {} },
  ui: { resourceUri: TASTE_URI },
  run: async (user) => ({ ...tasteOf(user), locale: localeOf(user) }),
}

const changeTaste: Tool = {
  name: 'change_taste_preferences',
  description:
    'Apply the changes the player reviewed in the taste view. Whatever the change does not name stays as it was.',
  inputSchema: {
    type: 'object',
    properties: {
      add: { type: 'object' },
      remove: { type: 'object' },
      filters: { type: 'object' },
    },
  },
  changes: true,
  ui: { visibility: ['app'] },
  run: async (user, args) => {
    const prefs = changedPrefs(readPrefs(user.taste_prefs) ?? emptyPrefs(), args)
    if (!prefs) throw new ToolError('These preferences are not valid.')
    await updateUser(user.id, { taste_prefs: prefs })
    return { ...tasteOf({ ...user, taste_prefs: prefs }), locale: localeOf(user) }
  },
}

const textOf = (args: Args, key: string, max: number) =>
  typeof args[key] === 'string' ? args[key].trim().slice(0, max) : ''

const showPick: Tool = {
  name: 'show_platinum_pick',
  description: `Show the game you recommend as a card, with its art, what the platinum takes and the player's progress. You choose the game: read get_current_game, get_next_platinums, get_interests, get_taste_profile and get_recommendations first, then call this with your choice. A next platinum is a game other than the one being played now: this refuses that one unless the player asked about it and you pass allowCurrent. Use it whenever you answer "what should I platinum now?". The player can add it to their interests from the card, which shows when it is already there. The player sees everything on the card, so after calling this do not retell it: say one short sentence at most.`,
  inputSchema: {
    type: 'object',
    properties: {
      game: gameArg,
      reason: { type: 'string', description: `Why this game, for this player, ${WHY}.` },
      firstStep: {
        type: 'string',
        description: 'Where to start: the first thing to do in the game for the platinum.',
      },
      allowCurrent: {
        type: 'boolean',
        description: 'True only when the player asked about the game they are playing now.',
      },
    },
    required: ['game', 'reason'],
  },
  ui: { resourceUri: PICK_URI },
  run: async (user, args, from) => {
    const game = await gameFrom(args)
    const reason = textOf(args, 'reason', 600)
    if (!reason) throw new ToolError('Say why this game.')
    if (args.allowCurrent !== true && (await currentOrCheck(user))?.game.id === game.id)
      throw new ToolError(
        `${game.name} is the game the player is on now. Recommend another one, unless they asked about it.`,
      )
    const [facts, titles, interests] = await Promise.all([
      guideFacts([game.id]),
      library(user.psn_account_id).catch(() => []),
      listInterests(user.id, new Date().getFullYear()),
    ])
    return {
      locale: localeOf(user),
      game: game.id,
      name: game.name,
      url: gameUrl(game.id, from?.base),
      artUrl: safeImage(game.art_url),
      coverUrl: safeImage(game.cover_url),
      difficulty: facts[0]?.difficulty || null,
      hours: facts[0]?.hours || null,
      progress: ownCopy(titles, game)?.progress ?? null,
      reason,
      firstStep: textOf(args, 'firstStep', 280) || null,
      interested: interests.some((i) => i.game.id === game.id),
    }
  },
}

const showTrophy: Tool = {
  name: 'show_trophy_card',
  description: `Show a trophy as a card, with its image, what PSN asks for, whether the player earned it and how rare it is. Use it whenever the player asks about one trophy, together with your own tip: read search_deep_guide or get_guide first and pass what you found in \`tip\`. Never pick a hidden trophy on your own or name one in your answer: show it only when the player asks about that trophy or a position in the list that lands on it. The player sees everything on the card, so after calling this do not retell it: say one short sentence at most.`,
  inputSchema: {
    type: 'object',
    properties: {
      game: gameArg,
      trophy: { type: 'string', description: "The trophy's name, in either language." },
      tip: { type: 'string', description: "How to get it, in the player's language." },
    },
    required: ['game', 'trophy'],
  },
  ui: { resourceUri: TROPHY_URI },
  run: async (user, args, from) => {
    const game = await gameFrom(args)
    const title = ownCopy(await library(user.psn_account_id), game)
    const list = title
      ? await trophiesFor(title, user)
      : ((await catalogTrophies(game.np_communication_ids))?.trophies ?? [])
    const name = textOf(args, 'trophy', 200).toLocaleLowerCase()
    const trophy = list.find(
      (t) => t.name.toLocaleLowerCase() === name || t.nameEn?.toLocaleLowerCase() === name,
    )
    if (!trophy) throw new ToolError(`No trophy named "${args.trophy}" in ${game.name}.`)
    return {
      locale: localeOf(user),
      game: game.id,
      gameName: game.name,
      artUrl: safeImage(game.art_url),
      url: gameUrl(game.id, from?.base),
      name: trophy.name,
      hidden: trophy.hidden && !trophy.earned && !revealed(user, game.id),
      detail: trophy.detail ?? null,
      type: trophy.type,
      earned: trophy.earned,
      rarity: trophy.earnedRate || null,
      iconUrl: safeImage(trophy.iconUrl),
      tip: textOf(args, 'tip', 1200) || null,
    }
  },
}

export const PLAYER_APP: McpApp = {
  name: 'player',
  resources: [tasteView, pickView, trophyView],
  tools: [showTaste, changeTaste, showPick, showTrophy],
}
