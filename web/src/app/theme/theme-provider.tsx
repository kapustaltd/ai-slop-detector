import { useEffect, useState, type ReactNode } from 'react'

import { applyTheme, getInitialTheme, type Theme } from '@/shared/config'

/** Держит светлую/тёмную тему (спека 008, FR-018). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <>
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="fixed top-3 right-3 rounded-lg border px-3 py-1 text-sm"
      >
        {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      </button>
      {children}
    </>
  )
}
