import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShareTargets } from './share-targets'

const meta: Meta<typeof ShareTargets> = {
  title: 'Components/ShareTargets',
  component: ShareTargets,
  args: {
    image: '/og.png',
    text: 'Platinei A Plague Tale: Requiem! Platina #38 🏆',
    link: 'https://app.example.com/profiles/Kratos?ref=share',
    copied: true,
    onClose: () => {},
  },
}
export default meta
type Story = StoryObj<typeof ShareTargets>

/** On a computer, after the image went to the clipboard: the places to paste it. */
export const Copied: Story = {}

/** The clipboard refused the image: it was only saved, to attach. */
export const SavedOnly: Story = { args: { copied: false } }
