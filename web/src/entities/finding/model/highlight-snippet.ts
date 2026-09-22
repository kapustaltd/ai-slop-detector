import { useEffect, useState } from 'react'

import type { FindingView } from '@/shared/api'

/**
 * Подсветка сниппета в рантайме на Shiki (design-deviations.md, пункт 1: подсветка не запекается
 * в бандл на этапе сборки). Перенесено почти дословно из прежней реализации `pages/team/ui/
 * team-page.tsx` — поведение не меняется: ленивая загрузка только нужного языка, тема из
 * `document.documentElement`, неизвестный/недоступный язык — молчаливый fallback на обычный текст.
 */

export type HighlightToken = { content: string; color?: string }

const languageLoaders = {
  css: () => import('shiki/langs/css.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
} as const

type SupportedLanguage = keyof typeof languageLoaders

const highlighterFactoryPromise = import('shiki/core').then(({ createBundledHighlighter }) =>
  createBundledHighlighter({
    langs: languageLoaders,
    themes: {
      'github-dark': () => import('shiki/themes/github-dark.mjs'),
      'github-light': () => import('shiki/themes/github-light.mjs'),
    },
    engine: () =>
      import('shiki/engine/javascript').then(({ createJavaScriptRegexEngine }) =>
        createJavaScriptRegexEngine(),
      ),
  }),
)

const languageByExtension: Record<string, SupportedLanguage> = {
  css: 'css',
  go: 'go',
  html: 'html',
  java: 'java',
  js: 'javascript',
  jsx: 'jsx',
  json: 'json',
  kt: 'kotlin',
  md: 'markdown',
  php: 'php',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'shellscript',
  ts: 'typescript',
  tsx: 'tsx',
  yaml: 'yaml',
  yml: 'yaml',
}

function snippetLanguage(file: string): SupportedLanguage | undefined {
  const extension = file.split('.').pop()?.toLowerCase()
  return extension ? languageByExtension[extension] : undefined
}

export function useHighlightedSnippet(finding: FindingView): HighlightToken[][] | null {
  const snippet = finding.snippet
  const language = snippetLanguage(finding.file)
  const snippetKey = `${finding.file}:${snippet ?? ''}`
  const [highlighted, setHighlighted] = useState<{ key: string; lines: HighlightToken[][] } | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    if (!language || !snippet) return () => undefined

    const theme = document.documentElement.classList.contains('dark')
      ? 'github-dark'
      : 'github-light'
    void highlighterFactoryPromise
      .then((createHighlighter) => createHighlighter({ langs: [language], themes: [theme] }))
      .then((highlighter) => highlighter.codeToTokens(snippet, { lang: language, theme }))
      .then(({ tokens }) => {
        if (!cancelled) setHighlighted({ key: snippetKey, lines: tokens })
      })
      .catch(() => {
        // Unknown or unavailable grammars intentionally fall back to plain text.
      })

    return () => {
      cancelled = true
    }
  }, [finding.file, language, snippet, snippetKey])

  return highlighted?.key === snippetKey ? highlighted.lines : null
}
