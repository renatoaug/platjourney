import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Interest } from '../../lib/types'
import { DealsSpotlight } from './deals-spotlight'
import { sampleGoals } from './fixtures'

const meta: Meta = { title: 'Goals/DealsSpotlight' }
export default meta
type Story = StoryObj

const cover = (id: string) => `https://images.igdb.com/igdb/image/upload/t_cover_big/${id}.jpg`
const deal = (price: number, base: number, discount: number): Interest['deal'] => ({
  price,
  base,
  discount,
  endsAt: '2026-10-22T06:59:00Z',
  plus: false,
  currency: 'BRL',
  storeUrl: 'https://store.playstation.com/pt-br/concept/10003681',
})
const [a, b, c, ...rest] = sampleGoals.interests.filter((g) => !g.done)
const onSale: Interest[] = [
  {
    ...a,
    game: { ...a.game, name: 'The Plucky Squire', cover_url: cover('co6z44') },
    deal: { ...(deal(4485, 14950, 70) as NonNullable<Interest['deal']>), plusPrice: 2990 },
  },
  {
    ...b,
    game: { ...b.game, name: 'Downwell', cover_url: cover('co284e') },
    deal: deal(1425, 2850, 50),
  },
  {
    ...c,
    game: { ...c.game, name: 'Echoes of the End', cover_url: cover('co9xoc') },
    deal: {
      ...(deal(0, 22990, 0) as NonNullable<Interest['deal']>),
      plus: true,
      plusTier: 'extra',
      mine: true,
    },
  },
  ...rest,
]

export const TwoOnSale: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 820 }}>
      <DealsSpotlight interests={onSale} />
    </div>
  ),
}

/** Nothing on sale: nothing shows. */
export const NothingOnSale: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 820 }}>
      <DealsSpotlight interests={sampleGoals.interests} />
    </div>
  ),
}
