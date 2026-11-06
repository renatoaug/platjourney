import type { Meta, StoryObj } from '@storybook/react-vite'
import { ExplainAsk, FirstAsks, NoticeAsk, TrophyAsks } from './nexo-asks'

const meta: Meta = { title: 'Components/NexoAsks' }
export default meta
type Story = StoryObj

// A trophy the guide says can be missed: all three questions.
export const MissableTrophy: Story = {
  render: () => <TrophyAsks np="NPWR00001_00" name="Ecos de Vidro" trophy="Sem Rastro" missable />,
}

// Any other trophy: no "can I miss it".
export const Trophy: Story = {
  render: () => <TrophyAsks np="NPWR00001_00" name="Ecos de Vidro" trophy="Primeiro Passo" />,
}

// A player who never wrote to Nexo, on the home.
export const FirstQuestions: Story = {
  render: () => <FirstAsks np="NPWR00001_00" name="Ecos de Vidro" />,
}

// Under a notice in the history.
export const Notice: Story = {
  render: () => <NoticeAsk game="game:1" name="Ecos de Vidro" />,
}

// After a long stay on a phase of the guide.
export const GuidePart: Story = {
  render: () => <ExplainAsk np="NPWR00001_00" name="Ecos de Vidro" part="Capítulo 3: o porão" />,
}
