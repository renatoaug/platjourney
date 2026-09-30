/** A screen's outer element. The stylesheet animates .page.active in; ui:check waits for its skeletons to go. */
import type { ReactNode } from 'react'

export function Page({ path, children }: { path: string; children: ReactNode }) {
  return (
    <section className="page active" data-page={path}>
      {children}
    </section>
  )
}
