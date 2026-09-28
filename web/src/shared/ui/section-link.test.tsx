import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createHashRouter, RouterProvider } from 'react-router-dom'

import { SectionLink } from './section-link'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('SectionLink', () => {
  it('keeps the hash-router path when navigating to a section', () => {
    window.history.replaceState(null, '', '/#/team/team-01?severity=major')
    const router = createHashRouter([
      {
        path: '/team/:teamId',
        element: <SectionLink target="area-backend">Открыть разбор</SectionLink>,
      },
      { path: '*', element: <div>Страница не найдена</div> },
    ])
    render(<RouterProvider router={router} />)

    const link = screen.getByRole('link', { name: 'Открыть разбор' })
    expect(link).toHaveAttribute('href', '#/team/team-01?severity=major#area-backend')
    fireEvent.click(link)

    expect(window.location.hash).toBe('#/team/team-01?severity=major#area-backend')
    expect(screen.queryByText('Страница не найдена')).not.toBeInTheDocument()
  })
})
