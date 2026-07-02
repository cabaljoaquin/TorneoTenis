// Bloques de esqueleto compartidos.
// Convención de carga: primera carga = skeleton; refetch = shimmer; acciones = spinner en el botón.

export function Sk({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden style={style} className={`animate-pulse rounded bg-slate-700/40 ${className}`} />
}

export function SkeletonChips() {
  return (
    <div className="flex flex-wrap gap-2">
      {[80, 110, 70, 95].map(w => (
        <Sk key={w} style={{ width: w }} className="h-7 rounded-full" />
      ))}
    </div>
  )
}

export function SkeletonMatchCard() {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-900/30 border-b border-surface-border/40">
        <Sk className="h-3 w-40" />
      </div>
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1 space-y-2">
          <Sk className="h-9 w-full rounded-lg" />
          <Sk className="h-9 w-full rounded-lg" />
        </div>
        <div className="flex items-center gap-2 self-center md:self-end">
          <Sk className="h-10 w-32 rounded-lg" />
          <Sk className="h-10 w-24 rounded-lg" />
          <Sk className="h-10 w-10 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonPlayerCard() {
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg p-3.5 flex items-center gap-4">
      <Sk className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Sk className="h-3.5 w-2/3" />
        <Sk className="h-3 w-1/3" />
      </div>
    </div>
  )
}

export function SkeletonZoneCard() {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border/50 bg-surface/30">
        <Sk className="h-4 w-24" />
      </div>
      <div className="p-4 space-y-2">
        <Sk className="h-8 w-full" />
        <Sk className="h-8 w-full" />
        <Sk className="h-8 w-3/4" />
      </div>
    </div>
  )
}

export function SkeletonPanel({ lines = 4 }: { lines?: number }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-3">
      <Sk className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Sk key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  )
}
