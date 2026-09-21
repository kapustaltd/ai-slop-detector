import { createHashRouter } from 'react-router-dom'

import { LeaderboardPage } from '@/pages/leaderboard'
import { NotFoundPage } from '@/pages/not-found'
import { TeamPage } from '@/pages/team'

/**
 * Hash-режим выбран сознательно (спека 008, FR-003): прямые ссылки с фильтрами
 * работают на любом статическом хостинге без правил переписывания.
 */
export const router = createHashRouter([
  { path: '/', element: <LeaderboardPage /> },
  { path: '/team/:teamId', element: <TeamPage /> },
  { path: '*', element: <NotFoundPage /> },
])
