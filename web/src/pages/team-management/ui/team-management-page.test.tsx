import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TeamManagementPage } from './team-management-page'

afterEach(() => vi.unstubAllGlobals())

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('guided team entry', () => {
  it('updates and deletes a team without an operator token', async () => {
    const existing = {
      id: 'alpha',
      name: 'Альфа',
      repo: 'https://github.com/org/alpha',
      branch: 'main',
      active: true,
    }
    let teams = [existing]
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/bundle/index')
        return json({ teams: [{ team_id: 'alpha', status: 'done' }] })
      if (options?.method === 'PUT') {
        expect(options.headers).not.toHaveProperty('Authorization')
        teams = [JSON.parse(options.body as string)]
        return json(teams[0])
      }
      if (options?.method === 'DELETE') {
        expect(options.headers).not.toHaveProperty('Authorization')
        teams = []
        return new Response(null, { status: 204 })
      }
      return json(teams)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Изменить Альфа' }))
    expect(screen.queryByLabelText('Токен оператора')).not.toBeInTheDocument()
    await user.clear(screen.getByRole('textbox', { name: 'Ветка' }))
    await user.type(screen.getByRole('textbox', { name: 'Ветка' }), 'release')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Команда обновлена.')).toBeInTheDocument()
    expect(screen.getByText('release')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Удалить Альфа' }))
    expect(screen.queryByLabelText('Токен оператора')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(await screen.findByText('Команда удалена из реестра.')).toBeInTheDocument()
    expect(screen.getByText('В реестре пока нет команд.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true)
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(true)
  })

  it('stops an existing repository before details and does not post', async () => {
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') throw new Error('unexpected POST')
      return json([
        {
          id: 'existing',
          name: 'Existing',
          repo: 'https://github.com/org/project',
          branch: 'main',
          active: true,
        },
      ])
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Добавить команду' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Ссылка на репозиторий' }),
      'https://github.com/org/project.git',
    )
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))

    expect(await screen.findByText('Этот репозиторий уже есть в реестре.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Название команды' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
  })

  it('posts only after review and retains the draft after a save error', async () => {
    let postCount = 0
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        postCount++
        return postCount === 1 ? json({ error: 'Сервис занят' }, 503) : json({ id: 'project' }, 201)
      }
      return json([])
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Добавить команду' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Ссылка на репозиторий' }),
      'https://github.com/org/project.git',
    )
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))
    expect(await screen.findByRole('textbox', { name: 'Название команды' })).toHaveValue('project')
    expect(screen.getByRole('textbox', { name: 'ID команды' })).toHaveValue('project')
    expect(postCount).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Посмотреть итог' }))
    expect(screen.getAllByText('https://github.com/org/project')).toHaveLength(2)
    expect(postCount).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Добавить в реестр' }))
    expect(await screen.findAllByText('Сервис занят')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Добавить в реестр' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Добавить в реестр' }))
    await waitFor(() => expect(screen.getByText(/Команда добавлена/)).toBeInTheDocument())
    expect(postCount).toBe(2)
  })

  it('shows live processing steps and the report when evaluation completes', async () => {
    let progressCalls = 0
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/evaluation/progress/project') {
        progressCalls++
        return json(
          progressCalls === 1
            ? { status: 'running', stage: 'waiting', areas: [], events: [] }
            : { status: 'done', stage: 'done', areas: [], events: [] },
        )
      }
      if (options?.method === 'POST') return json({ id: 'project' }, 201)
      return json([])
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Добавить команду' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Ссылка на репозиторий' }),
      'https://github.com/org/project',
    )
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))
    await user.click(await screen.findByRole('button', { name: 'Посмотреть итог' }))
    await user.click(screen.getByRole('button', { name: 'Добавить в реестр' }))

    expect(await screen.findByText('Задание ожидает запуска.')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Ход оценки' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Смотреть ход оценки' })).toHaveAttribute(
      'href',
      '/team/project',
    )
    await waitFor(() => expect(progressCalls).toBeGreaterThan(1), { timeout: 5000 })
    expect(await screen.findByText('Оценка завершена.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Открыть отчёт' })).toHaveAttribute(
      'href',
      '/team/project',
    )
  })
})
