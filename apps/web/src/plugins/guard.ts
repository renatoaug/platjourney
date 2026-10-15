/** Around every component a plugin puts on screen: one that throws while rendering is logged with
 * its place (`after Price`, `page /hello`) and replaced by `fallback`, instead of taking the whole
 * app down with it. */
import { Component, type ComponentType, createElement, type ReactNode } from 'react'

interface GuardProps {
  /** Where the plugin's component sits, for the console. */
  label: string
  /** What shows instead when it throws: nothing, the original or an error state. */
  fallback: ReactNode
  children?: ReactNode
}

class PluginGuard extends Component<GuardProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`plugin component failed (${this.props.label}):`, error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** `type` with `props`, inside a guard. */
export function guarded<P extends object>(
  type: ComponentType<P>,
  props: P,
  label: string,
  fallback: ReactNode = null,
): ReactNode {
  return createElement(PluginGuard, { label, fallback }, createElement(type, props))
}
