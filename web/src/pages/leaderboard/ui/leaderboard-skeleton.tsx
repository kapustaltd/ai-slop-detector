import { Skeleton } from '@/shared/ui'

export function LeaderboardSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Загрузка рейтинга"
      className="mx-auto max-w-[1600px] space-y-[18px] p-4 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 pr-[52px] md:pr-[46px]"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[17px] w-40" />
          <Skeleton className="h-[13px] w-24" />
        </div>
        <Skeleton className="h-[14px] w-52 max-w-full" />
      </div>

      <div aria-hidden="true" className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-11 w-32 xl:h-10" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-11 w-36 xl:hidden" />
        <Skeleton className="h-11 w-32 xl:hidden" />
        <Skeleton className="ml-auto h-[14px] w-28" />
      </div>

      <div
        aria-hidden="true"
        className="hidden overflow-hidden rounded-card border border-line xl:block"
      >
        <div className="flex h-10 items-center gap-5 bg-muted-surface px-4">
          <Skeleton className="h-3 w-5" />
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex h-[54px] items-center gap-5 border-t border-line px-4">
            <Skeleton className="h-4 w-5" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-2 w-24" />
            <Skeleton className="h-2 w-24" />
            <Skeleton className="h-2 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="flex flex-col gap-2 xl:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-[9px] rounded-card border border-line bg-surface px-[13px] py-3"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-4 w-5" />
              <Skeleton className="h-[17px] flex-grow" />
              <Skeleton className="h-2 w-[72px]" />
            </div>
            <div className="flex items-center gap-3.5">
              <Skeleton className="h-[13px] w-24" />
              <Skeleton className="h-[13px] w-24" />
            </div>
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </main>
  )
}
