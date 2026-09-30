import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite'

// The Bun server serves dist/ and /api. In development it forwards pages to Vite, and Vite forwards /api back.
// Relative paths in PLUGINS_WEB start at the repository's root, like PLUGINS on the server.
const ROOT = new URL('../../', import.meta.url)

export default defineConfig(({ mode }) => {
  // PLUGINS_WEB can come from the shell or the repository's .env, like the server's settings.
  const pluginsWeb = process.env.PLUGINS_WEB || loadEnv(mode, fileURLToPath(ROOT), '').PLUGINS_WEB
  const plugin = fileURLToPath(new URL(pluginsWeb || 'apps/web/src/plugins/none.ts', ROOT))
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      // A plugin's folder has no node_modules of its own: React comes from the app's.
      dedupe: ['react', 'react-dom', 'react-router'],
      alias: {
        // A deploy with plugins sets PLUGINS_WEB to its module; a plain build gets none.
        // A plugin's components import the app's pieces through this, e.g. '@platjourney/web/ui/states'.
        '@platjourney/web': fileURLToPath(new URL('./src', import.meta.url)),
        'platjourney-plugins': plugin,
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      // Pages are also served through the Bun server on :3000; hot reload still talks to Vite here.
      hmr: { clientPort: 5173 },
      // The plugin's folder may sit outside the repository (another checkout).
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd()), new URL('.', `file://${plugin}`).pathname],
      },
      proxy: { '/api': `http://localhost:${process.env.PORT ?? 3000}` },
    },
    build: { outDir: 'dist', emptyOutDir: true },
  }
})
