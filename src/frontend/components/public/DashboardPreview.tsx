/** Decorative product UI mockup for marketing hero sections */
export default function DashboardPreview({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="animate-float-slow absolute -right-6 -top-6 z-20 hidden rounded-2xl border border-school-green/30 bg-school-green px-4 py-3 shadow-soft-lg sm:block">
        <p className="text-xs font-semibold text-white/90">Live attendance</p>
        <p className="font-display text-lg font-bold text-white">98.4%</p>
      </div>
      <div className="animate-float-delayed absolute -bottom-4 -left-4 z-20 rounded-2xl border border-school-gold/40 bg-school-gold px-4 py-3 shadow-glow sm:-left-8">
        <p className="text-xs font-bold text-school-navy">Fees collected</p>
        <p className="font-display text-lg font-bold text-school-navy">₦2.4M</p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-royal backdrop-blur-xl dark:bg-school-surface/95">
        <div className="flex items-center gap-2 border-b border-school-border/60 bg-school-bg/80 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 text-xs font-medium text-school-muted">schoolpilot.app/dashboard</span>
        </div>
        <div className="grid gap-0 sm:grid-cols-[140px_1fr]">
          <aside className="hidden border-r border-school-border/60 bg-school-navy p-3 sm:block">
            <div className="mb-4 h-8 rounded-lg bg-school-gold/20" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`mb-2 h-7 rounded-lg ${i === 1 ? 'bg-school-royal/40' : 'bg-white/10'}`}
              />
            ))}
          </aside>
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Students', value: '1,248', color: 'from-blue-500/20 to-blue-600/5' },
                { label: 'Teachers', value: '86', color: 'from-amber-500/20 to-amber-600/5' },
                { label: 'Revenue', value: '₦4.2M', color: 'from-emerald-500/20 to-emerald-600/5' },
                { label: 'Attendance', value: '96%', color: 'from-violet-500/20 to-violet-600/5' },
              ].map((card) => (
                <div
                  key={card.label}
                  className={`rounded-2xl bg-gradient-to-br ${card.color} border border-school-border/50 p-3`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-school-muted">{card.label}</p>
                  <p className="font-display mt-1 text-lg font-bold text-school-navy dark:text-school-text">{card.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-school-border/60 bg-school-bg/50 p-4">
              <p className="text-xs font-semibold text-school-muted">Weekly activity</p>
              <div className="mt-3 flex h-24 items-end justify-between gap-1.5">
                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                  <div
                    key={i}
                    className="w-full rounded-t-md bg-gradient-to-t from-school-royal to-school-royal/40"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
