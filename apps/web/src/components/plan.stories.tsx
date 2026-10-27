import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Plan, type PlanProps, type SessionPlan } from './plan'

// samplePlan is shared with the game screen's stories, not a story itself.
const meta: Meta = { title: 'Game/Plan', excludeStories: ['samplePlan'] }
export default meta
type Story = StoryObj

const icon = (id: string) =>
  `https://image.api.playstation.com/trophy/np/NPWR17130_00_002D14DB28AA079AB444D1AA3527D40F8F780DBAEE/${id}.PNG`

export const samplePlan: SessionPlan = {
  game: 'game:19561',
  gameName: 'DAYS GONE',
  minutes: 120,
  createdAt: '2026-09-30T19:00:00Z',
  expiresAt: '2026-09-30T22:00:00Z',
  summary:
    'Duas horas para limpar a região de Belknap: acampamentos, uma infestação e o saque humano.',
  totalMinutes: 110,
  warnings: ['Não termine a missão do acampamento de Copeland antes de limpar a emboscada.'],
  ifTimeLeft: 'Cace orelhas de Frenéticos na horda da serraria.',
  doneCount: 1,
  status: 'active',
  nextIndex: 1,
  steps: [
    {
      trophy: 'De raspão',
      minutes: 20,
      how: 'Fuja do **Crazy Willie’s** seguindo a história.',
      why: 'Abre o mapa.',
      trick: null,
      flexible: false,
      done: true,
      startsAt: 0,
      iconUrl: icon('F14D5D4E9ABB8082E3FDFC5FA320CE30D1C19EE7'),
      type: 'bronze',
    },
    {
      trophy: 'Entrega especial',
      minutes: 30,
      how: 'Leve carne ou orelhas a Tucker.\n\n- Venda no balcão\n- Pegue o pagamento',
      why: 'Sobe a confiança do acampamento.',
      trick: 'Guarde as orelhas para vender todas de uma vez.',
      flexible: false,
      done: false,
      startsAt: 20,
      iconUrl: icon('5D72243529C85C66730543D6120928F7D681D55C'),
      type: 'bronze',
    },
    {
      trophy: 'Segura firme',
      minutes: 40,
      how: 'Siga a missão principal até a ponte.',
      why: 'Troféu de história.',
      trick: null,
      flexible: false,
      done: false,
      startsAt: 50,
      iconUrl: icon('34A9ABC7CDAFC61FD986854068294A3905485B79'),
      type: 'bronze',
    },
    {
      trophy: 'Tá sujo de vermelho',
      minutes: 20,
      how: 'Saqueie todo humano que derrubar.',
      why: 'Contador longo.',
      trick: null,
      flexible: true,
      done: false,
      startsAt: 90,
      iconUrl: null,
      type: null,
    },
  ],
}

// The picker keeps its own choice, like the real card.
function Demo(props: Partial<PlanProps>) {
  const [minutes, setMinutes] = useState(120)
  const [picking, setPicking] = useState(props.picking ?? false)
  return (
    <Plan
      plan={samplePlan}
      minutes={minutes}
      onMinutes={setMinutes}
      onGo={() => {}}
      onCancel={() => setPicking(false)}
      onNew={() => setPicking(true)}
      onDiscard={() => {}}
      {...props}
      picking={picking}
    />
  )
}

export const Active: Story = { render: () => <Demo /> }

export const Done: Story = {
  render: () => (
    <Demo
      plan={{
        ...samplePlan,
        status: 'done',
        doneCount: 4,
        nextIndex: -1,
        steps: samplePlan.steps.map((s) => ({ ...s, done: true })),
      }}
    />
  ),
}

export const Expired: Story = {
  render: () => <Demo plan={{ ...samplePlan, status: 'expired', warnings: [] }} />,
}

/** No plan yet: the invite and the time picker. */
export const Empty: Story = { render: () => <Demo plan={null} /> }

/** Right after a route closed with no step done: the optional question above the invite. */
export const AskReason: Story = {
  render: () => <Demo plan={null} reasonAsk={{ onReason: () => {}, onSkip: () => {} }} />,
}

/** "Refazer roteiro": the picker with a way back to the current plan. */
export const Picking: Story = { render: () => <Demo picking /> }

export const Building: Story = { render: () => <Demo plan={null} busy /> }

export const Loading: Story = { render: () => <Demo plan={undefined} /> }
