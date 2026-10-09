import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import api from '../api/client';
import { Spinner, Alert } from '../components/ui';
import { formatCurrency, formatDateTime, StatusBadge } from '../utils/format';

const tooltipStyle = {
  backgroundColor: '#0f172a',
  border: 'none',
  borderRadius: 12,
  fontSize: 13,
  color: '#e2e8f0',
  boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner label="Loading dashboard…" />;

  const { kpi, salesTrend, topEvents, recentOrders, upcoming } = data;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">Here's what's happening with your events.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total Revenue" value={formatCurrency(kpi.total_revenue)} icon="💰" accent="from-orange-500 to-amber-500" sub={`${kpi.paid_orders} paid orders`} />
        <Kpi label="Active Events" value={kpi.active_events} icon="🎪" accent="from-orange-500 to-amber-500" sub={`${kpi.draft_events} drafts`} />
        <Kpi label="Tickets Sold" value={kpi.valid_tickets + kpi.checked_in_tickets} icon="🎟️" accent="from-orange-400 to-rose-500" sub={`${kpi.checked_in_tickets} checked in`} />
        <Kpi label="Cancelled / Refunded" value={kpi.cancelled_orders} icon="↩️" accent="from-slate-500 to-slate-700" sub={`${kpi.pending_orders} pending`} />
      </div>

      {/* Charts */}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-slate-900">Sales trend</h3>
              <p className="text-xs text-slate-400">Revenue · last 14 days</p>
            </div>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">📈 Live</span>
          </div>
          {salesTrend.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">No sales in the last 14 days</p>
          ) : (
            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e76529" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#efb773" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(d) => d.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => (name === 'revenue' ? [formatCurrency(v), 'Revenue'] : [v, 'Orders'])} />
                  <Area type="monotone" dataKey="revenue" stroke="#e76529" strokeWidth={2.5} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-slate-900">Revenue by event</h3>
              <p className="text-xs text-slate-400">Top 5 events</p>
            </div>
          </div>
          {topEvents.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">No data yet</p>
          ) : (
            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topEvents} layout="vertical" margin={{ left: 10 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#e76529" />
                      <stop offset="100%" stopColor="#efb773" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="title"
                    width={140}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(t) => (t.length > 18 ? t.slice(0, 17) + '…' : t)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.06)' }} formatter={(v) => [formatCurrency(v), 'Revenue']} />
                  <Bar dataKey="revenue" fill="url(#barGrad)" radius={[0, 8, 8, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Tables */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Recent orders */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h3 className="font-display font-bold text-slate-900">Recent orders</h3>
              <p className="text-xs text-slate-400">Latest bookings</p>
            </div>
            <Link to="/admin/orders" className="text-sm font-semibold text-orange-700 hover:underline">
              View all →
            </Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map((o) => (
                <tr key={o.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <Link to={`/admin/orders/${o.id}`} className="font-mono text-xs font-bold text-orange-700 hover:underline">
                      {o.booking_ref}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">{o.customer_name}</p>
                  </td>
                  <td className="max-w-[150px] truncate px-2 py-3.5 text-slate-600">{o.event_title}</td>
                  <td className="px-2 py-3.5 font-display font-bold text-slate-900">{formatCurrency(o.total_amount)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Upcoming events */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h3 className="font-display font-bold text-slate-900">Upcoming events</h3>
              <p className="text-xs text-slate-400">Next on the calendar</p>
            </div>
            <Link to="/admin/events" className="text-sm font-semibold text-orange-700 hover:underline">
              Manage →
            </Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {upcoming.map((e) => (
                <tr key={e.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <Link to={`/admin/events/${e.id}`} className="font-semibold text-slate-800 transition hover:text-orange-700">
                      {e.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">📍 {e.venue}, {e.city}</p>
                  </td>
                  <td className="px-2 py-3.5 text-xs text-slate-500">{formatDateTime(e.start_datetime)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-orange-500/30">
                      {e.tickets_sold} sold
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, accent, sub }) {
  return (
    <div className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-1.5 font-display text-[26px] font-extrabold leading-tight text-slate-900">{value}</p>
          <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
        </div>
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-xl shadow-lg transition group-hover:scale-110`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
