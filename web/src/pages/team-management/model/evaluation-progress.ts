import type { RegistryEvaluationStage } from '@/shared/api'

export const evaluationStages: {
  stage: RegistryEvaluationStage
  label: string
  description: string
}[] = [
  {
    stage: 'waiting',
    label: 'Ожидание в очереди',
    description: 'Команда поставлена в очередь на оценку.',
  },
  {
    stage: 'dispatching',
    label: 'Передача задания',
    description: 'Сервер отправляет репозиторий сервису оценки.',
  },
  {
    stage: 'runner_queued',
    label: 'Ожидание запуска',
    description: 'Сервис принял задание и ждёт свободного исполнителя.',
  },
  {
    stage: 'analyzing',
    label: 'Анализ репозитория',
    description: 'Сервис оценки выполняет проверку кода.',
  },
  {
    stage: 'publishing',
    label: 'Публикация отчёта',
    description: 'Оценка завершена, сервер обновляет результаты.',
  },
]

interface EvaluationNarrative {
  checking: string
  reason: string
  next: string
}

const stageNarrative: Record<RegistryEvaluationStage, EvaluationNarrative> = {
  waiting: {
    checking: 'Задание ожидает своей очереди.',
    reason: 'Сервис выполняет оценки последовательно.',
    next: 'Передам репозиторий исполнителю.',
  },
  dispatching: {
    checking: 'Передаю ссылку на репозиторий и выбранную ветку.',
    reason: 'Исполнителю нужны исходные данные, чтобы запустить проверку.',
    next: 'Дождусь подтверждения и запуска задания.',
  },
  runner_queued: {
    checking: 'Задание принято и ждёт свободного исполнителя.',
    reason: 'Проверка начнётся, когда исполнитель освободится.',
    next: 'После запуска начнётся анализ кода.',
  },
  analyzing: {
    checking: 'Сервис оценивает код репозитория по рубрикам.',
    reason: 'Это нужно, чтобы подготовить оценки и замечания по проекту.',
    next: 'После проверки сервер опубликует готовые результаты.',
  },
  publishing: {
    checking: 'Сервер обновляет доступный отчёт.',
    reason: 'Результаты нужно сохранить, прежде чем открыть страницу команды.',
    next: 'Проверю, что отчёт опубликован.',
  },
  done: {
    checking: 'Проверка завершена.',
    reason: 'Отчёт опубликован и доступен на странице команды.',
    next: 'Можно открыть готовый отчёт.',
  },
}

export function getEvaluationNarrative(stage: RegistryEvaluationStage): EvaluationNarrative {
  return stageNarrative[stage] ?? stageNarrative.waiting
}
