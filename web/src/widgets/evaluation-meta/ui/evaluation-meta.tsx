import { warningIcon, warningLabel } from '@/entities/team'
import type { TeamBundle } from '@/shared/api'

/**
 * Метаданные оценки (FR-017) и предупреждения (FR-018). Ссылки на репозиторий/ветку/коммит из
 * макета не выводятся — `TeamBundle` их не несёт (research.md → «SHA без ссылки на коммит», Q15).
 */

export interface EvaluationMetaProps {
  team: TeamBundle
}

function MetaField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px]">
      <dt className="text-[13.5px] text-fg-muted">{label}</dt>
      <dd className={`m-0 min-w-0 text-[15px] break-all text-fg ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

export function EvaluationMeta({ team }: EvaluationMetaProps) {
  const meta = team.meta
  const warnings = team.warnings ?? []

  return (
    <section
      aria-label="Метаданные оценки"
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
    >
      <dl className="m-0 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetaField label="Коммит" value={team.commit_sha ?? '—'} mono />
        <MetaField label="Рубрика" value={meta?.rubric_version ?? '—'} />
        <MetaField label="Схема" value={meta?.schema_version ?? '—'} />
        <MetaField label="Скилл" value={meta?.skill_version ?? '—'} />
        <MetaField label="Модель" value={meta?.model ?? '—'} />
        <MetaField
          label="Время оценки"
          value={meta?.evaluated_at ? new Date(meta.evaluated_at).toLocaleString('ru-RU') : '—'}
        />
      </dl>

      {warnings.length > 0 ? (
        <div className="flex flex-col gap-2 pt-3.5">
          <span className="text-[15px] font-medium">Предупреждения оценки</span>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {warnings.map((warning) => {
              const Icon = warningIcon(warning)
              return (
                <li
                  key={warning}
                  className="flex items-center gap-2 rounded-badge border border-warn-border bg-warn-bg px-2.5 py-1.5 text-[14.5px] text-warn-fg-body"
                >
                  <Icon
                    aria-hidden="true"
                    size={13}
                    strokeWidth={2.1}
                    className="shrink-0 text-warn-fg"
                  />
                  {warningLabel(warning)}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
