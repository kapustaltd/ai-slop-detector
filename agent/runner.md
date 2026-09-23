# Runner и ingestion

`cmd/runner` — ручной batch-процесс фичи 003. Он принимает YAML-реестр, фиксирует вершину ветки,
создаёт snapshot через `git archive`, запускает headless provider, валидирует отчёт, вырезает
сниппеты и пишет статический bundle.

```sh
go run ./cmd/runner run \
  --registry ./registry.yaml \
  --rubrics-dir ../rubrics \
  --output ./out \
  --workspace /tmp/ai-slop-workspaces
```

Для повторной оценки можно ограничить `--team` и `--area`. Завершённые области возобновляются из
`out/state`; `--force` пересчитывает выбранную область и заменяет её нормализованный state.

Пересчёт агрегатов выполняется без provider:

```sh
go run ./cmd/runner recalculate --registry ./registry.yaml --rubrics-dir ../rubrics --output ./out
```

В каталоге output находятся `index.json`, `teams/*.json`, `rubrics/*.json`, `stats.json`,
`summary.json` и `state/<team>/<area>.json`. Полные ответы модели не сохраняются.
