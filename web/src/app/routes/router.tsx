import { createHashRouter } from 'react-router-dom'

import { AppShell } from '../layout/app-shell'

/**
 * Hash-режим выбран сознательно (спека 008, FR-003): прямые ссылки с фильтрами
 * работают на любом статическом хостинге без правил переписывания.
 */
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      {
        path: '/',
        lazy: async () => ({
          Component: (await import('@/pages/leaderboard')).LeaderboardPage,
        }),
      },
      {
        path: '/team/:teamId',
        lazy: async () => ({
          Component: (await import('@/pages/team')).TeamPage,
        }),
      },
      {
        path: '/manage/teams',
        lazy: async () => ({
          Component: (await import('@/pages/team-management')).TeamManagementPage,
        }),
      },
      {
        path: '*',
        lazy: async () => ({
          Component: (await import('@/pages/not-found')).NotFoundPage,
        }),
      },
    ],
  },
])
