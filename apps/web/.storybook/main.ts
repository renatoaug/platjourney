import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  staticDirs: ['../public'],
  // Stories show the app as it ships: no plugins, whatever PLUGINS_WEB the .env sets.
  viteFinal: (vite) => ({
    ...vite,
    resolve: {
      ...vite.resolve,
      alias: {
        ...(vite.resolve?.alias as Record<string, string>),
        'platjourney-plugins': fileURLToPath(new URL('../src/plugins/none.ts', import.meta.url)),
      },
    },
  }),
}

export default config
