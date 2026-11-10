/** An icon from the sprite the page carries (public/icons.svg, inlined by inline-icons.ts). Decorative: the control around it carries the accessible name. */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg className={`icon ${className}`.trim()} aria-hidden="true" focusable="false">
      <use href={`#icon-${name}`} />
    </svg>
  )
}
