import { useState } from 'react'
import MapView from './MapView'
import type { MapTheme } from './mapTheme'

const systemTheme = (): MapTheme =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export default function App() {
  const [theme, setTheme] = useState<MapTheme>(systemTheme)

  return (
    <div className={`app app--${theme}`}>
      <MapView theme={theme} />
      <button
        className="theme-toggle"
        onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} map`}
      >
        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
      </button>
    </div>
  )
}
