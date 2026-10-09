import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Spinner, EmptyState, Alert } from '../components/ui';
import { formatDateTime, formatCurrency, StatusBadge } from '../utils/format';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/admin/orders', {
        params: { search: search || undefined, status: status || undefined, limit: 20, page: pagination.page },
      });
      setOrders(data.data.orders);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [search, status, pagination.page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-900">Orders</h1>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          placeholder="🔍 Search ref, name, email…"
          className="w-72 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <span className="self-center text-sm text-slate-400">{pagination.total} order(s)</span>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState icon="📦" title="No orders found" subtitle="Orders will appear here when customers book tickets." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Reference</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Event</th>
                <th className="px-3 py-3">Tickets</th>
                <th className="px-3 py-3">Total</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link to={`/admin/orders/${o.id}`} className="font-mono text-xs font-bold text-emerald-700 hover:underline">
                      {o.booking_ref}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-800">{o.customer_name}</p>
                    <p className="text-xs text-slate-500">{o.email}</p>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-3 text-slate-600">{o.event_title}</td>
                  <td className="px-3 py-3 text-slate-600">{o.ticket_count}</td>
                  <td className="px-3 py-3 font-bold">{formatCurrency(o.total_amount)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDateTime(o.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPagination((prev) => ({ ...prev, page: p }))}
              className={`h-9 w-9 rounded-lg text-sm font-semibold ${
                p === pagination.page ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
