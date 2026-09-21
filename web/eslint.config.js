import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/** Слои FSD от нижнего к верхнему. Импорт разрешён только вниз (спека 008, FR-015). */
const LAYERS = ['shared', 'entities', 'features', 'widgets', 'pages', 'app']

const allowedFrom = (layer) => LAYERS.slice(0, LAYERS.indexOf(layer))

export default tseslint.config(
  { ignores: ['dist', 'src/shared/ui/**', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
      boundaries,
    },
    settings: {
      // Без резолвера алиас '@/...' считается внешним пакетом и границы не проверяются.
      'import/resolver': {
        typescript: { project: './tsconfig.app.json' },
      },
      'boundaries/elements': LAYERS.map((layer) => ({
        type: layer,
        pattern: `src/${layer}/*`,
      })),
      'boundaries/include': ['src/**/*'],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message: 'FSD: импорт разрешён только вниз по слоям ({{from.type}} → {{to.type}})',
          policies: LAYERS.filter((layer) => allowedFrom(layer).length > 0).map((layer) => ({
            from: [{ element: { type: layer } }],
            allow: allowedFrom(layer).map((allowed) => ({
              to: { element: { type: allowed } },
            })),
          })),
        },
      ],
    },
  },
  prettier,
)
