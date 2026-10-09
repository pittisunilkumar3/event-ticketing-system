export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-500">
      <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-slate-800 border-t-indigo-500"></div>
      <p className="mt-4 text-sm font-medium">{label}</p>
    </div>
  );
}

export function EmptyState({ icon = '🎪', title, subtitle, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] py-20 text-center">
      <span className="text-5xl">{icon}</span>
      <h3 className="mt-4 font-display text-lg font-bold text-slate-200">{title}</h3>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-slate-500">{subtitle}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  // Mid-tone colors readable on both dark (customer) and light (admin) backgrounds
  const styles = {
    error: 'bg-red-500/10 text-red-600 ring-red-500/25',
    success: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25',
    info: 'bg-sky-500/10 text-sky-600 ring-sky-500/25',
    warn: 'bg-amber-500/10 text-amber-600 ring-amber-500/25',
  };
  const icons = { error: '⚠️', success: '✅', info: 'ℹ️', warn: '⚠️' };
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ring-1 ${styles[type] || styles.error}`}>
      <span>{icons[type] || icons.error}</span>
      <span>{children}</span>
    </div>
  );
}

/** Decorative blurred gradient orbs for section backgrounds */
export function GlowOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="animate-float absolute -top-32 left-[12%] h-80 w-80 rounded-full bg-indigo-600/25 blur-3xl" />
      <div className="animate-float-slow absolute top-24 right-[8%] h-96 w-96 rounded-full bg-fuchsia-600/15 blur-3xl" />
    </div>
  );
}
