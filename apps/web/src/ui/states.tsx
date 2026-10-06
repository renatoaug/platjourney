/** Empty, error and in-progress states. Every screen and list uses these instead of its own markup. */
import type { ReactNode } from 'react'
import { Icon } from './icon'
import './states.css'

// With an icon and a title the state becomes a small panel (a card with nothing to list yet);
// without them it stays one line of text.
function Rich({
  icon,
  title,
  tone,
  children,
  action,
}: {
  icon: string
  title?: string
  tone?: 'error'
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <>
      <span className={`empty-icon${tone === 'error' ? ' error' : ''}`} aria-hidden="true">
        <Icon name={icon} />
      </span>
      <div className="empty-text">
        {title && <b>{title}</b>}
        <span>{children}</span>
        {action && <div className="empty-action">{action}</div>}
      </div>
    </>
  )
}

/** Say what will show up here and, when there is one, offer the next step. */
export function EmptyState({
  children,
  action,
  className = '',
  icon,
  title,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
  icon?: string
  title?: string
}) {
  if (icon)
    return (
      <div className={`empty empty-rich ${className}`.trim()}>
        <Rich icon={icon} title={title} action={action}>
          {children}
        </Rich>
      </div>
    )
  return (
    <div className={`empty ${className}`.trim()}>
      {children}
      {action && <> {action}</>}
    </div>
  )
}

/** Never a blank screen: say what failed and how to recover. */
export function ErrorState({
  children,
  icon,
  title,
  action,
}: {
  children: ReactNode
  icon?: string
  title?: string
  action?: ReactNode
}) {
  if (icon)
    return (
      <div className="empty empty-rich" role="alert">
        <Rich icon={icon} title={title} tone="error" action={action}>
          {children}
        </Rich>
      </div>
    )
  return (
    <div className="empty" role="alert">
      {children}
    </div>
  )
}

/** Something is being prepared (a guide being researched, a sync running). Shows the typing dots. */
export function PendingState({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`empty inline-status ${className}`.trim()} role="status">
      <span className="typing">
        <i />
        <i />
        <i />
      </span>{' '}
      {children}
    </div>
  )
}
