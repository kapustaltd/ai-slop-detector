# AI Slop Detector

## Локальный запуск

Нужны Git, Go 1.23+, Node.js 22+ и авторизованный Codex CLI.

### 1. Подготовка

```bash
git clone git@github.com:kapustaltd/ai-slop-detector.git
cd ai-slop-detector
codex login                         # один раз
$EDITOR registry.yaml              # репозитории, ветки и пути команд
mkdir -p bin
(cd agent && go build -o ../bin/ai-slop-runner ./cmd/runner)
```

### 2. Отчёты

```bash
./bin/ai-slop-runner run --output web/data
```

Runner сам клонирует/обновляет команды в `../teams-repos` и пропускает неизменившиеся отчёты.

### 3. Актуализация без Codex

```bash
./bin/ai-slop-runner recalculate --output web/data
```

### 4. Интерфейс

```bash
cd web
npm ci
npm run dev
```

Открыть адрес, напечатанный Vite.
