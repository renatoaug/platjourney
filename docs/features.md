# Features

PlatJourney keeps you company on the way to every PlayStation platinum. It watches the PSN profile of everyone who signs in, notices when you start a game or unlock a trophy, and Nexo, your platinum partner, talks to you about it on Telegram and in a web app, with guides researched from the web, a catalog of every game, and recommendations built from what you actually play.

- **Watches your PSN profile** every few minutes: new game started, trophy unlocked, game opened (from PSN presence, at most once every 6 hours, for players who show their online status).
- **Nexo helps you** on Telegram and in the web chat: what to do next, missables ahead, tricks for the trophy you are stuck on. Answers use your real trophy list (in pt-BR, with English names for guide matching) and a per-game guide researched from community trophy guides. On the web, each game has its own conversation: switching the game switches the conversation, and a list beside the chat (a sheet on a phone, collapsible to covers) reopens any of them. The game can also be one the player does not own yet: Nexo then talks about its platinum from the trophy list and the guide, to help decide before buying.
- **Guides** with roadmap, missables, glossary for beginners and the key trophies: online requirements, easiest, hardest, most tedious, tricks, glitched ones, collectibles, points of no return, PS4/PS5 auto-pop.
- **Next platinum** ranking of your library by remaining effort, counting only the base game (DLC is shown separately).
- **Recommendations** from a taste vector of your platinums over a catalog of thousands of rated PlayStation games (IGDB), retrieved by vector search and explained by the model, with "similar to X and Y".
- **Deep guide (RAG)**: the full guide pages of a game are split into passages, embedded and retrieved per question, so Nexo answers "where is the fuse at Spruce Lake" from the source and cites it. Trophy names in the question are matched in the guide's language. The index refreshes itself every 30 days or when the game gets new trophies.
- **Session planner**: tell it how long you have today and it builds the route — which trophies fit, in what order, with the trick for each — and ticks them off as PSN reports them earned.
- **Hours played** per game from PSN, next to the guide's estimate, on the dashboard, rankings, interests and profile.
- **Accounts tied to the PSN ID**: the first time you type your PSN ID you choose a password and you are in. Proof of ownership is only asked when it matters: whoever pastes a short code into the profile's "About me" can take over the account registered for that PSN ID (lost password, or someone else registered it first), optionally starting it clean. Each person has their own library, interests, chat and Telegram link; guides, the catalog and the deep guide index are shared, so a game researched for one player is ready for the next.
- **Plugins**: an instance can add routes, rules around model work and pieces of the interface without changing the code ([plugins](plugins.md)).
- **Your account**: change the password or delete the account (everything personal goes; cost records stay without the link to it). A profile whose trophies are private is told how to make them public instead of failing.
- **Cost records**: every model call is recorded with its tokens, web searches and price (`llm_call`), so whoever runs an instance can see what it really costs.
- **A read-only demo** for anyone without a PSN account: a fictional player with real games and guides, opened from the sign-in screen.
- **Interests** (games you want to platinum, in your own order), yearly platinum goal, profile with every platinum and its real unlock date and rarity, and alerts when a game's online servers are shutting down.

## First visit

A new account opens on a full-screen welcome with the player's level, platinums and trophies, which waits for the first PSN sync. A tour then opens each screen, lights its tab and the parts it talks about, and explains how to use it: the overview, the current game detected from PSN, Nexo's tips while playing, trophies and the guide, the session route, Nexo, Guides, Discover, interests, and the profile settings. Stops without data on the account are left out. It can be watched again from the profile.

## Demo

People without a PSN account, or who do not want to connect one, can open the app as PlatJourneyDemo from the sign-in screen ("See a demo"). The demo player is loaded by `bun run seed` and is read-only for everyone: every screen shows its stored data, nothing it does calls PSN or the AI service, and anything that would write (goals, account settings, plans, recommendations, chat, Telegram) answers with a notice instead. The chat shows example conversations in place of the message box. A server without the demo player loaded answers the demo sign-in with "not available".

## Telegram commands

`/status` · `/guide` · `/plan <minutes>` · `/next` · `/game <name>` · `/goals` (`set`, `add`, `remove`, `move`, `order`) · `/recommend` · `/servers` · `/language` (`pt`, `en`) · `/help`. Anything else is a question for Nexo. The bot answers in the language the player picked on the profile page (or with `/language`).
