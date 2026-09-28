// bun run db:reset [path] — the seed (the demo without a path), then the catalog expansion and its
// embeddings. Embedding calls the embedding provider.
const run = (cmd: string[], cwd = import.meta.dir) => {
  const { exitCode } = Bun.spawnSync(cmd, { cwd, stdout: 'inherit', stderr: 'inherit' })
  if (exitCode !== 0) process.exit(exitCode ?? 1)
}

run(['bun', 'seed.ts', ...process.argv.slice(2)])
run(['bun', 'expand-catalog.ts'])
run(
  ['uv', 'run', 'python', '-m', 'platjourney_ai.jobs.embed_catalog'],
  `${import.meta.dir}/../../../services/ai`,
)
