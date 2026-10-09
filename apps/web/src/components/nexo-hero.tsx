/** Decorative Nexo illustration. Working adds floating guide fragments, not measured progress. */
import { Icon } from '../ui/icon'
import './nexo-hero.css'

export function NexoHero({ working = false }: { working?: boolean }) {
  return (
    <span className={`nexo-hero${working ? ' working' : ''}`} aria-hidden="true">
      <img className="nexo-avatar" src="/nexo-avatar.svg" alt="" />
      {working && (
        <span className="nexo-processing">
          <span className="nexo-orbit" />
          <span className="nexo-document nexo-document-left">
            <Icon name="trophy" />
            <span>
              <i />
              <i />
              <i />
            </span>
          </span>
          <span className="nexo-document nexo-document-right">
            <Icon name="shield" />
            <span>
              <i />
              <i />
              <i />
            </span>
          </span>
          <span className="nexo-platform" />
        </span>
      )}
      <span className="nexo-keys">
        <span>△</span>
        <span>○</span>
        <span>×</span>
        <span>□</span>
      </span>
    </span>
  )
}
