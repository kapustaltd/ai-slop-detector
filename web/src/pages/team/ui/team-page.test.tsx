import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadTeam } from '@/shared/api'

import { TeamPage } from './team-page'

function renderTeam(initialEntry = '/team/team-01') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/team/:teamId" element={<TeamPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function CurrentLocation() {
  const location = useLocation()
  return (
    <output data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</output>
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (Element.prototype as { scrollIntoView?: () => void }).scrollIntoView
})

describe('TeamPage', () => {
  it('переходит к аналитике и категориям без смены маршрута команды', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(
      <MemoryRouter initialEntries={['/team/team-01']}>
        <CurrentLocation />
        <Routes>
          <Route path="/team/:teamId" element={<TeamPage />} />
          <Route path="*" element={<div>Страница не найдена</div>} />
        </Routes>
      </MemoryRouter>,
    )

    const openBreakdowns = await screen.findAllByRole('link', { name: 'Открыть разбор' })
    fireEvent.click(openBreakdowns[0])
    expect(screen.getByTestId('location')).toHaveTextContent('/team/team-01#area-backend')
    expect(screen.queryByText('Страница не найдена')).not.toBeInTheDocument()
    expect(scrollIntoView).toHaveBeenCalled()

    const categoryLink = screen.getByRole('link', { name: 'Архитектура и структура' })
    fireEvent.click(categoryLink)
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/team/team-01#area-backend-category-architecture',
    )
    expect(screen.queryByText('Страница не найдена')).not.toBeInTheDocument()
  })
  it('shows a published area while the rest of the team is still processing', async () => {
    const fixture = await loadTeam('team-01')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/evaluation/progress/team-01')
          return new Response(
            JSON.stringify({
              status: 'running',
              stage: 'analyzing',
              areas: [
                {
                  area: 'backend',
                  status: 'running',
                  included_files: 46,
                  excluded_files: 3,
                  completed_categories: 0,
                  total_categories: 5,
                },
                {
                  area: 'frontend',
                  status: 'queued',
                  included_files: 0,
                  excluded_files: 0,
                  completed_categories: 0,
                  total_categories: 4,
                },
              ],
              events: [
                {
                  sequence: 1,
                  at: '2026-09-24T10:00:00Z',
                  kind: 'scan',
                  title: 'Структура файлов проверена',
                  detail: 'Включено 46 файлов, исключено 3.',
                  area: 'backend',
                },
              ],
            }),
            { status: 200 },
          )
        if (url === '/api/bundle/index')
          return new Response(
            JSON.stringify({ teams: [{ team_id: 'team-01', status: 'running' }] }),
            { status: 200 },
          )
        if (url === '/api/bundle/teams/team-01')
          return new Response(
            JSON.stringify({
              ...fixture,
              status: 'running',
              total: null,
              partial: true,
              areas: { backend: fixture.areas.backend },
            }),
            { status: 200 },
          )
        return new Response(null, { status: 404 })
      }),
    )
    renderTeam()
    expect(await screen.findByRole('region', { name: 'Ход проверки' })).toBeInTheDocument()
    expect(screen.getByText('Проверено категорий: 0 из 5')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Контекст проверки' })).toHaveLength(2)
    expect(await screen.findByText('Структура файлов проверена')).toBeInTheDocument()
    expect(await screen.findByText('Разбор по рубрике · backend')).toBeInTheDocument()
    expect(screen.queryByText('Разбор по рубрике · frontend')).not.toBeInTheDocument()
  })

  it('shows the rubric skeleton and current trace before the first partial bundle exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/evaluation/progress/team-01')
          return new Response(
            JSON.stringify({
              status: 'running',
              stage: 'analyzing',
              areas: [
                {
                  area: 'backend',
                  status: 'running',
                  included_files: 12,
                  excluded_files: 1,
                  completed_categories: 0,
                  total_categories: 5,
                },
                {
                  area: 'frontend',
                  status: 'queued',
                  included_files: 0,
                  excluded_files: 0,
                  completed_categories: 0,
                  total_categories: 4,
                },
              ],
              events: [
                {
                  sequence: 2,
                  at: '2026-09-24T10:00:00Z',
                  kind: 'scan',
                  title: 'Структура файлов проверена',
                  detail: 'Включено 12 файлов.',
                  area: 'backend',
                },
              ],
            }),
            { status: 200 },
          )
        if (url === '/api/bundle/index')
          return new Response(
            JSON.stringify({ teams: [{ team_id: 'team-01', status: 'running' }] }),
            { status: 200 },
          )
        return new Response(null, { status: 404 })
      }),
    )
    renderTeam()
    expect(await screen.findByRole('heading', { name: 'team-01' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ход проверки' })).toBeInTheDocument()
    expect(screen.getAllByText('Backend').length).toBeGreaterThan(0)
    expect(screen.getByText('Ожидает запуска')).toBeInTheDocument()
    expect(screen.getByText('Структура файлов проверена')).toBeInTheDocument()
  })

  it('retains the last confirmed trace when a later progress poll fails', async () => {
    const fixture = await loadTeam('team-01')
    let progressCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/evaluation/progress/team-01') {
          progressCalls++
          if (progressCalls > 1) throw new Error('network unavailable')
          return new Response(
            JSON.stringify({
              status: 'running',
              stage: 'analyzing',
              areas: [
                {
                  area: 'backend',
                  status: 'running',
                  included_files: 12,
                  excluded_files: 0,
                  completed_categories: 0,
                  total_categories: 5,
                },
              ],
              events: [
                {
                  sequence: 3,
                  at: '2026-09-24T10:00:00Z',
                  kind: 'scan',
                  title: 'Последнее подтверждённое событие',
                  detail: 'Включено 12 файлов.',
                  area: 'backend',
                },
              ],
            }),
            { status: 200 },
          )
        }
        if (url === '/api/bundle/index')
          return new Response(
            JSON.stringify({ teams: [{ team_id: 'team-01', status: 'running' }] }),
            { status: 200 },
          )
        if (url === '/api/bundle/teams/team-01')
          return new Response(
            JSON.stringify({
              ...fixture,
              status: 'running',
              total: null,
              partial: true,
              areas: { backend: fixture.areas.backend },
            }),
            { status: 200 },
          )
        return new Response(null, { status: 404 })
      }),
    )
    renderTeam()
    expect(await screen.findByText('Последнее подтверждённое событие')).toBeInTheDocument()
    expect(
      await screen.findByText(/Обновления недоступны · последние данные/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
    expect(screen.getByText('Последнее подтверждённое событие')).toBeInTheDocument()
  }, 12_000)

  it('показывает заголовок, итог и метаданные', async () => {
    renderTeam()

    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'Команда 01' })).toBeInTheDocument(),
      { timeout: 10_000 },
    )
    expect(screen.getByRole('region', { name: 'Метаданные оценки' })).toBeInTheDocument()
  })

  it('показывает разбор по рубрике для каждой оценённой области', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    renderTeam()

    await waitFor(
      () => expect(screen.getByText('Разбор по рубрике · backend')).toBeInTheDocument(),
      { timeout: 10_000 },
    )

    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Область подробного разбора' })).getByRole(
        'link',
        { name: 'Frontend' },
      ),
    )
    expect(await screen.findByText('Разбор по рубрике · frontend')).toBeInTheDocument()
    expect(screen.queryByText('Разбор по рубрике · backend')).not.toBeInTheDocument()
  })

  it('показывает «команда не найдена» для отсутствующего id', async () => {
    renderTeam('/team/does-not-exist')

    await waitFor(() => expect(screen.getByText('Команда не найдена')).toBeInTheDocument(), {
      timeout: 10_000,
    })
  })
})
