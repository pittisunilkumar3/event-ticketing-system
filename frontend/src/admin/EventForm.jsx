import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { Spinner, Alert } from '../components/ui';

const CATEGORIES = ['Music', 'Conference', 'Sports', 'Comedy', 'Food', 'Theatre', 'Art', 'Other'];

const empty = {
  title: '',
  description: '',
  category: 'Music',
  venue: '',
  city: '',
  start_datetime: '',
  end_datetime: '',
  status: 'draft',
};

function toInput(dt) {
    // "2026-11-08 18:00:00" → datetime-local format
    return dt ? String(dt).replace(' ', 'T').slice(0, 16) : '';
  }

export default function EventForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [banner, setBanner] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/admin/events/${id}`)
      .then(({ data }) => {
        const e = data.data.event;
        setForm({
          title: e.title,
          description: e.description || '',
          category: e.category || 'Music',
          venue: e.venue || '',
          city: e.city || '',
          start_datetime: toInput(e.start_datetime),
          end_datetime: toInput(e.end_datetime),
          status: e.status,
        });
        if (e.banner_image) setBannerPreview(e.banner_image);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load event'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);


  function setField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleBanner(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBanner(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.start_datetime) {
      setError('Title and start date/time are required.');
      return;
    }
    if (form.end_datetime && form.end_datetime <= form.start_datetime) {
      setError('End time must be after the start time.');
      return;
    }
    setSaving(true);

    const payload = new FormData();
    Object.entries(form).forEach(([k, v]) => payload.append(k, v));
    if (banner) payload.append('banner', banner);

    try {
      if (isEdit) {
        await api.put(`/admin/events/${id}`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
        navigate(`/admin/events/${id}`);
      } else {
        const { data } = await api.post('/admin/events', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
        navigate(`/admin/events/${data.data.event.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={isEdit ? `/admin/events/${id}` : '/admin/events'} className="text-sm font-medium text-slate-500 hover:text-orange-700">
        ← Back
      </Link>
      <h1 className="text-2xl font-extrabold text-slate-900">{isEdit ? 'Edit Event' : 'Create Event'}</h1>
      {!isEdit && <p className="text-sm text-slate-500">Step 1 of 2 · Set up your event. Next, add ticket types, prices, capacity and a ticket design.</p>}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {error && <Alert>{error}</Alert>}

        {/* Banner */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Banner image</label>
          {bannerPreview ? (
            <div className="relative overflow-hidden rounded-xl">
              <img src={bannerPreview} alt="banner preview" className="h-44 w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setBanner(null);
                  setBannerPreview('');
                }}
                className="absolute right-2 top-2 rounded-lg bg-white/90 px-2.5 py-1 text-xs font-bold text-rose-600"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-orange-400 hover:text-orange-500">
              <span className="text-2xl">🖼️</span>
              <span className="mt-1 text-sm">Click to upload (jpg/png/webp, max 5MB)</span>
              <input type="file" accept="image/*" onChange={handleBanner} className="hidden" />
            </label>
          )}
          {bannerPreview && (
            <label className="mt-2 block text-center text-xs font-semibold text-orange-700 hover:underline">
              <input type="file" accept="image/*" onChange={handleBanner} className="hidden" />
              Replace image
            </label>
          )}
        </div>

        <Field label="Event title" required>
          <input name="title" value={form.title} onChange={setField} required className={inputCls} placeholder="Summer Music Festival" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select name="category" value={form.category} onChange={setField} className={inputCls}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" value={form.status} onChange={setField} className={inputCls}>
              <option value="draft">Draft (hidden from customers)</option>
              <option value="published">Published (bookable)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Venue">
            <input name="venue" value={form.venue} onChange={setField} className={inputCls} placeholder="Central Park Grounds" />
          </Field>
          <Field label="City">
            <input name="city" value={form.city} onChange={setField} className={inputCls} placeholder="New York" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" required>
            <input type="datetime-local" name="start_datetime" value={form.start_datetime} onChange={setField} required className={inputCls} />
          </Field>
          <Field label="Ends (optional)">
            <input type="datetime-local" name="end_datetime" value={form.end_datetime} onChange={setField} className={inputCls} />
          </Field>
        </div>

        <Field label="Description">
          <textarea name="description" value={form.description} onChange={setField} rows={4} className={inputCls} placeholder="Tell customers what to expect…" />
        </Field>

        <div className="flex gap-3 border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-orange-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100';

function Field({ label, required, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
