# AI Elements

Components from https://github.com/vercel/ai-elements (Apache-2.0), installed from
https://elements.ai-sdk.dev/api/registry/{reasoning,sources,tool,context,message}.json.
Discovered through https://shoogle.dev/search?tab=explore&kw=reasoning.

Local adaptations: FSD paths, existing `cn` utility package, Russian tool statuses,
AI SDK 7 usage fields, keyed asynchronous syntax highlighting, unknown context
limit support, and Sources disclosure props. Loader uses the application's
Lucide spinner (the current AI Elements registry no longer has `loader.json`).

Only public activity summaries belong in Reasoning. Never render provider
thinking/redacted_thinking blocks or raw tool results here. Report Response
entries come from the validated evaluation contract.
