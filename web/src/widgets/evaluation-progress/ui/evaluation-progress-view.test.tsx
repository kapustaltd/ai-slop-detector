import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { RegistryEvaluationProgress } from '@/shared/api'

import { EvaluationProgressView } from './evaluation-progress-view'

describe('EvaluationProgressView', () => {
  it('shows area progress, confirmed events and verified source links', async () => {
    const progress: RegistryEvaluationProgress = {
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
        {
          sequence: 2,
          at: '2026-09-24T10:00:01Z',
          kind: 'finding',
          title: 'Обработка ошибок не покрывает тайм-аут',
          detail: 'Проверенное замечание.',
          area: 'backend',
          source: {
            file: 'src/agent.ts',
            line_start: 18,
            line_end: 24,
            permalink: 'https://github.com/acme/repo/blob/abc/src/agent.ts#L18-L24',
          },
        },
      ],
    }

    render(<EvaluationProgressView progress={progress} />)

    expect(screen.getByRole('region', { name: 'Ход оценки' })).toBeInTheDocument()
    expect(screen.getByText('Анализируется')).toBeInTheDocument()
    expect(screen.getByText(/0 из 5 категорий/)).toBeInTheDocument()
    expect(screen.getByText(/46 файлов · 3 пропущено/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'src/agent.ts:18' })).toHaveAttribute(
        'href',
        'https://github.com/acme/repo/blob/abc/src/agent.ts#L18-L24',
      )
    })
    expect(screen.getByText('Ожидает запуска')).toBeInTheDocument()
  })
})
