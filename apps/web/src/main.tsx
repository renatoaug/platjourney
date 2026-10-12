// First: index.css declares the cascade layers (base, ui, screens) before any rule uses them.
import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'
import { isNative, tickOnChoices } from './lib/native'

// The native app goes back with the iPhone's own swipe, which already animates (page.css).
if (isNative()) document.documentElement.dataset.native = ''
tickOnChoices()

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
