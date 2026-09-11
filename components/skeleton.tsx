export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200 dark:bg-zinc-800 ${className || ''}`}
      {...props}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-10 w-20" />
              </div>
              <Skeleton className="h-12 w-12 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>

      {/* Table Skeleton */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-12 w-32 rounded" />
              <Skeleton className="h-12 flex-1 rounded" />
              <Skeleton className="h-12 w-24 rounded" />
              <Skeleton className="h-12 w-16 rounded" />
              <Skeleton className="h-12 w-16 rounded" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-12 w-32 rounded" />
          <Skeleton className="h-12 flex-1 rounded" />
          <Skeleton className="h-12 w-24 rounded" />
          <Skeleton className="h-12 w-16 rounded" />
          <Skeleton className="h-12 w-16 rounded" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}
