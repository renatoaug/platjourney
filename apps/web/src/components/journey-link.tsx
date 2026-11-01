import type { ComponentProps } from 'react'
import { Link, useLocation } from 'react-router'

/** Keep the journey mounted beneath Nexo, including its scroll, filters and selected step. */
export function JourneyLink(props: ComponentProps<typeof Link>) {
  const location = useLocation()
  const inJourney =
    location.pathname === '/' ||
    location.pathname === '/game' ||
    location.pathname.startsWith('/title/')
  const contextual = inJourney && typeof props.to === 'string' && props.to.startsWith('/nexo?')
  return <Link {...props} state={contextual ? { journey: location } : props.state} />
}
