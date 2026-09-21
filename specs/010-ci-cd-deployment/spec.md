# Feature Specification: CI/CD для публикации фронтенда

**Feature Branch**: `010-ci-cd-deployment`

**Created**: 2026-09-22

**Status**: Implemented; pending production secrets and one-time web-server setup

**Input**: User description: "Реализовать CI/CD через GitHub runner, который автоматически деплоит изменения по SSH на `root@13.143.132.116`."

## Overview

Добавить воспроизводимый pipeline для статического приложения `web`: каждый push в `main`,
прошедший проверки, должен автоматически публиковать production-сборку на выделенном сервере по
SSH. Деплой не должен зависеть от ручного копирования файлов, не должен передавать секреты через
репозиторий и не должен оставлять сайт в частично обновлённом состоянии.

## Clarifications

### Session 2026-09-22

- Q: Что означает «GitHub runner»? → A: GitHub-hosted runner `ubuntu-latest`, который подключается
  к целевому серверу по SSH. Установка self-hosted runner на production-сервер не входит в эту
  фичу.
- Q: Что именно публикуется? → A: Статический артефакт `web/dist`, полученный командой
  `npm run build` после полного `npm run check`.
- Q: Когда выполняется production-деплой? → A: Автоматически после успешного pipeline на push в
  `main`; pull request запускает только проверки и сборку без доступа к production-секретам.
- Q: Как избежать простоя при обновлении? → A: Каждый релиз распаковывается в отдельный каталог,
  а web-root переключается атомарной заменой симлинка `current`. Симлинк `previous` хранит
  предыдущий релиз.
- Q: Где хранятся SSH-реквизиты? → A: В GitHub Environment `production`: secrets
  `DEPLOY_SSH_KEY` и `DEPLOY_KNOWN_HOSTS`. Приватный ключ и значения секретов не находятся в
  репозитории и не печатаются в лог.
- Q: Нужна ли автоматическая настройка сервера? → A: Нет. Pipeline создаёт каталог релизов и
  симлинки, но не меняет конфигурацию ОС, Nginx/Caddy, DNS или TLS. Web-сервер должен один раз
  смотреть в `/var/www/ai-slop-detector/current`.
- Q: Какой пользователь используется? → A: На первом этапе ровно указанный пользователем `root`.
  Переход на отдельного ограниченного deploy-пользователя — отдельная задача hardening.

## User Scenarios & Testing

### User Story 1 — Изменение проходит quality gate до production (Priority: P1)

Разработчик открывает pull request или отправляет commit в `main`. Pipeline устанавливает
зависимости из lock-файла и запускает `npm run check` и production-сборку.

**Independent Test**: намеренно сломать тип или тест и убедиться, что job завершается с ошибкой и
job деплоя не запускается.

**Acceptance Scenarios**:

1. **Given** pull request с корректным кодом, **When** запускается workflow, **Then** проходят
   формат, lint, FSD-проверка, typecheck и тесты, после чего создаётся артефакт `web/dist`.
2. **Given** pull request с ошибкой в проверках, **When** workflow завершается, **Then** ни один
   production-secret не используется и job деплоя отсутствует или пропущен.
3. **Given** push в ветку, отличную от `main`, **When** workflow запускается, **Then** выполняются
   проверки без production-деплоя.

### User Story 2 — Успешный commit публикуется автоматически (Priority: P1)

После успешного pipeline для `main` оператору не нужно вручную копировать файлы: новый статический
релиз появляется на сервере по SSH.

**Independent Test**: выполнить push в `main` на тестовом commit и проверить на сервере наличие
каталога релиза с SHA commit и файла `index.html` в `current`.

**Acceptance Scenarios**:

1. **Given** успешные проверки и настроенные production secrets, **When** job deploy запускается,
   **Then** runner подключается только к хосту, совпадающему с `DEPLOY_KNOWN_HOSTS`, и передаёт
   только собранный статический артефакт.
2. **Given** новый артефакт полностью передан и распакован, **When** выполняется переключение,
   **Then** `current` атомарно указывает на новый релиз и содержит `index.html`.
3. **Given** повторный запуск deploy для того же commit, **When** pipeline выполняется повторно,
   **Then** результат идемпотентен и рабочий сайт не повреждается.
4. **Given** отсутствующий SSH key, host key или недоступный сервер, **When** deploy запускается,
   **Then** job завершается до изменения `current` с понятной ошибкой.

### User Story 3 — Оператор может быстро откатить последний релиз (Priority: P2)

Если после публикации обнаружена проблема, оператор выполняет документированную rollback-команду
и возвращает предыдущую версию без повторной сборки.

**Independent Test**: после двух успешных релизов выполнить rollback и проверить, что `current`
снова указывает на первый релиз, а второй остаётся доступен в каталоге releases.

