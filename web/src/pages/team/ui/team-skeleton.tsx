import { Skeleton } from '@/shared/ui'

export function TeamSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Загрузка команды"
      className="mx-auto max-w-[1600px] space-y-[18px] p-4 sm:p-6"
    >
      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex w-full flex-col gap-[18px]">
          <div className="flex items-center gap-2 pb-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-52 max-w-[55vw]" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-[14px] w-40" />
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
      </div>

      <section aria-hidden="true" className="flex flex-wrap items-stretch gap-4">
        <div className="flex w-full flex-col gap-3 rounded-card border border-line bg-surface px-6 py-5 sm:w-[340px] sm:shrink-0">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="mt-0.5 pt-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-3/4" />
          </div>
        </div>
        <div className="flex min-w-[240px] flex-grow flex-col gap-3 rounded-card border border-line bg-surface px-6 py-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </section>

      <section aria-hidden="true" className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-card border border-line bg-surface p-4">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-4 rounded-card border border-line bg-surface p-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </section>
    </main>
  )
}
