# Notifications

What PlatJourney tells a player on its own, without being asked: when it sends, what each message says and the rules that keep it from repeating. Every notice goes to Telegram when the player linked it, and always to the web, under the bell and in the history.

## When the watcher sends

The watcher visits every player one after the other, every `POLL_MINUTES` (15 by default), and compares the PSN title list with what it saw last time.

| Kind | When | What it says |
|---|---|---|
| `start` | A game played for the first time, still early (under 10% of its trophies) | A start tip for the game, with the guide's note on what comes first |
| `unlock` | New trophies earned since the last visit, on the game being played | The trophies as the title, then Nexo's comment, the session's focus, and the guide's note when a roadmap step was reached |
| `session` | The player opens a game (PSN presence), at most once every 6 hours | A short plain line naming the game and where the player is in it |
| `route` | A roadmap step reached without new trophies | The guide's note on what comes next |
| `server` | A game in the library has its online servers shutting down (daily check, only with `AI_RESEARCH` on) | The warning with the date |

One sweep sends at most one message per player: what happened, then what comes next, in the same text.

## Nexo or plain

| Who writes | When |
|---|---|
| Nexo | `AI_NOTICES` is on for the instance and the player kept "Avisos escritos pelo Nexo" on in the profile |
| A plain template | Either one is off, a plugin refused the model work, or the model failed (quota, outage) |

The plain template needs no model, so a player always hears about a trophy, whatever happens to the AI service.

## Progress marks

Some unlocks reach a point of the journey, and that notice marks it. The count is the base game without the platinum (DLC trophies do not count), and a mark fires once, on the unlock that crosses it.

| Mark | Reached when | Nexo is asked to |
|---|---|---|
| First trophy | The first trophy of the game | Welcome the player to the journey and say in one sentence how the platinum usually goes |
| Halfway | The base game passes half (for example 20 of 40) | Mark the halfway point and say what weighs most in what is left |
| Final stretch | At most 3 trophies left, or a tenth of the list on long games | List what is left by name, one per line, each with its shortest tip |
| Platinum | The platinum | Celebrate in two or three lines (rarity when rare, hours played), say goodbye to the game, point at no next trophy |

When one unlock reaches two marks (a short list), the later one wins: platinum, then final stretch, then halfway, then first trophy.

After Nexo's words, the notice closes with a line in PlatJourney's own voice, one of three per mark picked at random, written in `apps/server/src/marks.ts` (for example "Tá aberta a porteira! Agora é um troféu atrás do outro até a platina."). The plain notice gets a fixed line for the mark ("Metade do jogo base: 20 de 40 troféus.") followed by the same kind of line.

## Rules that keep it clean

- **Seen trophies are saved** after every sweep, even when Telegram fails, so the next sweep never sends or pays for the same notice twice.
- **One check per player at a time**: a sign-in and the sweep running together wait for each other, so the same unlock is not announced twice.
- **A first sync does not greet old games**: an account connected with progress already made gets no start notice for every game it has.
- **The trophy name shows once**, as the 🏆 title; a heading Nexo repeats is dropped, and markdown headings reach Telegram as bold.
- **The chat's game is not the game played**: `/game` and links into the chat change only the conversation; the notices follow the game PSN shows.