**Acceptance Scenarios**:

1. **Given** существуют симлинки `current` и `previous`, **When** запускается rollback, **Then**
   они меняются местами атомарно.
2. **Given** предыдущего релиза нет, **When** запускается rollback, **Then** команда завершается
   без изменения `current`.
3. **Given** pipeline завершился ошибкой до переключения симлинка, **When** оператор проверяет
   сервер, **Then** прежний `current` остаётся рабочим.

## Requirements

### Functional Requirements

- **FR-001**: Репозиторий MUST содержать GitHub Actions workflow для проверки pull request и
  push-событий.
- **FR-002**: Workflow MUST использовать `npm ci` из каталога `web` и MUST запускать `npm run check`
  перед `npm run build`.
- **FR-003**: Workflow MUST запускать production deploy только для `main` и только после успешного
  quality gate.
- **FR-004**: Workflow MUST передавать в deploy только собранный `web/dist`, а не исходный
  репозиторий или `node_modules`.
- **FR-005**: Workflow MUST использовать GitHub Environment `production` для production secrets и
  MUST запрашивать только `contents: read` permissions.
- **FR-006**: SSH MUST использовать приватный ключ из `DEPLOY_SSH_KEY`, строгую проверку
  `DEPLOY_KNOWN_HOSTS` и `IdentitiesOnly=yes`; динамический `ssh-keyscan` в pipeline MUST NOT
  использоваться.
- **FR-007**: Целевой host MUST быть `13.143.132.116`, а пользователь по умолчанию MUST быть
  `root`; путь публикации MUST быть `/var/www/ai-slop-detector`.
- **FR-008**: Deploy MUST распаковывать каждый commit в отдельный каталог
  `/var/www/ai-slop-detector/releases/<commit-sha>` и MUST проверять наличие непустого
  `index.html` до переключения.
- **FR-009**: Переключение production-версии MUST выполняться атомарной заменой симлинка `current`;
  предыдущий target MUST сохраняться в `previous`.
- **FR-010**: Deploy MUST быть идемпотентным для повторной публикации одного SHA и MUST удалять
  временный tar-архив после выполнения.
- **FR-011**: Workflow MUST поддерживать необязательный HTTP smoke check через переменную
  `DEPLOY_HEALTHCHECK_URL`; при отсутствии переменной deploy MUST ограничиваться удалённой
  проверкой файлового артефакта.
- **FR-012**: Репозиторий MUST содержать rollback-скрипт, который без сборки атомарно меняет местами
  `current` и `previous` и не меняет состояние, если `previous` отсутствует.
- **FR-013**: Репозиторий MUST содержать инструкцию одноразовой настройки web-сервера с root
  `/var/www/ai-slop-detector/current`; workflow MUST NOT автоматически менять Nginx/Caddy, DNS или
  TLS.
- **FR-014**: Workflow и скрипты MUST NOT выводить приватный ключ, secrets или содержимое
  `DEPLOY_KNOWN_HOSTS` в логи.
- **FR-015**: Deploy MUST ограничивать число хранимых релизов настраиваемым значением и сохранять
  минимум текущий и предыдущий релизы.

## Non-goals for this slice

- Установка и регистрация self-hosted GitHub runner на production-сервере.
- Автоматическая установка Ubuntu, SSH, Nginx/Caddy, DNS, TLS и firewall.
- Деплой backend, базы данных, Docker-образов или миграций.
- Переход с `root` на отдельного deploy-пользователя.
- Автоматическое решение о rollback по метрикам; health check только останавливает невалидный
  релиз до переключения.

## Assumptions and Dependencies

- На сервере Ubuntu доступны `bash`, `tar`, `readlink`, `ln`, GNU `mv` с поддержкой `-T`, `ls`,
  `tail` и файловая система с правом записи для root.
- Nginx/Caddy или другой static web-server настраивается отдельно и читает каталог `current`.
- В GitHub создан Environment с именем `production`, а secrets добавлены владельцем репозитория.
- Значение `DEPLOY_KNOWN_HOSTS` содержит заранее проверенную строку host key для
  `13.143.132.116`, например ED25519 fingerprint, полученный доверенным способом.

## Acceptance Criteria

- `bash -n deploy/deploy-static.sh deploy/rollback-static.sh` проходит.
- `bash deploy/test-static-deployment.sh` проходит для двух релизов, повторного deploy и rollback.
- `npm run check` и `npm run build` проходят в CI до deploy job.
- Для PR production secrets не доступны.
- Для push в `main` deploy использует только strict host-key verification и завершается после
  проверки `current/index.html`.
- После двух deploy `current` и `previous` являются валидными симлинками, а rollback возвращает
  предыдущий release без повторной сборки.
- В git diff отсутствуют private keys, tokens, `.env`-файлы и значения GitHub secrets.
