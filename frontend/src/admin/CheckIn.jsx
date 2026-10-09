import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/client';
import { Alert } from '../components/ui';
import { formatDateTime, StatusBadge } from '../utils/format';

export default function CheckIn() {
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState(null);
  const [result, setResult] = useState(null); // { type: 'success'|'error'|'warn', message }
  const [loading, setLoading] = useState(false);

  async function lookup(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setTicket(null);
    try {
      const { data } = await api.get(`/admin/tickets/${code.trim().toUpperCase()}`);
      setTicket(data.data.ticket);
    } catch (err) {
      setResult({ type: 'error', message: err.response?.data?.message || 'Ticket not found' });
    } finally {
      setLoading(false);
    }
  }

  async function checkIn() {
    setLoading(true);
    try {
      const { data } = await api.post('/admin/tickets/checkin', { ticket_code: ticket.ticket_code });
      setTicket(data.data.ticket);
      setResult({ type: 'success', message: data.message });
    } catch (err) {
      setResult({ type: 'warn', message: err.response?.data?.message || 'Check-in failed' });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setCode('');
    setTicket(null);
    setResult(null);
  }

  const canCheckIn = ticket && ticket.status === 'valid' && !['cancelled', 'refunded'].includes(ticket.order_status);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Ticket Check-in</h1>
        <p className="mt-1 text-sm text-slate-500">Scan or type the ticket code at the venue entrance.</p>
      </div>

      <form onSubmit={lookup} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ticket code</label>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="TCK-XXXX-XXXX-XXXX"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 font-mono text-sm uppercase tracking-wider focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-5 font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? '…' : 'Lookup'}
          </button>
        </div>
        {ticket && (
          <button type="button" onClick={reset} className="mt-2 text-xs font-semibold text-slate-400 hover:text-indigo-700">
            ✕ Clear
          </button>
        )}
      </form>

      {result && (
        <Alert type={result.type === 'warn' ? 'info' : result.type}>{result.message}</Alert>
      )}

      {ticket && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-4 border-b border-slate-100 p-5">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <QRCodeSVG value={ticket.ticket_code} size={90} fgColor="#1e293b" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold text-slate-800">{ticket.ticket_code}</p>
              <div className="mt-1">
                <StatusBadge status={ticket.status} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Meta label="Event" value={ticket.event_title} />
            <Meta label="When" value={formatDateTime(ticket.event_start)} />
            <Meta label="Attendee" value={`${ticket.customer_name} (${ticket.email})`} />
            <Meta label="Ticket type" value={`${ticket.type_name} — ${ticket.booking_ref}`} />
            <Meta label="Venue" value={`${ticket.venue}, ${ticket.city}`} />
            {ticket.checked_in_at && <Meta label="Checked in at" value={ticket.checked_in_at} />}
          </div>

          {canCheckIn && (
            <div className="border-t border-slate-100 p-5">
              <button
                onClick={checkIn}
                disabled={loading}
                className="w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {loading ? 'Processing…' : '✅ Check in this ticket'}
              </button>
            </div>
          )}
        </div>
      )}
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
