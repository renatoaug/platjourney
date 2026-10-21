// First: index.css declares the cascade layers (base, ui, screens) before any rule uses them.
import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'
import { hideLaunchScreen, isNative, tickOnChoices } from './lib/native'

// The native app goes back with the iPhone's own swipe, which already animates (page.css).
if (isNative()) document.documentElement.dataset.native = ''
tickOnChoices()
// The stylesheets are in by now, so index.html's boot screen shows: the launch screen can go.
hideLaunchScreen()

// Links from before the addresses lost their "#" (old notices, a checkout's way back, a plugin's
// "#/subscription"): /#/history opens /history, on arrival or when such a link is followed.
const fromHash = () => {
  if (!location.hash.startsWith('#/')) return false
  history.replaceState(null, '', location.hash.slice(1) || '/')
  return true
}
fromHash()
window.addEventListener('hashchange', () => {
  if (fromHash()) window.dispatchEvent(new PopStateEvent('popstate'))
})

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
