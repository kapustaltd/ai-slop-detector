import { Moon, Sun } from 'lucide-react'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

import { applyTheme, getInitialTheme, type Theme } from '@/shared/config'

/**
 * Держит светлую/тёмную тему (спека 008, FR-018). Кнопка — иконка, не текст: на макетах
 * (`design/reference/screens/03-leaderboard-mobile.html`) переключатель темы — 44×44 px
 * icon-button `aria-label="Сменить тему"`, а не текстовая кнопка. Важно и функционально: полная
 * подпись «Тёмная тема»/«Светлая тема» в фиксированном верхнем правом углу перекрывала контент
 * страниц на ширине от 360 px (FR-015 фичи 005).
 */
const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
} | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function ThemeToggle({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = useContext(ThemeContext)
  if (!context) return null
  const { theme, setTheme } = context
  return (
    <button
      type="button"
      aria-label="Сменить тему"
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={`flex size-10 shrink-0 items-center justify-center rounded-control border border-line text-fg hover:bg-muted-surface sm:size-11 ${className}`}
      {...props}
    >
      {theme === 'dark' ? (
        <Sun aria-hidden="true" size={18} strokeWidth={1.9} />
      ) : (
        <Moon aria-hidden="true" size={18} strokeWidth={1.9} />
      )}
    </button>
  )
}
