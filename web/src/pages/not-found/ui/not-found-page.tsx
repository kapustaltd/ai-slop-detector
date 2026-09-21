import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <Link className="mt-2 inline-block underline underline-offset-4" to="/">
        К рейтингу
      </Link>
    </main>
  )
}
