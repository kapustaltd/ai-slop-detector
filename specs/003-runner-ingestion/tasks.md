# Tasks: runner и ingestion

- [ ] Добавить модели рубрики, реестра, запуска и статического bundle.
- [ ] Реализовать безопасную фиксацию SHA и создание snapshot без выполнения кода команды.
- [ ] Реализовать provider interface, headless command adapter и сохранение raw попыток.
- [ ] Реализовать структурную валидацию, retry до двух раз и обработку rubric mismatch.
- [ ] Реализовать enrichment находок: проверка файла/строк, clipping сниппета и permalink templates.
- [ ] Реализовать агрегирование уровней таксономии, partial evaluation и ranking.
- [ ] Реализовать CLI `run`/`recalculate`, resume, выборочный запуск, concurrency и output lock.
- [ ] Реализовать запись bundle и статистики, не затирая raw предыдущих запусков.
- [ ] Добавить тесты на happy path, ошибки ссылок, retry, безопасность и детерминированные расчёты.
