import StatCard from '../ui/StatCard'

type BarItem = { label: string; value: number; max?: number }

export function KpiGrid({ items }: { items: { label: string; value: string | number; hint?: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
      {items.map((item) => (
        <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
      ))}
    </div>
  )
}

export function BarChart({ title, items, valueSuffix = '' }: { title: string; items: BarItem[]; valueSuffix?: string }) {
  const max = Math.max(...items.map((i) => i.max ?? i.value), 1)
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No data yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium truncate pr-2">{item.label}</span>
                <span className="text-gray-600 shrink-0">{item.value}{valueSuffix}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${((item.max ?? item.value) / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ForecastPanel({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-dashed border-blue-200 bg-blue-50 p-4 text-center">
            <p className="text-xs text-blue-600 uppercase tracking-wide">{item.label}</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{item.value.toLocaleString()}</p>
            <div className="mt-2 h-1.5 bg-blue-100 rounded-full">
              <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3">Linear trend projection based on recent history.</p>
    </div>
  )
}

export function GradeDistribution({ grades }: { grades: Record<string, number> }) {
  const entries = Object.entries(grades)
  const max = Math.max(...entries.map(([, c]) => c), 1)
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Results Distribution</h2>
      <div className="space-y-3">
        {entries.map(([grade, count]) => (
          <div key={grade} className="flex items-center">
            <span className="w-12 font-semibold text-center">{grade}</span>
            <div className="flex-1 bg-gray-200 rounded-full h-8 ml-4">
              <div
                className="bg-blue-600 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${(count / max) * 100}%`, minWidth: count > 0 ? '2rem' : 0 }}
              >
                {count > 0 && count}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
