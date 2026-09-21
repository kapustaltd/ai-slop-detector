import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['./src/shared/ui/**'],
    rules: {
      // Компоненты shadcn лежат в репозитории и правятся как обычный код,
      // но их внутреннюю раскладку задаёт CLI — правила именования к ним не применяем.
      'fsd/no-public-api-sidestep': 'off',
      'fsd/public-api': 'off',
    },
  },
])
