import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TeamManagementPage } from './team-management-page'

afterEach(() => vi.unstubAllGlobals())

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function RouteIndicator() {
  const location = useLocation()
  return <output aria-label="Текущий маршрут">{location.pathname}</output>
}

describe('guided team entry', () => {
  it('explains an empty repository submission without disabling the action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json([])),
    )
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Добавить команду' }))
    const continueButton = screen.getByRole('button', { name: 'Продолжить' })
    await user.click(continueButton)

    expect(screen.getByRole('alert')).toHaveTextContent('Укажите ссылку на репозиторий')
    expect(continueButton).toBeEnabled()
  })

  it('normalizes the repository and keeps the draft when the backdrop is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json([])),
    )
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Добавить команду' }))
    const repositoryInput = screen.getByRole('textbox', { name: 'Ссылка на репозиторий' })
    await user.type(repositoryInput, '  https://github.com/org/project.git  ')
    await user.click(screen.getByRole('presentation'))

    expect(screen.getByRole('dialog', { name: 'Добавить команду' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))
    expect(screen.getByRole('status', { name: 'Распознанный репозиторий' })).toHaveTextContent(
      'org/project',
    )

    await user.click(screen.getByRole('button', { name: 'Назад' }))
    expect(screen.getByRole('textbox', { name: 'Ссылка на репозиторий' })).toHaveValue(
      'https://github.com/org/project',
    )
  })

  it('closes the add-team sheet with Escape and restores the trigger focus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json([
          {
            id: 'alpha',
            name: 'Альфа',
            repo: 'https://github.com/org/alpha',
            branch: 'main',
            active: true,
          },
        ]),
      ),
    )
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    )

    const trigger = await screen.findByRole('button', { name: 'Добавить команду' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Добавить команду' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Добавить команду' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps action menus closed until their row is opened', async () => {
    const teams = [
      {
        id: 'alpha',
        name: 'Альфа',
        repo: 'https://github.com/org/alpha',
        branch: 'main',
        active: true,
      },
      {
        id: 'beta',
        name: 'Бета',
        repo: 'https://github.com/org/beta',
        branch: 'main',
        active: true,
      },
    ]
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/bundle/index') {
        return json({
          teams: [
            { team_id: 'alpha', status: 'done' },
            { team_id: 'beta', status: 'failed' },
          ],
        })
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

    const triggers = await waitFor(() => {
      const elements = screen.getAllByRole('button', { name: 'Действия' })
      expect(elements).toHaveLength(2)
      return elements
    })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await user.click(triggers[0])

    expect(triggers[0]).toHaveAttribute('aria-expanded', 'true')
    expect(triggers[1]).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('menu', { name: 'Действия команды Альфа' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Изменить Альфа' })).toBeVisible()
    expect(
      screen.queryByRole('menuitem', { name: 'Повторить анализ Альфа' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Изменить Бета' })).not.toBeInTheDocument()

    await user.click(triggers[0])
    await user.click(triggers[1])
    expect(screen.getByRole('menuitem', { name: 'Повторить анализ Бета' })).toBeVisible()
  })

  it('retries a failed evaluation from the actions menu', async () => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/bundle/index') {
        return json({ teams: [{ team_id: 'beta', status: 'failed' }] })
      }
      if (url === '/api/teams/beta/retry' && options?.method === 'POST') {
        return json({ team_id: 'beta', status: 'running' }, 202)
      }
      return json([
        {
          id: 'beta',
          name: 'Бета',
          repo: 'https://github.com/org/beta',
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

    await user.click(await screen.findByRole('button', { name: 'Действия' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Повторить анализ Бета' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/teams/beta/retry',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(await screen.findByText('Повторный анализ команды Бета запущен.')).toBeInTheDocument()
    expect(screen.getByText('Проверяется')).toBeInTheDocument()
  })

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

    await user.click((await screen.findAllByRole('button', { name: 'Действия' }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'Изменить Альфа' }))
    expect(screen.queryByLabelText('Токен оператора')).not.toBeInTheDocument()
    await user.clear(screen.getByRole('textbox', { name: 'Ветка' }))
    await user.type(screen.getByRole('textbox', { name: 'Ветка' }), 'release')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Команда обновлена.')).toBeInTheDocument()
    expect(screen.getByText('release')).toBeInTheDocument()

    await user.click((await screen.findAllByRole('button', { name: 'Действия' }))[0])
    await user.click(screen.getByRole('menuitem', { name: 'Удалить Альфа' }))
    expect(screen.queryByLabelText('Токен оператора')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Удалить команду' }))
    expect(await screen.findByText('Команда удалена из реестра.')).toBeInTheDocument()
    expect(screen.getByText('Команд пока нет')).toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: 'Продолжить' }))
    expect(screen.getByText('org/project')).toBeInTheDocument()
    expect(postCount).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Запустить проверку' }))
    expect(await screen.findAllByText('Сервис занят')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Запустить проверку' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Запустить проверку' }))
    await waitFor(() => expect(postCount).toBe(2))
  })

  it('opens the team page after creating a team', async () => {
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return json({ id: 'project' }, 201)
      return json([])
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/manage/teams']}>
        <Routes>
          <Route path="/manage/teams" element={<TeamManagementPage />} />
          <Route path="/team/:teamId" element={<RouteIndicator />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Добавить команду' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Ссылка на репозиторий' }),
      'https://github.com/org/project',
    )
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))
    await user.click(await screen.findByRole('button', { name: 'Продолжить' }))
    await user.click(screen.getByRole('button', { name: 'Запустить проверку' }))

    expect(await screen.findByRole('status', { name: 'Текущий маршрут' })).toHaveTextContent(
      '/team/project',
    )
  })
})
