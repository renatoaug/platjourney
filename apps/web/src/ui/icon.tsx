/** An icon from /icons.svg. Decorative: the control around it carries the accessible name. */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg className={`icon ${className}`.trim()} aria-hidden="true" focusable="false">
      <use href={`/icons.svg#${name}`} />
    </svg>
  )
}
