import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Spinner, EmptyState, Alert } from '../components/ui';
import { formatDateTime, formatCurrency, StatusBadge, categoryGradient } from '../utils/format';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/events', {
        params: { search: search || undefined, status: status || undefined, limit: 20, page: pagination.page },
      });
      setEvents(data.data.events);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [search, status, pagination.page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load]);

  async function handleDelete(event) {
    if (!confirm(`Delete "${event.title}"? This also deletes its ticket types.`)) return;
    setDeleting(event.id);
    try {
      await api.delete(`/admin/events/${event.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900">Events</h1>
        <Link
          to="/admin/events/new"
          className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-orange-700"
        >
          + New Event
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          placeholder="🔍 Search events…"
          className="w-64 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
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
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="self-center text-sm text-slate-400">{pagination.total} event(s)</span>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <Spinner />
      ) : events.length === 0 ? (
        <EmptyState title="No events found" subtitle="Create your first event to start selling tickets.">
          <Link to="/admin/events/new" className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white">
            + Create event
          </Link>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Event</th>
                <th className="px-3 py-3">When</th>
                <th className="px-3 py-3">Types</th>
                <th className="px-3 py-3">Revenue</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br ${categoryGradient(event.category)}`}>
                        {event.banner_image && <img src={event.banner_image} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <Link to={`/admin/events/${event.id}`} className="font-semibold text-slate-800 hover:text-orange-700">
                          {event.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {event.category} · 📍 {event.city}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">{formatDateTime(event.start_datetime)}</td>
                  <td className="px-3 py-3 text-slate-600">{event.ticket_type_count}</td>
                  <td className="px-3 py-3 font-semibold text-orange-700">{formatCurrency(event.revenue)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={event.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2 text-xs font-semibold">
                      <Link to={`/admin/events/${event.id}`} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600 hover:bg-slate-200">
                        View
                      </Link>
                      <Link to={`/admin/events/${event.id}/edit`} className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-orange-700 hover:bg-orange-100">
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(event)}
                        disabled={deleting === event.id}
                        className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                      >
                        {deleting === event.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
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
