export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-lg mb-6" />
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="h-12 bg-gray-50 border-b" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 border-b last:border-0 flex items-center px-5 gap-4">
            <div className="w-10 h-10 bg-gray-100 rounded-lg" />
            <div className="flex-1 h-4 bg-gray-100 rounded" />
            <div className="w-24 h-4 bg-gray-100 rounded" />
            <div className="w-16 h-4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-32 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl p-5 border h-24" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-5 border h-28" />
        ))}
      </div>
      <div className="bg-white rounded-xl border h-64" />
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-40 bg-gray-200 rounded-lg" />
      <div className="bg-white rounded-xl border p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-32 bg-gray-100 rounded" />
            <div className="h-10 bg-gray-100 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({ rows = 2, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded-lg" />
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border h-48" />
        ))}
      </div>
    </div>
  );
}
