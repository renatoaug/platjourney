/** Nexo floating among the controller's four buttons, which light up in turn; `working` lights them
 * up faster, Nexo busy on something. Decorative: the text next to it says what is going on. */
import './nexo-hero.css'

export function NexoHero({ working = false }: { working?: boolean }) {
  return (
    <span className={`nexo-hero${working ? ' working' : ''}`} aria-hidden="true">
      <img className="nexo-avatar" src="/nexo-avatar.svg" alt="" />
      <span className="nexo-keys">
        <span>△</span>
        <span>○</span>
        <span>×</span>
        <span>□</span>
      </span>
    </span>
  )
}
