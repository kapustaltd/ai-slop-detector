import { RouterProvider } from 'react-router-dom'

import { ThemeProvider } from './theme/theme-provider'
import { router } from './routes/router'

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}
