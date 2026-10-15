/** App state shared across screens: who is signed in, the last /api/state payload and recommendations, with the periodic refresh. */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { defineMessages, Language, translator } from '../i18n/i18n'
import { api } from '../lib/api'
import type { AppStateData, Me } from '../lib/types'
import { toast } from '../ui/toast'

const messages = defineMessages({
  [Language.PtBR]: {
    refreshFailed: 'Não foi possível atualizar. Use o botão de atualizar para tentar novamente.',
  },
  [Language.En]: {
    refreshFailed: 'Could not refresh. Use the refresh button to try again.',
  },
})
const t = translator(messages)

type SyncStatus = 'connecting' | 'connected' | 'failed' | 'private'

interface AppState {
  me: Me
  setMe: (me: Me) => void
  /** Null until the first /api/state arrives: screens show their skeletons. */
  data: AppStateData | null
  setData: (update: (d: AppStateData) => AppStateData) => void
  loadState: () => Promise<void>
  loading: boolean
  sync: SyncStatus
  syncedAt: Date | null
  /** The first seconds after sign-in, while PSN answers the first sync and no game has arrived yet. */
  warming: boolean
  /** Screens keep what is expensive to fetch here so it survives navigation. */
  cache: Record<string, unknown>
}

const WARM_MS = 30_000
const WARM_EVERY_MS = 3_000

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside <AppStateProvider>')
  return v
}

export function AppStateProvider({ me: initial, children }: { me: Me; children: ReactNode }) {
  const [me, setMe] = useState(initial)
  const [data, setDataState] = useState<AppStateData | null>(null)
  const [loading, setLoading] = useState(false)
  const [sync, setSync] = useState<SyncStatus>('connecting')
  const [syncedAt, setSyncedAt] = useState<Date | null>(null)
  const busy = useRef(false)
  const cache = useRef<Record<string, unknown>>({}).current
  const [warming, setWarming] = useState(!initial.demo)
  const dataRef = useRef<AppStateData | null>(null)
  dataRef.current = data

  const loadState = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    try {
      setDataState(await api<AppStateData>('/api/state'))
      setSync('connected')
      setSyncedAt(new Date())
    } catch (e) {
      const err = e as { status?: number; handled?: boolean }
      if (err.status === 409) setSync('private')
      if (err.status === 401 || err.handled) return
      setSync('failed')
      toast(t('refreshFailed'))
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadState()
    const timer = setInterval(loadState, 60_000)
    // Progress numbers depend on the DLC preference; reload when it changes.
    document.addEventListener('preferences:changed', loadState)
    return () => {
      clearInterval(timer)
      document.removeEventListener('preferences:changed', loadState)
    }
  }, [loadState])

  // Signing in starts a PSN sync on the server that takes a few seconds; until the current game
  // arrives, ask again every 3 s for up to 30 s instead of waiting for the next minute.
  useEffect(() => {
    if (!warming) return
    const started = Date.now()
    const timer = setInterval(() => {
      if (dataRef.current?.current || Date.now() - started >= WARM_MS) {
        setWarming(false)
        clearInterval(timer)
        return
      }
      loadState()
    }, WARM_EVERY_MS)
    return () => clearInterval(timer)
  }, [warming, loadState])

  const setData = useCallback((update: (d: AppStateData) => AppStateData) => {
    setDataState((d) => (d ? update(d) : d))
  }, [])

  return (
    <Ctx.Provider
      value={{
        me,
        setMe,
        data,
        setData,
        loadState,
        loading,
        sync,
        syncedAt,
        warming,
        cache,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

/** For stories and tests: the same context with fixed values and no requests. */
export function MockAppState({
  value = {},
  children,
}: {
  value?: Partial<AppState>
  children: ReactNode
}) {
  const [data, setDataState] = useState<AppStateData | null>(
    value.data === undefined ? SAMPLE_DATA : value.data,
  )
  const setData = useCallback((update: (d: AppStateData) => AppStateData) => {
    setDataState((d) => (d ? update(d) : d))
  }, [])
  const noop = async () => {}
  return (
    <Ctx.Provider
      value={{
        me: SAMPLE_ME,
        setMe: () => {},
        loadState: noop,
        loading: false,
        sync: 'connected',
        syncedAt: new Date(),
        warming: false,
        cache: {},
        ...value,
        data,
        setData,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const SAMPLE_ME: Me = {
  id: 'user:sample',
  onlineId: 'jogador',
  avatarUrl: '/nexo-avatar.svg',
  telegramLinked: false,
  includeDlcProgress: false,
  // Screens and their stories start past the first-visit introduction.
  onboarded: true,
}

export const SAMPLE_DATA: AppStateData = {
  profile: {
    onlineId: 'jogador',
    avatarUrl: '/nexo-avatar.svg',
    level: 312,
    levelProgress: 40,
    earned: { bronze: 2140, silver: 610, gold: 180, platinum: 42 },
  },
  current: null,
  tips: [],
  unread: 2,
  ranking: [],
  goals: { year: 2026, target: 12, done: 7, platinumed: [], interests: [] },
  servers: [],
}
