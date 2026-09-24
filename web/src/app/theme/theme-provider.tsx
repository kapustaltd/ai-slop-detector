import { Moon, Sun } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { applyTheme, getInitialTheme, type Theme } from '@/shared/config'

/**
 * Держит светлую/тёмную тему (спека 008, FR-018). Кнопка — иконка, не текст: на макетах
 * (`design/reference/screens/03-leaderboard-mobile.html`) переключатель темы — 44×44 px
 * icon-button `aria-label="Сменить тему"`, а не текстовая кнопка. Важно и функционально: полная
 * подпись «Тёмная тема»/«Светлая тема» в фиксированном верхнем правом углу перекрывала контент
 * страниц на ширине от 360 px (FR-015 фичи 005).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <>
      <button
        type="button"
        aria-label="Сменить тему"
        title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="fixed top-3 right-3 z-10 flex h-[var(--ds-control-mobile)] w-[var(--ds-control-mobile)] items-center justify-center rounded-control border border-line-strong bg-surface text-fg md:size-10"
      >
        {theme === 'dark' ? (
          <Sun aria-hidden="true" size={18} strokeWidth={1.9} />
        ) : (
          <Moon aria-hidden="true" size={18} strokeWidth={1.9} />
        )}
      </button>
      {children}
    </>
  )
}
