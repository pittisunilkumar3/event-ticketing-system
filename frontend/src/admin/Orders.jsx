import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { Spinner, Alert } from '../components/ui';
import { formatDateTime, formatCurrency, StatusBadge } from '../utils/format';

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event_id') || '';
  const bookingGroup=params.get('booking_group')==='test'?'test':'real';
  const [separated,setSeparated]=useState(false);
  const [organization,setOrganization]=useState('');
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/admin/orders', {
        signal,
        params: { booking_group:bookingGroup, event_id: eventId || undefined, search: search || undefined, status: status || undefined, limit: 20, page: pagination.page },
      });
      if(signal?.aborted)return;
      setSeparated(data.data.separate_test_bookings);
      setOrganization(data.data.organization_name);
      setOrders(data.data.orders);
      setPagination(data.data.pagination);
    } catch (err) {
      if(signal?.aborted)return;
      setOrders([]);
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      if(!signal?.aborted)setLoading(false);
    }
  }, [search, status, pagination.page, eventId, bookingGroup]);

  useEffect(() => {
    const controller=new AbortController();
    const t = setTimeout(()=>load(controller.signal), search ? 350 : 0);
    return () => {clearTimeout(t);controller.abort();};
  }, [load, search]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-900">Orders</h1>
      {separated&&<p className="text-sm text-slate-500">{organization} · {bookingGroup==='test'?'Test and demo bookings — no real payments collected.':'Real bookings only. Test and demo records are kept separately.'}</p>}
      {eventId && <div className="flex items-center gap-4 text-sm"><Link className="font-semibold text-orange-700" to={`/admin/events/${eventId}`}>← Back to event</Link><span>Showing this event’s bookings</span><button className="underline" onClick={() => { setParams({}); setPagination(p => ({ ...p, page: 1 })); }}>Show all orders</button></div>}

      <div className="flex flex-wrap gap-3">
        {separated&&<select aria-label="Booking type" value={bookingGroup} onChange={e=>{const next=new URLSearchParams(params);if(e.target.value==='test')next.set('booking_group','test');else next.delete('booking_group');setParams(next);setPagination(p=>({...p,page:1}));}} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="real">Real bookings</option><option value="test">Test & demo</option></select>}
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          placeholder="🔍 Search ref, name, email…"
          className="w-72 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
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
      ) : error ? null : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><h2 className="text-lg font-bold text-slate-900">{search||status||eventId?'No matching orders':separated&&bookingGroup==='real'?'No real bookings yet':'No orders found'}</h2><p className="mt-2 text-sm text-slate-500">{separated&&bookingGroup==='test'?'No test or demo bookings match these filters.':'Customer bookings for this organization will appear here.'}</p></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
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
                    <Link to={`/admin/orders/${o.id}`} className="font-mono text-xs font-bold text-orange-700 hover:underline">
                      {o.booking_ref}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-800">{o.customer_name}</p>
                    <p className="text-xs text-slate-500">{o.email}</p>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-3 text-slate-600">{o.event_title}</td>
                  <td className="px-3 py-3 text-slate-600">{o.ticket_count}</td>
                  <td className="px-3 py-3 font-bold">{formatCurrency(o.total_amount,o.currency)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDateTime(o.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <StatusBadge status={o.status} />
                    {separated&&['mock','razorpay_test'].includes(o.payment_method)&&<p className="mt-1 text-xs text-slate-500">{o.payment_method==='mock'?'Demo booking':'Test payment'}</p>}
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
                p === pagination.page ? 'bg-orange-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'
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
