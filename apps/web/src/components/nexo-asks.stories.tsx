import type { Meta, StoryObj } from '@storybook/react-vite'
import { ExplainAsk, FirstAsks, NoticeAsk, TrophyAsks } from './nexo-asks'

const meta: Meta = { title: 'Components/NexoAsks' }
export default meta
type Story = StoryObj

// The guide's advice is on screen: what goes beyond it, and "can I miss it" for a missable.
export const TrophyWithAdvice: Story = {
  render: () => (
    <TrophyAsks np="NPWR00001_00" name="Ecos de Vidro" trophy="Sem Rastro" advice missable />
  ),
}

// A counter trophy with advice: where to farm it.
export const CounterTrophy: Story = {
  render: () => (
    <TrophyAsks np="NPWR00001_00" name="Ecos de Vidro" trophy="Soldado" advice counter />
  ),
}

// No advice in the guide: how and when.
export const TrophyWithoutAdvice: Story = {
  render: () => <TrophyAsks np="NPWR00001_00" name="Ecos de Vidro" trophy="Primeiro Passo" />,
}

// A player who never wrote to Nexo, on a game in progress.
export const FirstQuestions: Story = {
  render: () => <FirstAsks np="NPWR00001_00" name="Ecos de Vidro" progress={40} />,
}

// The same player on a game not begun: one question.
export const FirstQuestionNotStarted: Story = {
  render: () => <FirstAsks np="NPWR00001_00" name="Ecos de Vidro" progress={0} />,
}

// Under a notice in the history.
export const Notice: Story = {
  render: () => <NoticeAsk game="game:1" name="Ecos de Vidro" />,
}

// After a long stay on a phase of the guide.
export const GuidePart: Story = {
  render: () => <ExplainAsk np="NPWR00001_00" name="Ecos de Vidro" part="Capítulo 3: o porão" />,
}
