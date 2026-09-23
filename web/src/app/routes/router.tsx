import { createHashRouter } from 'react-router-dom'

import { LeaderboardPage } from '@/pages/leaderboard'
import { NotFoundPage } from '@/pages/not-found'
import { TeamPage } from '@/pages/team'
import { TeamManagementPage } from '@/pages/team-management'

import { AppShell } from '../layout/app-shell'

/**
 * Hash-режим выбран сознательно (спека 008, FR-003): прямые ссылки с фильтрами
 * работают на любом статическом хостинге без правил переписывания.
 */
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <LeaderboardPage /> },
      { path: '/team/:teamId', element: <TeamPage /> },
      { path: '/manage/teams', element: <TeamManagementPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
