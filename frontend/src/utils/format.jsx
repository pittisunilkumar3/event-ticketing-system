export function formatDate(datetime) {
  if (!datetime) return '';
  const d = new Date(String(datetime).replace(' ', 'T'));
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(datetime) {
  if (!datetime) return '';
  const d = new Date(String(datetime).replace(' ', 'T'));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(datetime) {
  return `${formatDate(datetime)} · ${formatTime(datetime)}`;
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));
}

/** Gradient per category for event banners without images */
const gradients = [
  'from-indigo-500 via-purple-500 to-pink-500',
  'from-sky-500 via-cyan-500 to-emerald-400',
  'from-orange-400 via-rose-400 to-fuchsia-500',
  'from-emerald-500 via-teal-500 to-cyan-500',
  'from-violet-500 via-indigo-500 to-blue-500',
  'from-amber-400 via-orange-500 to-red-500',
];

export function categoryGradient(name = '') {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return gradients[sum % gradients.length];
}

export const statusStyles = {
  paid: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  cancelled: 'bg-rose-100 text-rose-700 ring-rose-600/20',
  refunded: 'bg-slate-200 text-slate-600 ring-slate-500/20',
  valid: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  checked_in: 'bg-sky-100 text-sky-700 ring-sky-600/20',
  published: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  draft: 'bg-amber-100 text-amber-700 ring-amber-600/20',
};

const darkStyles = {
  paid: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  pending: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
  cancelled: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
  refunded: 'bg-slate-500/15 text-slate-400 ring-slate-400/30',
  valid: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  checked_in: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
  published: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  draft: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
};

export function StatusBadge({ status, dark = false }) {
  const label = String(status || '').replace('_', ' ');
  const cls = (dark ? darkStyles : statusStyles)[status] || (dark ? 'bg-white/10 text-slate-300 ring-white/20' : 'bg-slate-100 text-slate-600 ring-slate-500/20');
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}
