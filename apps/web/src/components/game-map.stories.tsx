import type { Meta, StoryObj } from '@storybook/react-vite'
import { type GameMapData, GameMapSkeleton, GameMapView } from './game-map'

// A tiny world with no tiles behind it: the stories show the filters, the pins and the card.
const map: GameMapData = {
  background: 'water',
  minZoom: 2,
  maxZoom: 8,
  tileMaxZoom: 2,
  center: [-30, 10],
  zoom: 3,
  bounds: [-60, -20, 0, 40],
  attribution: 'Mapa: exemplo',
  tiles: 'data:,',
  categories: [
    {
      id: 'cards',
      name: { 'pt-BR': 'Cartas colecionáveis', en: 'Collectible cards' },
      icon: 'cards',
    },
    { id: 'banks', name: { 'pt-BR': 'Bancos', en: 'Bank Jobs' }, icon: 'shield' },
  ],
  points: [
    {
      id: 'cards-1',
      category: 'cards',
      lng: -40,
      lat: 20,
      title: 'Sammy Woodsworth',
      detail: { 'pt-BR': 'No armário da garagem.', en: 'On the garage cabinet.' },
    },
    { id: 'cards-2', category: 'cards', lng: -25, lat: 5, approx: true },
    {
      id: 'banks-1',
      category: 'banks',
      lng: -15,
      lat: 25,
      title: 'Fleeca – Key Lento',
      detail: { 'pt-BR': 'Banco · $5k-$20k', en: 'Bank · $5k-$20k' },
    },
  ],
}

const meta: Meta<typeof GameMapView> = {
  title: 'Components/GameMap',
  component: GameMapView,
  args: { game: 'game:story', map },
}
export default meta
type Story = StoryObj<typeof meta>
export const Spots: Story = {}
export const WithoutCredit: Story = { args: { map: { ...map, attribution: '' } } }
export const NothingToShow: Story = { args: { map: { ...map, points: [] } } }
export const Loading: StoryObj = { render: () => <GameMapSkeleton /> }
