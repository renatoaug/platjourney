import { readFileSync } from 'node:fs'
import { parseJourneyModel } from '../../../shared/journey/validation.ts'

// No HTTP write endpoint. Operators validate, stage and activate explicitly with database access.
const [command, ...args] = process.argv.slice(2)
const usage =
  'check <file> | import <game> <file> <namespace/database> | activate <game> <edition> <version|none> <expected-version|none> <namespace/database> | show <game> <edition>'
if (command === 'check') {
  const model = parseJourneyModel(JSON.parse(readFileSync(args[0], 'utf8')))
  console.log(
    JSON.stringify({
      edition: model.edition,
      version: model.version,
      objectives: model.objectives.length,
    }),
  )
} else {
  if (!['import', 'activate', 'show'].includes(command)) throw new Error(usage)
  const { config } = await import('../src/config.ts')
  const { closeDb, q } = await import('../src/db.ts')
  const { getJourneyModel, importJourneyModel, publishJourneyModel, journeyChecksum } =
    await import('../src/repository/journey-model.ts')
  // Run on the database host (or an explicitly secured local connection). Never guess a remote target.
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(config.surreal.url).hostname))
    throw new Error('Journey operator commands require a loopback database connection')
  try {
    if (command !== 'show') {
      if (args.at(-1) !== `${config.surreal.namespace}/${config.surreal.database}`)
        throw new Error('Confirm the exact namespace/database as the final argument')
      // Only define the new tables. Do not replay unrelated migrations as a side effect of import.
      for (const file of ['029_journey_model.surql', '030_journey_publication.surql'])
        await q(readFileSync(new URL(`../../../db/migrations/${file}`, import.meta.url), 'utf8'))
    }
    if (command === 'import') {
      const model = await importJourneyModel(args[0], JSON.parse(readFileSync(args[1], 'utf8')))
      console.log(
        JSON.stringify({
          staged: true,
          edition: model.edition,
          version: model.version,
          checksum: journeyChecksum(model),
        }),
      )
    } else if (command === 'activate') {
      const version = (value: string) => {
        if (value === 'none') return null
        const n = Number(value)
        if (!Number.isInteger(n) || n < 1)
          throw new Error('Version must be a positive integer or none')
        return n
      }
      await publishJourneyModel(args[0], args[1], version(args[2]), version(args[3]))
      console.log(JSON.stringify({ activated: true, edition: args[1], version: version(args[2]) }))
    } else {
      const model = await getJourneyModel(args[0], args[1])
      console.log(
        JSON.stringify(
          model
            ? {
                edition: model.edition,
                version: model.version,
                objectives: model.objectives.length,
                checksum: journeyChecksum(model),
              }
            : { active: false },
        ),
      )
    }
  } finally {
    await closeDb()
  }
}
