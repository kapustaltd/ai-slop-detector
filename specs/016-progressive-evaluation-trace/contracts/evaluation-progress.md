# Evaluation progress contract

`GET /api/evaluation/progress/{team_id}` remains the live source of truth and stays `no-store`.
The response adds structured progress fields while retaining existing `status`, `stage`, and
`started_at` for older clients.

```json
{
  "status": "running",
  "stage": "analyzing",
  "started_at": "2026-09-24T12:00:00Z",
  "areas": [
    {
      "area": "backend",
      "status": "running",
      "included_files": 46,
      "excluded_files": 8,
      "completed_categories": 0,
      "total_categories": 8
    },
    {
      "area": "frontend",
      "status": "queued",
      "included_files": 0,
      "excluded_files": 0,
      "completed_categories": 0,
      "total_categories": 7
    }
  ],
  "events": [
    {
      "sequence": 4,
      "at": "2026-09-24T12:00:08Z",
      "kind": "scan",
      "title": "Структура репозитория проверена",
      "detail": "Для анализа включено 46 файлов.",
      "area": "backend"
    },
    {
      "sequence": 8,
      "at": "2026-09-24T12:02:10Z",
      "kind": "finding",
      "title": "Найдено место обработки повторных попыток",
      "detail": "Вывод привязан к строкам 18–31 и проверен на текущем commit.",
      "area": "backend",
      "source": {
        "file": "agent/main.go",
        "line_start": 18,
        "line_end": 31,
        "permalink": "https://github.com/example/repo/blob/abc/agent/main.go#L18-L31"
      }
    }
  ]
}
```

The exact property names and required fields are defined by `schemas/evaluation-progress.schema.json`.
The JSON Schema MUST be separate from `evaluation-report.schema.json`; only the latter represents
the report exchanged with review skills.

## Compatibility and safety

- Existing clients may ignore `areas`, `scan`, and `events`.
- The API response and pipeline snapshot use the same progress shape.
- Only the latest 20 events are returned. Sequence values remain increasing if older entries are
  removed from the bounded list.
- `source` may only reference a finding whose source link was verified against the evaluated commit.
- Area entries are an array with at most one item for each of backend/frontend. Category totals come from the loaded rubric;
  `completed_categories` is zero until the whole area report has been published.
- Event text comes from static pipeline templates or already validated/normalized report findings.
- Prompts, raw model output, file contents, secret values and arbitrary runner logs are forbidden.
- If no progress snapshot exists (older runner output), the API returns the current coarse status and
  empty event and area collections.
