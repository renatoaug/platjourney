// bun scripts/css-spacing.ts [--write]: every CSS rule is separated from the next by an empty line.
// Biome keeps blank lines but does not add them; this adds them (--write) or fails when one is
// missing (the default, run by `bun run lint`).
import { Glob } from 'bun'

const write = process.argv.includes('--write')
const files = (await Array.fromAsync(new Glob('**/*.css').scan({ dot: true }))).filter(
  (f) => !/(^|\/)(node_modules|dist|\.ui-check|storybook-static|coverage)\//.test(f),
)
let missing = 0
for (const file of files) {
  const lines = (await Bun.file(file).text()).split('\n')
  const out: string[] = []
  lines.forEach((line, i) => {
    out.push(line)
    const next = lines[i + 1]
    // A closing brace followed directly by another rule or a comment, not by its parent's brace.
    if (line.trim() === '}' && next !== undefined && next.trim() !== '' && next.trim() !== '}') {
      out.push('')
      missing++
      if (!write) console.error(`${file}:${i + 2}: empty line missing before the next rule`)
    }
  })
  if (write) await Bun.write(file, out.join('\n'))
}
if (write) console.log(`${missing} empty lines added in ${files.length} files`)
else if (missing) {
  console.error(
    `${missing} rules need an empty line before them: run bun scripts/css-spacing.ts --write`,
  )
  process.exit(1)
}
