/** Interests screen: the season and yearly target, the ordered list of games to platinum with the add panel, and the year's platinums. */
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { messages as interestMessages, useInterests } from '../app/use-interests'
import { DemoNote } from '../components/demo'
import { DealsSpotlight } from '../components/goals/deals-spotlight'
import { GoalAddPanel } from '../components/goals/goal-add-panel'
import { type Feedback, GoalSeason, GoalSeasonSkeleton } from '../components/goals/goal-season'
import { InterestList, InterestListSkeleton } from '../components/goals/interest-list'
import { type NextPick, NextPickBox } from '../components/goals/next-pick'
import type { GoalFilter } from '../components/goals/season'
import { useKept } from '../components/goals/use-kept'
import { YearPlatinums } from '../components/goals/year-platinums'
import { PageHero } from '../components/page-hero'
import { defineMessages, Language, translator, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import type { Game, YearGoals } from '../lib/types'
import { modelWorkDone } from '../plugins'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'
import { toast } from '../ui/toast'
import '../components/tip.css'
import './goals.css'

// Nexo picks which saved game to platinum now (model work, on request).
const askNext = () => api<{ pick: NextPick | null }>('/api/interests/next', {})

const messages = defineMessages({
  [Language.PtBR]: {
    page: {
      eyebrow: 'SUA LISTA DE PLATINAS',
      title: 'Interesses',
      lead: 'Os jogos que você quer platinar, na sua ordem, e a meta do ano.',
      loadFailed:
        'Não foi possível carregar seus interesses. Use o botão de atualizar para tentar novamente.',
      saving: 'Salvando…',
      saved: 'Alterações salvas.',
      saveFailed: 'Não foi possível salvar. Tente novamente.',
      mine: 'Meus interesses',
      add: 'Adicionar jogo',
      addShort: 'Adicionar',
      empty: 'Salve o primeiro jogo que você quer platinar.',
      yearAchievements: 'Conquistas do ano',
    },
  },
  [Language.En]: {
    page: {
      eyebrow: 'YOUR PLATINUM LIST',
      title: 'Interests',
      lead: 'The games you want to platinum, in your order, and the goal for the year.',
      loadFailed: 'Could not load your interests. Use the refresh button to try again.',
      saving: 'Saving…',
      saved: 'Changes saved.',
      saveFailed: 'Could not save. Try again.',
      mine: 'My interests',
      add: 'Add game',
      addShort: 'Add',
      empty: 'Save the first game you want to platinum.',
      yearAchievements: "This year's platinums",
    },
  },
})
const interestT = translator(interestMessages)
// The toast after a change to one saved game, by the command that made it.
const DONE_TOASTS: Record<string, 'interestSaved' | 'interestRemoved' | 'interestOwned'> = {
  add: 'interestSaved',
  remove: 'interestRemoved',
  owned: 'interestOwned',
}

export function Goals() {
  const t = useMessages(messages)
  const { data, sync, me } = useApp()
  const demo = me.demo === true
  return (
    <Page path="/goals">
      {/* The player's own saved games on the shelf. */}
      <PageHero
        eyebrow={t('page.eyebrow')}
        title={t('page.title')}
        lead={t('page.lead')}
        images={(data?.goals.interests ?? [])
          .filter((i) => !i.done && i.game.cover_url)
          .map((i) => i.game.cover_url as string)}
        look="shelf"
      />
      <div id="goals">
        {data ? (
          <GoalsView goals={data.goals} readOnly={demo} />
        ) : sync === 'failed' ? (
          <ErrorState>{t('page.loadFailed')}</ErrorState>
        ) : (
          <GoalsSkeleton />
        )}
      </div>
    </Page>
  )
}

/**
 * Everything below the page head. Open editors, the add panel and its draft live in state kept
 * across navigation, so the periodic /api/state refresh never discards them.
 */
export function GoalsView({
  goals: p,
  search,
  command: fake,
  readOnly = false,
  nextPick,
}: {
  goals: YearGoals
  /** The catalog search; stories pass a fake one. */
  search?: (query: string) => Promise<Game[]>
  /** Stories pass a fake /api/goals; the screen uses the shared one, which updates the app state. */
  command?: (text: string) => Promise<unknown>
  /** The demo: everything shows, nothing can be edited, added, removed or moved. */
  readOnly?: boolean
  /** Stories pass the card in a fixed state; the screen asks the server. */
  nextPick?: ReactNode
}) {
  const t = useMessages(messages)
  const { cache, setData } = useApp()
  /** The pick also marks its row as the next platinum, as the server just did. */
  const ask = async () => {
    const res = await askNext()
    const id = res.pick?.game.id
    if (id) {
      const at = new Date().toISOString()
      setData((d) =>
        d?.goals
          ? {
              ...d,
              goals: {
                ...d.goals,
                interests: d.goals.interests.map((i) => ({
                  ...i,
                  nextPickAt: i.game.id === id ? at : null,
                })),
              },
            }
          : d,
      )
    }
    return res
  }
  const shared = useInterests().command
  const command = fake ?? shared
  const [filter, setFilter] = useKept<GoalFilter>('goals.filter', 'all')
  const [page, setPage] = useKept('goals.page', 1)
  const [editing, setEditing] = useKept('goals.editing', false)
  const [addOpen, setAddOpen] = useKept('goals.addOpen', false)
  const [draft, setDraft] = useKept('goals.draft', '')
  const [selection, setSelection] = useKept<Game | null>('goals.selection', null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>({ text: '' })
  const [newGameId, setNewGameId] = useState<string | null>(null)
  // After an add the panel starts over (results and status cleared) as a fresh panel.
  const [panelKey, setPanelKey] = useState(0)
  const saving = useRef(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const addInput = useRef<HTMLInputElement>(null)
  const pendingFocus = useRef<'toggle' | 'input' | null>(null)

  // Focus moves once the panel has opened or closed and the buttons are enabled again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: addOpen re-runs it when the panel toggles
  useEffect(() => {
    if (busy || !pendingFocus.current) return
    const target = pendingFocus.current === 'input' ? addInput.current : toggle.current
    pendingFocus.current = null
    target?.focus({ preventScroll: true })
  }, [busy, addOpen])

  const openAdd = (open: boolean) => {
    if (saving.current) return
    setAddOpen(open)
    pendingFocus.current = open ? 'input' : 'toggle'
  }

  const save = async (text: string, name?: string | null) => {
    if (saving.current) return false
    saving.current = true
    setBusy(true)
    setFeedback({ text: t('page.saving') })
    try {
      await command(text)
      setEditing(false)
      setNewGameId(null)
      if (text.startsWith('add ')) {
        setAddOpen(false)
        setDraft('')
        setSelection(null)
        setFilter('all')
        setPage(1)
        setPanelKey((k) => k + 1)
        setNewGameId(text.slice(4))
        pendingFocus.current = 'toggle'
      }
      setFeedback({ text: t('page.saved') })
      const done = name && DONE_TOASTS[text.split(' ')[0]]
      if (done) toast(interestT(done, { name }), 'success')
      return true
    } catch {
      setFeedback({ text: t('page.saveFailed'), error: true })
      return false
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <GoalSeason
        goals={p}
        editing={editing && !readOnly}
        onEditing={setEditing}
        busy={busy || readOnly}
        feedback={feedback}
        onFeedback={setFeedback}
        onSet={(target) => save(`set ${target}`)}
      />
      {/* The saved games on sale, in a band across the page (only when there is one). */}
      <DealsSpotlight
        interests={p.interests}
        onOwned={readOnly ? undefined : (i) => save(`owned ${i.id}`, i.game.name)}
      />
      {/* Two empty cards side by side keep one height; with content each takes its own. */}
      <div
        className={`grid cols-2 goals-columns${p.interests.length || p.platinumed.length ? '' : ' empty'}`}
        style={{ marginTop: 20 }}
      >
        <div className="card">
          <div className="goal-list-heading">
            <h2 className="goal-section-title">
              {t('page.mine')} <span>{p.interests.length}</span>
            </h2>
            <button
              ref={toggle}
              type="button"
              className="sm"
              id="goal-add-toggle"
              aria-expanded={addOpen}
              aria-controls="goal-add-panel"
              disabled={busy || readOnly}
              onClick={() => openAdd(!addOpen)}
              aria-label={t('page.add')}
            >
              <Icon name="plus" /> <span className="goal-add-long">{t('page.add')}</span>
              <span className="goal-add-short">{t('page.addShort')}</span>
            </button>
          </div>
          <GoalAddPanel
            key={panelKey}
            open={addOpen && !readOnly}
            busy={busy}
            interests={p.interests}
            draft={draft}
            onDraft={setDraft}
            selection={selection}
            onSelection={setSelection}
            onSave={(game) => save(`add ${game.id} from:search`, game.name)}
            onClose={() => openAdd(false)}
            inputRef={addInput}
            search={search}
          />
          {!readOnly &&
            p.interests.length > 1 &&
            (nextPick ?? <NextPickBox ask={ask} cache={cache} onDone={modelWorkDone} />)}
          {p.interests.length ? (
            <InterestList
              interests={p.interests}
              filter={filter}
              page={page}
              onFilter={(next) => {
                setFilter(next)
                setPage(1)
                setNewGameId(null)
              }}
              onPage={(next) => {
                setPage(next)
                setNewGameId(null)
              }}
              busy={busy}
              readOnly={readOnly}
              newGameId={newGameId}
              onRemove={(id) =>
                save(`remove ${id}`, p.interests.find((g) => g.id === id)?.game.name)
              }
              onReorder={(ids) => save(`order ${ids.join(',')}`)}
            />
          ) : (
            <EmptyState>{t('page.empty')}</EmptyState>
          )}
          {readOnly && <DemoNote />}
        </div>
        <div className="goals-side">
          <YearPlatinums goals={p} busy={busy} />
        </div>
      </div>
    </>
  )
}

function GoalsSkeleton() {
  const t = useMessages(messages)
  return (
    <>
      <GoalSeasonSkeleton />
      <div className="grid cols-2" style={{ marginTop: 20 }}>
        <div className="card">
          <h2 className="goal-section-title">{t('page.mine')}</h2>
          <InterestListSkeleton />
        </div>
        <div className="card">
          <h2 className="goal-section-title">{t('page.yearAchievements')}</h2>
          <ul className="timeline">
            {Array.from({ length: 5 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
              <li key={i}>
                <Sk w="55%" h={12} />
                <Sk w="70px" h={9} style={{ marginTop: 6 }} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
