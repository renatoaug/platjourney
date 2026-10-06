// First, as in the app: index.css declares the cascade layers before any component's CSS.
import '../src/styles/index.css'
import type { Preview } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { MockAppState } from '../src/app/app-state'
import { I18nProvider, type Locale } from '../src/i18n/i18n'
import './preview.css'

const preview: Preview = {
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true },
    controls: { expanded: true },
  },
  // The toolbar switches every story between the two languages; a story can pin one with `globals`.
  globalTypes: {
    locale: {
      description: 'Language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'pt-BR', title: 'Português' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: 'pt-BR' },
  // Components read the signed-in player and the app state; stories get sample data and a router.
  decorators: [
    (Story, context) => (
      <I18nProvider locale={(context.globals.locale as Locale) ?? 'pt-BR'}>
        <MemoryRouter>
          <MockAppState>
            <Story />
          </MockAppState>
        </MemoryRouter>
      </I18nProvider>
    ),
  ],
}

export default preview
