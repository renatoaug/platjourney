# Notifications

What PlatJourney tells a player on its own, without being asked: when it sends, where it goes, what each message says and the rules that keep it from repeating.

## Where a notice goes

Every notice is written to the web first, under the bell and in the history. Then it goes to each channel the player has, chosen on the settings page under Notificações:

| Channel | When | What it shows |
|---|---|---|
| Telegram | The chat is linked and "No Telegram" is on (`user.notify_telegram`, on by default) | The full notice, markdown turned into Telegram's HTML |
| Push | The device turned "Neste aparelho" on (`push_subscription`), and the instance has VAPID keys | A notification titled Nexo with the notice as plain text, cut at 900 characters; a tap opens the history |

A notice counts as read once the player opens the bell, on any device, or writes anything to Nexo on Telegram (a bot never learns when a message is read, so writing is the closest sign).

Push is Web Push, sent from `apps/server/src/push.ts` with no library: each message is encrypted for the device and signed with the instance's key. It works in desktop browsers, on Android and, on iPhone, only with PlatJourney added to the home screen (iOS 16.4 or later); in a Safari tab the profile explains how to add it. The native app has no push yet and says so. `apps/web/public/sw.js` shows the notification and opens the app on a tap. A channel that fails never stops the others, nor the sweep.

## When the watcher sends

The watcher visits every player one after the other, every `POLL_MINUTES` (15 by default), and compares the PSN title list with what it saw last time.

| Kind | When | What it says |
|---|---|---|
| `start` | A game played for the first time, still early (under 10% of its trophies) | A start tip for the game, with the guide's note on what comes first |
| `unlock` | New trophies earned since the last visit, on the game being played | The trophies as the title, then Nexo's comment, the session's focus, and the guide's note when a roadmap step was reached |
| `session` | The player opens a game (PSN presence), at most once every 6 hours | What is left for the platinum, the suggested next trophy, a tip, a missable still open and a trophy almost done. Opening the same game again within a day with nothing earned since gets one line: the game and the suggestion |
| `route` | A roadmap step reached without new trophies | The guide's note on what comes next |
| `server` | A game in the library has its online servers shutting down (daily check, only with `AI_RESEARCH` on) | The warning with the date |
| `deal` | Daily PlayStation Store check: a saved game goes on sale or its sale gets deeper, or enters the PS Plus catalog of the tier the player picked; games already owned are left out | One notice a day per player: a single game as a sentence (the price and until when, or that it entered the player's PS Plus); several as one list, a line per game |

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

Right under the 🏆 title, the notice opens with a line in PlatJourney's own voice, one of three per mark picked at random, written in `apps/server/src/marks.ts` (for example "Tá aberta a porteira! Agora é um troféu atrás do outro até a platina."). Nexo's words follow it, told not to celebrate again. The plain notice opens with the same kind of line, followed by a fixed line for the mark ("Metade do jogo base: 20 de 40 troféus.").

## Rules that keep it clean

- **Seen trophies are saved** after every sweep, even when Telegram fails, so the next sweep never sends or pays for the same notice twice.
- **One check per player at a time**: a sign-in and the sweep running together wait for each other, so the same unlock is not announced twice.
- **A first sync does not greet old games**: an account connected with progress already made gets no start notice for every game it has.
- **The trophy name shows once**, as the 🏆 title; a heading Nexo repeats is dropped, and markdown headings reach Telegram as bold.
- **The chat's game is not the game played**: `/game` and links into the chat change only the conversation; the notices follow the game PSN shows.
