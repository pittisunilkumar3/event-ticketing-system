import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { Spinner, Alert } from '../components/ui';
import { formatDateTime, formatCurrency, StatusBadge, categoryGradient } from '../utils/format';

export default function AdminEventDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'add' | 'edit', values }
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/admin/events/${id}`);
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load event');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteType(tt) {
    if (!confirm(`Delete ticket type "${tt.name}"?`)) return;
    setDeleting(tt.id);
    try {
      await api.delete(`/admin/ticket-types/${tt.id}`);
      setModal(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const { event, ticketTypes, ticketStats } = data;
  const totalCapacity = ticketTypes.reduce((s, tt) => s + tt.quantity, 0);
  const totalSold = ticketTypes.reduce((s, tt) => s + tt.sold, 0);
  const fillRate = totalCapacity ? Math.round((totalSold / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-6">
      <Link to="/admin/events" className="text-sm font-medium text-slate-500 hover:text-emerald-700">
        ← All events
      </Link>

      {/* Header card */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className={`h-36 bg-gradient-to-br ${categoryGradient(event.category)} relative`}>
          {event.banner_image && <img src={event.banner_image} alt="" className="h-full w-full object-cover" />}
          <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent p-5">
            <div>
              <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-slate-700">{event.category}</span>
              <h1 className="mt-1 text-2xl font-extrabold text-white">{event.title}</h1>
            </div>
            <StatusBadge status={event.status} />
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-4">
          <Meta label="Starts" value={formatDateTime(event.start_datetime)} />
          <Meta label="Venue" value={`${event.venue}, ${event.city}`} />
          <Meta label="Tickets sold" value={`${totalSold} / ${totalCapacity} (${fillRate}%)`} />
          <div className="flex items-end justify-end gap-2">
            <Link
              to={`/admin/events/${id}/edit`}
              className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
            >
              ✏️ Edit event
            </Link>
          </div>
        </div>
      </div>

      {/* Ticket stats chips */}
      {ticketStats.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {ticketStats.map((s) => (
            <div key={s.status} className="rounded-xl bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-slate-200">
              <span className="mr-2 font-semibold capitalize text-slate-500">{s.status.replace('_', ' ')}:</span>
              <span className="font-extrabold text-slate-900">{s.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Ticket types */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">Ticket types</h2>
          <button
            onClick={() => setModal({ mode: 'add', values: emptyType })}
            className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            + Add type
          </button>
        </div>

        {ticketTypes.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            No ticket types yet — add one to start selling.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Sold / Capacity</th>
                <th className="px-3 py-3">Availability</th>
                <th className="px-3 py-3">Sales window</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ticketTypes.map((tt) => {
                const pct = tt.quantity ? Math.round((tt.sold / tt.quantity) * 100) : 0;
                return (
                  <tr key={tt.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800">{tt.name}</p>
                      {tt.description && <p className="text-xs text-slate-500">{tt.description}</p>}
                    </td>
                    <td className="px-3 py-3 font-bold text-emerald-700">{formatCurrency(tt.price)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">
                          {tt.sold}/{tt.quantity}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {tt.quantity - tt.sold <= 0 ? (
                        <span className="font-semibold text-rose-600">Sold out</span>
                      ) : (
                        <span className="text-slate-600">{tt.quantity - tt.sold} left</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {tt.sales_start ? formatDateTime(tt.sales_start) : '—'}
                      {' → '}
                      {tt.sales_end ? formatDateTime(tt.sales_end) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2 text-xs font-semibold">
                        <button
                          onClick={() => setModal({ mode: 'edit', values: toFormValues(tt) })}
                          className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-700 hover:bg-emerald-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteType(tt)}
                          disabled={deleting === tt.id}
                          className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit modal */}
      {modal && (
        <TypeModal
          eventId={id}
          modal={modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

const emptyType = {
  name: '',
  description: '',
  price: '',
  quantity: '',
  sales_start: '',
  sales_end: '',
};

function toFormValues(tt) {
  const toInput = (dt) => (dt ? String(dt).slice(0, 16) : '');
  return {
    id: tt.id,
    name: tt.name,
    description: tt.description || '',
    price: tt.price,
    quantity: tt.quantity,
    sales_start: toInput(tt.sales_start),
    sales_end: toInput(tt.sales_end),
  };
}

function TypeModal({ eventId, modal, onClose, onSaved }) {
  const isEdit = modal.mode === 'edit';
  const [values, setValues] = useState(modal.values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField(e) {
    setValues({ ...values, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!values.name || values.price === '' || values.quantity === '') {
      setError('Name, price and quantity are required.');
      return;
    }
    setSaving(true);
    const payload = {
      event_id: Number(eventId),
      name: values.name,
      description: values.description || null,
      price: Number(values.price),
      quantity: Number(values.quantity),
      sales_start: values.sales_start || null,
      sales_end: values.sales_end || null,
    };
    try {
      if (isEdit) await api.put(`/admin/ticket-types/${values.id}`, payload);
      else await api.post('/admin/ticket-types', payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h3 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit ticket type' : 'Add ticket type'}</h3>
        {error && <Alert>{error}</Alert>}

        <div>
          <label className={labelCls}>Name *</label>
          <input name="name" value={values.name} onChange={setField} className={inputCls} placeholder="VIP" />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input name="description" value={values.description} onChange={setField} className={inputCls} placeholder="Front stage + lounge access" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Price (USD) *</label>
            <input type="number" step="0.01" min="0" name="price" value={values.price} onChange={setField} className={inputCls} placeholder="49.99" />
          </div>
          <div>
            <label className={labelCls}>Quantity *</label>
            <input type="number" min="1" name="quantity" value={values.quantity} onChange={setField} className={inputCls} placeholder="100" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Sales start</label>
            <input type="datetime-local" name="sales_start" value={values.sales_start} onChange={setField} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sales end</label>
            <input type="datetime-local" name="sales_end" value={values.sales_end} onChange={setField} className={inputCls} />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add type'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';
const labelCls = 'mb-1 block text-sm font-semibold text-slate-700';
