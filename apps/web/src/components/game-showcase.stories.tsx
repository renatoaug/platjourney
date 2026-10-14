import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Game } from '../lib/types'
import {
  GalleryLightbox,
  GameAbout,
  GameGallery,
  GameShowcase,
  GameShowcaseSkeleton,
} from './game-showcase'

const meta: Meta = { title: 'Game/Showcase' }
export default meta
type Story = StoryObj

const daysGone: Game = {
  id: 'game:19561',
  name: 'Days Gone',
  cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co94bn.jpg',
  genres: ['Shooter', 'Adventure'],
  modes: ['Single player'],
  rating: 76,
  platforms: ['PS4', 'PS5', 'PC'],
  developers: ['Bend Studio'],
  website: 'https://bendstudio.com/game/days-gone',
  released_at: '2019-04-26T00:00:00Z',
  screenshot_ids: [
    'r5mn9rt7aqvf5nrn8dqq',
    'msmuubbmqkosdwinh54f',
    'kjrtfpaex7mwrjazwv1m',
    'kd9mk48xev3eisdev4sz',
    'eqd6kktmq9dva0cd5clc',
    'zpddyocposjq6qm3ntek',
    'ukzjmwiud0hdn8jk5fkb',
    'netptvmanlolewudyw45',
  ],
}

export const Loaded: Story = { render: () => <GameShowcase game={daysGone} name="Days Gone" /> }

/** No screenshot in the catalog: the facts take the whole width. */
export const NoGallery: Story = {
  render: () => <GameShowcase game={{ ...daysGone, screenshot_ids: [] }} name="Days Gone" />,
}

/** One image: no arrows, dots or thumbnails. */
export const OneImage: Story = {
  render: () => <GameGallery ids={daysGone.screenshot_ids?.slice(0, 1) ?? []} name="Days Gone" />,
}

/** Few facts: only what the catalog knows shows, two studios read as plural. */
export const FewFacts: Story = {
  render: () => (
    <div style={{ maxWidth: 380 }}>
      <GameAbout
        game={{ id: 'game:1', name: 'Kena', developers: ['Ember Lab', 'Studio Two'] }}
        name="Kena"
      />
    </div>
  ),
}

export const OnSale: Story = {
  render: () => (
    <GameShowcase
      game={daysGone}
      name="Days Gone"
      store={{
        url: 'https://store.playstation.com/pt-br/concept/229018',
        deal: {
          price: 4990,
          base: 19990,
          discount: 75,
          endsAt: '2026-10-22T12:00:00Z',
          plus: false,
          currency: 'BRL',
          storeUrl: 'https://store.playstation.com/pt-br/concept/229018',
        },
      }}
    />
  ),
}

export const InYourPlus: Story = {
  render: () => (
    <GameShowcase
      game={daysGone}
      name="Days Gone"
      store={{
        url: 'https://store.playstation.com/pt-br/concept/229018',
        deal: {
          price: 19990,
          base: 19990,
          discount: 0,
          endsAt: null,
          plus: true,
          plusTier: 'extra',
          mine: true,
          currency: 'BRL',
          storeUrl: 'https://store.playstation.com/pt-br/concept/229018',
        },
      }}
    />
  ),
}

export const Loading: Story = { render: () => <GameShowcaseSkeleton /> }

/** Full screen, opened from the expand button or a tap on the image. */
export const FullScreen: Story = {
  render: () => (
    <GalleryLightbox
      ids={daysGone.screenshot_ids ?? []}
      at={2}
      name="Days Gone"
      onGo={() => {}}
      onClose={() => {}}
    />
  ),
}
