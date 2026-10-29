import type { Meta, StoryObj } from '@storybook/react-vite'
import { GameNav } from './game-nav'

const meta: Meta = { title: 'Components/GameNav' }
export default meta
type Story = StoryObj

const block = (id: string, label: string) => (
  <div id={id} className="card" style={{ minHeight: 360, marginBottom: 16 }}>
    {label}
  </div>
)

// Scroll the canvas: the bar sticks, lights the section in view and, past the hero, shows the game.
export const Sections: Story = {
  render: () => (
    <div>
      <div id="story-hero" className="card" style={{ minHeight: 200, marginBottom: 16 }}>
        Hero
      </div>
      <GameNav
        sections={[
          ['plan', 'story-plan'],
          ['guide', 'story-guide'],
          ['trophies', 'story-about'],
        ]}
        hero="story-hero"
        name="Days Gone"
        progress={38}
      />
      {block('story-plan', 'Sessão')}
      {block('story-guide', 'Guia')}
      {block('story-about', 'Troféus')}
    </div>
  ),
}
