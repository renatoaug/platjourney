import type { Meta, StoryObj } from '@storybook/react-vite'
import type { GuidesPage } from '../pages/guides'
import { CommandPalette, PaletteDialog, type PaletteScreen } from './command-palette'

const meta: Meta = { title: 'Shell/CommandPalette' }
export default meta
type Story = StoryObj

const screens: PaletteScreen[] = [
  { to: '/', label: 'Visão geral', icon: 'dashboard' },
  { to: '/game', label: 'Jogo atual', icon: 'gamepad' },
  { to: '/goals', label: 'Interesses', icon: 'bookmark' },
  { to: '/discover', label: 'Descobrir', icon: 'compass' },
  { to: '/guides', label: 'Guias', icon: 'search' },
]

const page = (items: GuidesPage['items']): GuidesPage => ({
  page: 1,
  size: 24,
  total: items.length,
  items,
})
const found = page([
  {
    id: 'game:19561',
    name: 'Days Gone',
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co94bn.jpg',
    platforms: ['PS4', 'PS5'],
    release_year: 2019,
    guide: { difficulty: 3, hours: 40, hasMissables: false, hasOnline: false, unobtainable: null },
  },
  {
    id: 'game:2',
    name: 'Days of War',
    cover_url: null,
    platforms: ['PS4'],
    release_year: 2017,
    guide: null,
  },
])

/** The topbar entry; ⌘K, Ctrl+K or "/" opens it too. */
export const Entry: Story = { render: () => <CommandPalette screens={screens} /> }

/** Open, before typing: recent games and the screens. */
export const Open: Story = {
  render: () => <PaletteDialog screens={screens} onClose={() => {}} search={async () => found} />,
}

export const NoResults: Story = {
  render: () => (
    <PaletteDialog screens={screens} onClose={() => {}} search={async () => page([])} />
  ),
}
