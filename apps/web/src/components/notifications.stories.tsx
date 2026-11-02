import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { NotificationsFooter } from './notifications'

const meta: Meta = { title: 'Components/Notifications' }
export default meta
type Story = StoryObj

function PagedFooter({ pages = 10 }: { pages?: number }) {
  const [page, setPage] = useState(1)
  return (
    <div style={{ width: 'min(420px, 100%)' }}>
      <NotificationsFooter pages={pages} page={page} onPage={setPage} onNavigate={() => {}} />
    </div>
  )
}

export const ManyPages: Story = { render: () => <PagedFooter /> }
export const HundredPages: Story = { render: () => <PagedFooter pages={100} /> }
