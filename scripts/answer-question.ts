/**
 * The questions Nexo could not answer and promised to look into, for whoever fills the guide.
 * Runs where the app runs, with its database and AI service:
 *
 *   bun scripts/answer-question.ts list                 the open questions, oldest first, as JSON
 *   bun scripts/answer-question.ts preview <n>          Nexo's answer to the nth, from the guide
 *   bun scripts/answer-question.ts send <n> <file>      sends the text in file (the reviewed preview)
 *
 * `n` is the position in `list`. Nothing is sent while the guide has no answer.
 */
import { readFileSync } from 'node:fs'
import { followUpAnswer, sendFollowUp } from '../apps/server/src/followups.ts'
import { waitingQuestions } from '../apps/server/src/repository/guide-request.ts'

const [command, n, file] = process.argv.slice(2)
const questions = await waitingQuestions()
const pick = () => {
  const w = questions[Number(n)]
  if (!w) throw new Error(`no question ${n}; there are ${questions.length}`)
  return w
}

if (command === 'list') {
  console.log(
    JSON.stringify(
      questions.map((w, i) => ({ n: i, ...w })),
      null,
      2,
    ),
  )
} else if (command === 'preview' || command === 'send') {
  const w = pick()
  if (command === 'send' && !file) throw new Error('send takes the file with the reviewed answer')
  const text = file ? readFileSync(file, 'utf8').trim() : await followUpAnswer(w)
  if (!text) {
    console.log('The guide still has no answer: nothing to send.')
    process.exit(2)
  }
  if (command === 'send') await sendFollowUp(w, text)
  console.log(JSON.stringify({ ...w, sent: command === 'send', text }, null, 2))
} else {
  console.error('usage: bun scripts/answer-question.ts list | preview <n> | send <n> <file>')
  process.exit(1)
}
process.exit(0)
