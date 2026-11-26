/**
 * Tells players that games they opened while those had no guide now have one. Runs where the app
 * runs, with its database:
 *
 *   bun scripts/guide-notice.ts send <PSN online id> <file> <game id> [game id ...]
 *
 * The file holds the reviewed text. It goes out as a `guide` notice on the bell, push and Telegram,
 * which cannot be taken back: send only text a person has approved.
 */
import { readFileSync } from 'node:fs'
import { sendGuideNotice } from '../apps/server/src/followups.ts'
import { userByOnlineId } from '../apps/server/src/repository/user.ts'

const [command, onlineId, file, ...ids] = process.argv.slice(2)
if (command !== 'send' || !onlineId || !file || !ids.length) {
  console.error(
    'usage: bun scripts/guide-notice.ts send <PSN online id> <file> <game id> [game id ...]',
  )
  process.exit(1)
}
const user = await userByOnlineId(onlineId)
if (!user) throw new Error(`no player ${onlineId}`)
const text = readFileSync(file, 'utf8').trim()
if (!text) throw new Error('the file is empty')
const games = ids.map((id) => (id.startsWith('game:') ? id : `game:${id}`))
await sendGuideNotice(user.id, games, text)
console.log(JSON.stringify({ player: onlineId, games, sent: true, text }, null, 2))
process.exit(0)
