import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { ThemeToggle } from '../theme/theme-provider'

export function AppShell() {
  const location = useLocation()
  const [routeState, setRouteState] = useState<{
    path: string
    animatedPath: string | null
  }>({ path: location.pathname, animatedPath: null })
  if (routeState.path !== location.pathname) {
    setRouteState({ path: location.pathname, animatedPath: location.pathname })
  }

  useEffect(() => {
    const page =
      location.pathname === '/'
        ? {
            title: 'Рейтинг команд — Проверка проектов',
            description:
              'Рейтинг команд по качеству кода репозитория. Идея, демо и защита в оценку не входят.',
          }
        : location.pathname === '/manage/teams'
          ? {
              title: 'Команды — Проверка проектов',
              description: 'Реестр команд и запуск новых проверок репозиториев.',
            }
          : {
              title: 'Отчёт команды — Проверка проектов',
              description: 'Подробный отчёт автоматической проверки качества кода команды.',
            }
    document.title = page.title
    const description = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    description?.setAttribute('content', page.description)
  }, [location.pathname])

  return (
    <div className="dashboard-app-shell min-h-dvh bg-bg text-fg">
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <div className="dashboard-app-content">
        <header className="dashboard-app-header">
          <div className="dashboard-app-header-inner">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="На главную"
                className="flex min-h-10 min-w-0 items-center gap-2 rounded-md text-fg no-underline hover:text-fg hover:no-underline sm:min-h-11"
                to="/"
              >
                <img
                  alt=""
                  aria-hidden="true"
                  className="size-8 shrink-0 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                  src="/cyber-eye-logo.png"
                />
                <span className="truncate text-sm font-semibold tracking-[-0.01em]">
                  Проверка проектов
                </span>
              </Link>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <div id="main-content">
          <div
            key={location.pathname}
            className={routeState.animatedPath === location.pathname ? 'route-page' : undefined}
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
