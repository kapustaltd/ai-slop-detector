import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <Link
        className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4 md:min-h-10"
        to="/"
      >
        К рейтингу
      </Link>
    </main>
  )
}
