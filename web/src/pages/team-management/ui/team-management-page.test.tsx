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
})
