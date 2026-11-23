# Features

PlatJourney keeps you company on the way to every PlayStation platinum. It watches the PSN profile of everyone who signs in, notices when you start a game or unlock a trophy, and Nexo, your platinum partner, talks to you about it on Telegram and in a web app, with guides researched from the web, a catalog of every game, and recommendations built from what you actually play.

- **Watches your PSN profile** every few minutes: new game started, trophy unlocked, game opened (from PSN presence, at most once every 2 days, for players who show their online status and get notices outside the app: Telegram or push).
- **Nexo helps you** on Telegram and in the web chat: what to do next, missables ahead, tricks for the trophy you are stuck on. Answers use your real trophy list (in pt-BR, with English names for guide matching) and a per-game guide researched from community trophy guides. On the web, each game has its own conversation: switching the game switches the conversation, and a list beside the chat (a sheet on a phone, collapsible to covers) reopens any of them. The game can also be one the player does not own yet: Nexo then talks about its platinum from the trophy list and the guide, to help decide before buying.
- **Guides** with roadmap, missables, glossary for beginners and the key trophies: online requirements, easiest, hardest, most tedious, tricks, glitched ones, collectibles, points of no return, PS4/PS5 auto-pop.
- **Next platinum** ranking of your library by remaining effort, counting only the base game (DLC is shown separately).
- **"What to play now?"** opens Discover: the player says what they feel like right now (something easy, short, to relax, a challenge, or in their own words), where to look (their interests or any game) and whether to keep to games they have (their library and their PS Plus catalog; PSN does not list a game bought and never opened), and Nexo answers with one game, why it fits and where to start. This is the mood of the moment, not the taste profile. The latest pick stays in view and the earlier ones open in a dialog; asking again brings another game. When nothing among the interests matches the mood, Nexo says so and offers to look beyond the list. Interests link to it with the interests chosen. Starting a game Nexo recommended (here or in a batch) within 30 days opens the start notice glad the player followed the tip.
- **Recommendations** on Discover, all as the same paged game cards (six a page): first Nexo's picks, asked for with a button (a taste vector of your platinums over a catalog of thousands of rated PlayStation games (IGDB), retrieved by vector search and explained by the model, with an editable taste profile); then games like yours from the catalog graph, each naming which of your games led to it; then the library ranking, short easy platinums and games in a series you already have. Your saved rules apply to all of them.
- **Similar games** on each game page, in small cards six a page: its expansions, base game and series first with a tag. The tab shows the game's name.
- **Deep guide (RAG)**: the full guide pages of a game are split into passages, embedded and retrieved per question, so Nexo answers "where is the fuse at Spruce Lake" from the source and cites it. Trophy names in the question are matched in the guide's language. The index refreshes itself every 30 days or when the game gets new trophies.
- **Session planner**: tell it how long you have today and it builds the route — which trophies fit, in what order, with the trick for each — and ticks them off as PSN reports them earned.
- **Hours played** per game from PSN, next to the guide's estimate, on the dashboard, rankings, interests and profile.
- **Accounts tied to the PSN ID**: the first time you type your PSN ID you choose a password and you are in. Proof of ownership is only asked when it matters: whoever pastes a short code into the profile's "About me" can take over the account registered for that PSN ID (lost password, or someone else registered it first), optionally starting it clean. Each person has their own library, interests, chat and Telegram link; guides, the catalog and the deep guide index are shared, so a game researched for one player is ready for the next.
- **In your assistant (MCP)**: Claude, ChatGPT and other assistants connect to PlatJourney: they read the player's profile, library, trophies, current game, interests, platinums, the next-platinum ranking, recommendations and the guides, change the interests and the yearly goal when asked, and offer shortcuts (what to play, a session plan, a trophy tip) that carry how Nexo thinks. Nothing calls the model on PlatJourney's side. Settings lists the connected assistants with how to connect Claude and ChatGPT ([MCP](11-mcp.md)).
- **Plugins**: an instance can add routes, rules around model work and pieces of the interface without changing the code ([plugins](06-plugins.md)).
- **Your account**: change the password or delete the account (everything personal goes; cost records stay without the link to it). A profile whose trophies are private is told how to make them public instead of failing.
- **Cost records**: every model call is recorded with its tokens, web searches and price (`llm_call`), so whoever runs an instance can see what it really costs.
- **A read-only demo** for anyone without a PSN account: a fictional player with real games and guides, opened from the sign-in screen.
- **The app without an account**: anyone browses the guides, the games' pages, the community and the players' profiles, and sees what Nexo answers; the sign-in screen is at `/entrar` ([below](#without-an-account)).
- **Interests** (games you want to platinum, in your own order), yearly platinum goal with the year's pace (average hours per platinum, the quickest and the longest), profile with every platinum and its real unlock date and rarity, and alerts when a game's online servers are shutting down.
- **Deals**: the PlayStation Store price of every game someone saved is read every day at 10:00 (Brazil time), when the notices go out. Beside the interests, the games the player's own PS Plus tier includes come first, then the sales with the old price, the members' price and the link to the store; each interest shows its tag. A new or deeper sale, or a saved game entering the player's PS Plus catalog, is a notice. PSN does not tell the PS Plus tier, so the player picks it in the account preferences.
- **Release calendar** on the home: PS4 and PS5 games coming out in the next weeks and the ones that just came out, the most awaited first, with the guide's difficulty and hours when there is one and a button to save the game. Refreshed once a day.
- **Guides page**: every game with a guide, filtered by difficulty, hours to the platinum, rules (no missables, one playthrough, no online) and genre, each with its count, sorted and shown as a grid or a list.
- **Search anywhere**: ⌘K (Ctrl+K) opens a search over the catalog from any screen.

## First visit

A new account opens on a full-screen welcome with the player's level, platinums and trophies, which waits for the first PSN sync. A tour then opens each screen, lights its tab and the parts it talks about, and explains how to use it: the overview, the current game detected from PSN, Nexo's tips while playing, trophies and the guide, the session route, Nexo, Guides, Discover, interests, and the profile settings. Stops without data on the account are left out. It can be watched again from the profile.

## Demo

People without a PSN account, or who do not want to connect one, can open the app as PlatJourneyDemo from the sign-in screen ("See a demo"). The demo player is loaded by `bun run seed` and is read-only for everyone: every screen shows its stored data, nothing it does calls PSN or the AI service, and anything that would write (goals, account settings, plans, recommendations, chat, Telegram) answers with a notice instead. The chat shows example conversations in place of the message box. A server without the demo player loaded answers the demo sign-in with "not available".

## Without an account

The app opens for anyone. Without a session the same layout shows (the menu, the search, every screen), reading only what is public, and the sign-in screen moves to its own address, `/entrar`. Signing out keeps the page on screen and takes away only what belongs to the account.

| Screen | Without an account |
|---|---|
| Home | What PlatJourney does, the way to connect the PSN, the guide of the day, the releases and the community's latest. |
| Guides, a game's page | Whole: the catalog with its filters, each game's trophies, the guide already written, similar games and the store. A visitor never starts a guide's research or a catalog lookup; a game missing from the catalog asks for an account to request it. |
| Community | The feed of everyone, the rankings and the trending games, and each player's profile (platinums, collection, level, hours, most played and the games being played now). Only players who chose to show up in the community appear, as for anyone signed in. |
| Games | The releases and the community's games. The library, the interests and the goals wait for the sign-in. |
| Nexo | Example conversations and the way in, like the demo; the message box is closed. |
| Journey, history, profile, settings, a plugin's page | An invitation to sign in that comes back to the same page afterwards (`/entrar?next=`). |

The top bar carries "Sign in" and "Sign up" in place of the notices, the sync and the account menu (a phone keeps only "Sign in"), and the menu's end shows the way in where the player's card would be. Every action that writes stays closed, as in the demo. The server answers these reads without a session (`apps/server/src/routes/visitor.ts`): at most 120 a minute per address, and a profile is read from PSN at most once every 10 minutes for all visitors. A guide's page, a profile and the guides are served with their own title, description and picture in the page's head, so link previews and search engines see them before the app runs.

## Telegram commands

`/status` · `/guide` · `/plan <minutes>` · `/next` · `/game <name>` · `/goals` (`set`, `add`, `remove`, `move`, `order`) · `/recommend` · `/pick [mood]` (Nexo picks which of your interests to platinum now, for what you feel like: `/pick algo curto`) · `/servers` · `/language` (`pt`, `en`) · `/help`. Anything else is a question for Nexo. The bot answers in the language the player picked on the profile page (or with `/language`).
