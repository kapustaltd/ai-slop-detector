import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="dashboard-page">
      <section className="dashboard-panel dashboard-not-found-panel">
        <p className="dashboard-kicker">404 · НЕ НАЙДЕНО</p>
        <h1 className="dashboard-page-title">Страница не найдена</h1>
        <p className="dashboard-page-subtitle">
          Такой маршрут отсутствует в текущей версии контрольной панели.
        </p>
        <Link className="dashboard-action-button mt-6" to="/">
          Вернуться к рейтингу
        </Link>
      </section>
    </main>
  )
}
