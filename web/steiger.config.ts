import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['./src/shared/ui/shadcn/**'],
    rules: {
      // Компоненты shadcn лежат в репозитории и правятся как обычный код,
      // но их внутреннюю раскладку задаёт CLI — правила именования к ним не применяем.
      'fsd/no-public-api-sidestep': 'off',
      'fsd/public-api': 'off',
    },
  },
  {
    // These page compositions and the entity slices they consume intentionally stay separated:
    // each contains independently tested UI or domain logic, though the composition is page-local.
    files: [
      './src/entities/finding/**',
      './src/entities/metric/**',
      './src/entities/team/**',
      './src/widgets/area-profile/**',
      './src/widgets/evaluation-meta/**',
      './src/widgets/findings-summary/**',
      './src/widgets/leaderboard-table/**',
      './src/widgets/score-summary/**',
      './src/widgets/taxonomy-tree/**',
      './src/widgets/team-header/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
