import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

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
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3 pr-16 sm:px-6 sm:pr-16">
          <Link
            aria-label="На главную"
            className="flex min-h-11 min-w-0 items-center gap-3 rounded-md text-fg no-underline hover:text-fg hover:no-underline"
            to="/"
          >
            <img
              alt=""
              aria-hidden="true"
              className="size-9 shrink-0 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
              src="/cyber-fish-logo.svg"
            />
          </Link>
          {registryApiAvailable && location.pathname !== '/manage/teams' ? (
            <Link
              className="ml-auto inline-flex min-h-11 items-center rounded-control px-3 text-sm text-fg no-underline hover:bg-muted-surface"
              to="/manage/teams"
            >
              Команды
            </Link>
          ) : null}
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
