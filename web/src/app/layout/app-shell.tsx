import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { ThemeToggle } from '../theme/theme-provider'

export function AppShell() {
  const [registryApiAvailable, setRegistryApiAvailable] = useState(false)
  const location = useLocation()
  const [routeState, setRouteState] = useState<{
    path: string
    animatedPath: string | null
  }>({ path: location.pathname, animatedPath: null })
  if (routeState.path !== location.pathname) {
    setRouteState({ path: location.pathname, animatedPath: location.pathname })
  }

  useEffect(() => {
    let active = true
    void fetch('/api/teams')
      .then((response) => {
        if (active) setRegistryApiAvailable(response.ok)
      })
      .catch(() => {
        if (active) setRegistryApiAvailable(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-[1320px] grid-cols-[1fr_auto] items-center gap-x-2 px-3 py-2 sm:flex sm:gap-6 sm:px-6">
          <Link
            aria-label="На главную"
            className="col-span-2 flex min-h-11 min-w-0 items-center gap-2 rounded-md text-fg no-underline hover:text-fg hover:no-underline sm:gap-3"
            to="/"
          >
            <img
              alt=""
              aria-hidden="true"
              className="size-8 shrink-0 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10 sm:size-9"
              src="/cyber-fish-logo.svg"
            />
            <span className="text-sm font-semibold tracking-[-0.01em] sm:text-[15px]">
              Проверка проектов
            </span>
          </Link>
          <nav
            aria-label="Основная навигация"
            className="flex items-center gap-1 text-sm sm:ml-auto"
          >
            <Link
              aria-current={location.pathname === '/' ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-control px-2 no-underline hover:bg-muted-surface sm:px-3 ${location.pathname === '/' ? 'font-semibold text-fg' : 'text-fg-muted'}`}
              to="/"
            >
              Рейтинг
            </Link>
            {registryApiAvailable ? (
              <Link
                aria-current={location.pathname === '/manage/teams' ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-control px-2 no-underline hover:bg-muted-surface sm:px-3 ${location.pathname === '/manage/teams' ? 'font-semibold text-fg' : 'text-fg-muted'}`}
                to="/manage/teams"
              >
                Команды
              </Link>
            ) : null}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <div
        key={location.pathname}
        className={routeState.animatedPath === location.pathname ? 'route-page' : undefined}
      >
        <Outlet />
      </div>
    </div>
  )
}
