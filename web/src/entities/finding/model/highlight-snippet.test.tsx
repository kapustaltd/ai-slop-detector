import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { FindingView } from '@/shared/api'

import { useHighlightedSnippet } from './highlight-snippet'

function finding(overrides: Partial<FindingView>): FindingView {
  return {
    kind: 'issue',
    severity: 'minor',
    file: 'src/main.ts',
    line_start: 1,
    line_end: 2,
    title: 'x',
    explanation: 'x',
    ...overrides,
  }
}

describe('useHighlightedSnippet', () => {
  it('не падает и остаётся null для неизвестного расширения файла', () => {
    const { result } = renderHook(() =>
      useHighlightedSnippet(finding({ file: 'README.unknownext', snippet: 'plain text' })),
    )
    expect(result.current).toBeNull()
  })

  it('остаётся null без сниппета', () => {
    const { result } = renderHook(() => useHighlightedSnippet(finding({ snippet: undefined })))
    expect(result.current).toBeNull()
  })

  it('подсвечивает известный язык токенами', async () => {
    const { result } = renderHook(() =>
      useHighlightedSnippet(finding({ file: 'src/main.ts', snippet: 'const x = 1' })),
    )

    await waitFor(() => expect(result.current).not.toBeNull(), { timeout: 10_000 })
    expect(result.current?.[0]?.length).toBeGreaterThan(0)
  })
})
