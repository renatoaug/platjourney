import type { Plugin } from '../../src/plugins.ts'

// A plugin as an instance would load it from PLUGINS.
const plugin: Plugin = {
  name: 'fixture',
  register(ctx) {
    ctx.route('fixture/ping', async ({ res }) => {
      res.writeHead(200).end('pong')
    })
  },
}
export default plugin
