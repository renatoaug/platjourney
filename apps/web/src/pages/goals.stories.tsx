import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA, useApp } from '../app/app-state'
import { Page } from '../app/page'
import { applyCommand, emptyGoals, fakeSearch, sampleGoals } from '../components/goals/fixtures'
import { Language } from '../i18n/i18n'
import type { YearGoals } from '../lib/types'
import { Goals, GoalsView } from './goals'

const meta: Meta = { title: 'Pages/Goals', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

// The real view with the catalog search and /api/goals faked over the mock app state.
function Screen() {
  const { data, setData } = useApp()
  if (!data) return null
  const command = async (text: string) => {
    await new Promise((r) => setTimeout(r, 500))
    setData((d) => ({ ...d, goals: applyCommand(d.goals, text) }))
  }
  return (
    <Page path="/goals">
      <div className="page-head">
        <div>
          <h1>Interesses</h1>
          <p>Os jogos que você quer platinar, na sua ordem, e a meta do ano.</p>
        </div>
      </div>
      <div id="goals">
        <GoalsView goals={data.goals} search={fakeSearch} command={command} />
      </div>
    </Page>
  )
}

const withGoals = (goals: YearGoals) => (
  <MockAppState value={{ data: { ...SAMPLE_DATA, goals } }}>
    <Screen />
  </MockAppState>
)

export const Loaded: Story = { render: () => withGoals(sampleGoals) }

export const Empty: Story = { render: () => withGoals(emptyGoals) }

export const Loading: Story = {
  render: () => (
    <MockAppState value={{ data: null }}>
      <Goals />
    </MockAppState>
  ),
}

export const LoadFailed: Story = {
  render: () => (
    <MockAppState value={{ data: null, sync: 'failed' }}>
      <Goals />
    </MockAppState>
  ),
}

// The same screen in English (the toolbar switches any story).
export const English: Story = { ...Loaded, globals: { locale: Language.En } }
