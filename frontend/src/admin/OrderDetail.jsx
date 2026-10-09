import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { Spinner, Alert } from '../components/ui';
import { formatDateTime, formatCurrency, StatusBadge } from '../utils/format';

export default function OrderDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const load = () =>
    api
      .get(`/admin/orders/${id}`)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load order'));

  useEffect(() => {
    load();
  }, [id]);

  async function handleAction(action) {
    const labels = { cancel: 'Cancel this order', refund: 'Mark as refunded' };
    if (!confirm(`${labels[action]}? Tickets will be invalidated and inventory released.`)) return;
    setActionLoading(action);
    try {
      await api.patch(`/admin/orders/${id}/${action}`);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading('');
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const { order, tickets } = data;
  const active = order.status === 'paid' || order.status === 'pending';

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to="/admin/orders" className="text-sm font-medium text-slate-500 hover:text-emerald-700">
        ← All orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-extrabold text-slate-900">{order.booking_ref}</h1>
          <p className="text-sm text-slate-500">Placed {formatDateTime(order.created_at)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Info grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Customer</h3>
          <p className="font-semibold text-slate-900">{order.customer_name}</p>
          <p className="text-sm text-slate-500">{order.email}</p>
          {order.phone && <p className="text-sm text-slate-500">{order.phone}</p>}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Event</h3>
          <p className="font-semibold text-slate-900">{order.event_title}</p>
          <p className="text-sm text-slate-500">📅 {formatDateTime(order.event_start)}</p>
          <p className="text-sm text-slate-500">📍 {order.venue}, {order.city}</p>
        </div>
      </div>

      {/* Tickets */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="font-bold text-slate-900">Tickets ({tickets.length})</h3>
          <p className="text-lg font-extrabold text-emerald-700">{formatCurrency(order.total_amount)}</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Ticket code</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Price</th>
              <th className="px-5 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <tr key={t.id}>
                <td className="px-5 py-3 font-mono text-xs font-bold text-slate-700">{t.ticket_code}</td>
                <td className="px-3 py-3 text-slate-600">{t.type_name}</td>
                <td className="px-3 py-3">{formatCurrency(t.price)}</td>
                <td className="px-5 py-3 text-right">
                  <StatusBadge status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {active && (
        <div className="flex justify-end gap-3">
          <button
            onClick={() => handleAction('cancel')}
            disabled={actionLoading !== ''}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-rose-600 ring-1 ring-rose-300 hover:bg-rose-50 disabled:opacity-50"
          >
            {actionLoading === 'cancel' ? 'Cancelling…' : 'Cancel order'}
          </button>
          <button
            onClick={() => handleAction('refund')}
            disabled={actionLoading !== ''}
            className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {actionLoading === 'refund' ? 'Refunding…' : 'Refund order'}
          </button>
        </div>
      )}
    </div>
  );
}
