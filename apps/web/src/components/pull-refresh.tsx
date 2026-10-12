/** Pull down at the top of a screen to refresh it, as in a native app. Only where the browser has no
 * pull-to-refresh of its own: the installed app and the native app. */
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { isNative, tick } from '../lib/native'
import { Icon } from '../ui/icon'
import { installed } from './install-guide'
import './pull-refresh.css'

const messages = defineMessages({
  [Language.PtBR]: { refreshing: 'Atualizando' },
  [Language.En]: { refreshing: 'Refreshing' },
})

// How far the finger travels, after resistance, before letting go refreshes; and the most it shows.
export const PULL_TRIGGER = 64
const PULL_MAX = 96
// The finger moves twice what the indicator does: the pull feels heavy, as in iOS.
const RESISTANCE = 0.5

/** Whether the touch started inside something scrolled down (a chat, a sheet): that one scrolls. */
function insideScrolled(target: EventTarget | null): boolean {
  for (let el = target as HTMLElement | null; el && el !== document.body; el = el.parentElement)
    if (el.scrollTop > 0 || el.closest('dialog')) return true
  return false
}

export function PullRefresh({
  onRefresh,
  enabled = installed() || isNative(),
}: {
  onRefresh: () => Promise<unknown>
  enabled?: boolean
}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const start = useRef<number | null>(null)
  const armed = useRef(false)
  const busy = useRef(false)
  const refresh = useRef(onRefresh)
  refresh.current = onRefresh

  useEffect(() => {
    if (!enabled) return
    const down = (e: TouchEvent) => {
      start.current =
        window.scrollY <= 0 && !busy.current && !insideScrolled(e.target)
          ? e.touches[0].clientY
          : null
    }
    const move = (e: TouchEvent) => {
      if (start.current === null) return
      const next = Math.min(
        PULL_MAX,
        Math.max(0, (e.touches[0].clientY - start.current) * RESISTANCE),
      )
      if (next >= PULL_TRIGGER !== armed.current) {
        armed.current = next >= PULL_TRIGGER
        if (armed.current) tick()
      }
      setPull(next)
    }
    const up = () => {
      if (start.current === null) return
      start.current = null
      const go = armed.current
      armed.current = false
      setPull(0)
      if (!go) return
      busy.current = true
      setRefreshing(true)
      refresh
        .current()
        .catch(() => {})
        .finally(() => {
          busy.current = false
          setRefreshing(false)
        })
    }
    document.addEventListener('touchstart', down, { passive: true })
    document.addEventListener('touchmove', move, { passive: true })
    document.addEventListener('touchend', up)
    document.addEventListener('touchcancel', up)
    return () => {
      document.removeEventListener('touchstart', down)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', up)
      document.removeEventListener('touchcancel', up)
    }
  }, [enabled])

  if (!enabled || (pull === 0 && !refreshing)) return null
  return <PullBadge pull={pull} refreshing={refreshing} />
}

/** The badge itself: how far it came down (`pull`, in px), lit past the trigger, spinning while
 * refreshing. */
export function PullBadge({ pull, refreshing = false }: { pull: number; refreshing?: boolean }) {
  const t = useMessages(messages)
  const shown = refreshing ? PULL_TRIGGER : pull
  return (
    <div
      className={`pull-refresh${refreshing ? ' refreshing' : ''}${pull >= PULL_TRIGGER ? ' armed' : ''}`}
      style={
        { '--pull': `${shown}px`, '--turn': `${(shown / PULL_TRIGGER) * 270}deg` } as CSSProperties
      }
      aria-hidden={!refreshing}
    >
      <Icon name="refresh" />
      {refreshing && (
        <span className="sr-only" role="status">
          {t('refreshing')}
        </span>
      )}
    </div>
  )
}
