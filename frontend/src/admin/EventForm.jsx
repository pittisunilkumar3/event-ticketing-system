import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';
import './events.css';
const initial = {
  title: '',
  summary: '',
  description: '',
  category: 'Music',
  venue: '',
  city: '',
  address: '',
  start_datetime: '',
  end_datetime: '',
  status: 'draft',
  organizer_name: '',
  organizer_email: '',
  age_policy: '',
  highlights: '',
  entry_instructions: '',
};
export default function EventForm() {
  const { id } = useParams(),
    navigate = useNavigate();
  const [form, setForm] = useState(initial),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [banner, setBanner] = useState(null),
    [preview, setPreview] = useState(''),
    [removeBanner, setRemoveBanner] = useState(false);
  const [subscription,setSubscription]=useState(null),[attempt,setAttempt]=useState(0);
  const [organizationStatus,setOrganizationStatus]=useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);setError('');
    if (!id) {
      api.get('/admin/saas/account',{signal:controller.signal}).then(({data})=>{if(!controller.signal.aborted){setSubscription(data.data.subscription);setOrganizationStatus(data.data.organization.status);}}).catch(e=>{if(!controller.signal.aborted)setError(e.response?.data?.message||'Unable to check your event package.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
      return()=>controller.abort();
    }
    api
      .get('/admin/events/' + id, { signal: controller.signal })
      .then(({ data }) => {
        const e = data.data.event;
        setForm(
          Object.fromEntries(
            Object.keys(initial).map((k) => [
              k,
              k.includes('datetime')
                ? String(e[k] || '')
                    .replace(' ', 'T')
                    .slice(0, 16)
                : (e[k] ?? initial[k]),
            ])
          )
        );
        setPreview(e.banner_image || '');
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.response?.data?.message || 'Unable to load event.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id,attempt]);
  useEffect(
    () => () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    },
    [preview]
  );
  const change = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  function field(
    key,
    label,
    { type = 'text', maxLength = 200, hint, placeholder, ...rest } = {}
  ) {
    return (
      <label className="ea-field">
        {label}
        <input
          name={key}
          type={type}
          value={form[key]}
          onChange={change}
          maxLength={maxLength}
          placeholder={placeholder}
          {...rest}
        />
        {hint && <small>{hint}</small>}
      </label>
    );
  }
  function area(key, label, rows = 4, maxLength = 5000) {
    return (
      <label className="ea-field">
        {label}
        <textarea
          name={key}
          value={form[key]}
          onChange={change}
          rows={rows}
          maxLength={maxLength}
        />
      </label>
    );
  }
  async function save(e) {
    e.preventDefault();
    if(!id&&!subscription?.can_create)return;
    setError('');
    if (form.end_datetime && form.end_datetime <= form.start_datetime) {
      setError('End time must be after start time.');
      return;
    }
    setBusy(true);
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    if (banner) body.append('banner', banner);
    else if (removeBanner) body.append('banner_image', '');
    try {
      const { data } = await api[id ? 'put' : 'post'](
        '/admin/events' + (id ? '/' + id : ''),
        body,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      navigate('/admin/events/' + data.data.event.id);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save event.');
      setBusy(false);
    }
  }
  return (
    <div className="event-admin">
      <Link
        className="ea-back"
        to={id ? '/admin/events/' + id : '/admin/events'}
      >
        ← {id ? 'Back to event' : 'All events'}
      </Link>
      <header className="ea-heading">
        <div>
          <span className="ea-eyebrow">
            EVENT WORKSPACE / {id ? 'EDIT EVENT' : 'CREATE EVENT'}
          </span>
          <h1>
            {id
              ? 'Fine-tune the experience.'
              : 'Something worth showing up for.'}
          </h1>
          <p>
            Start with the details. Add your ticket options on the next screen.
          </p>
        </div>
      </header>
      {error && (
        <div role="alert" className="ea-alert">
          {error}
        </div>
      )}
      {loading ? (
        <p>Loading event…</p>
      ) : !id&&!subscription?.can_create ? (
        <section className="ea-panel" style={{padding:28}}>
          <h2>{error?'Credit check unavailable':organizationStatus==='suspended'?'Account suspended':'No event credits remaining'}</h2>
          <p>{error?'Try checking your credits again.':organizationStatus==='suspended'?'Contact the platform administrator to restore event creation.':'Purchase a package or ask the platform administrator to add credits before creating an event.'}</p>
          {error?<button className="ea-button primary" onClick={()=>setAttempt(n=>n+1)}>Try again</button>:<Link className="ea-button primary" to="/admin/event-packages">View event packages →</Link>}
        </section>
      ) : (
        <form onSubmit={save} className="ea-edit-grid">
          <div className="ea-form-sections">
            <section className="ea-panel">
              <header>
                <h2>01 · The essentials</h2>
              </header>
              <div className="ea-panel-body">
                {field('title', 'Event name', {
                  required: true,
                  placeholder: 'Give your event a memorable name',
                })}
                {field('summary', 'Short introduction', {
                  maxLength: 300,
                  placeholder:
                    'One sentence that makes people want to be there.',
                })}
                {area('description', 'About this event', 6, 60000)}
                <label className="ea-field">
                  Category
                  <select
                    name="category"
                    value={form.category}
                    onChange={change}
                  >
                    {[
                      'Music',
                      'Conference',
                      'Sports',
                      'Comedy',
                      'Food',
                      'Theatre',
                      'Art',
                      'Other',
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            <section className="ea-panel">
              <header>
                <h2>02 · Time & place</h2>
              </header>
              <div className="ea-panel-body">
                <div className="ea-two">
                  {field('start_datetime', 'Starts at', {
                    type: 'datetime-local',
                    required: true,
                  })}
                  {field('end_datetime', 'Ends at', {
                    type: 'datetime-local',
                    hint: 'Optional. Without an end time, booking closes when the event starts.',
                  })}
                </div>
                <div className="ea-two">
                  {field('venue', 'Venue')}
                  {field('city', 'City', { maxLength: 100 })}
                </div>
                {field('address', 'Full venue address', { maxLength: 500 })}
              </div>
            </section>
            <section className="ea-panel">
              <header>
                <h2>03 · The finer details</h2>
              </header>
              <div className="ea-panel-body">
                <div className="ea-two">
                  {field('organizer_name', 'Organizer name', {
                    maxLength: 150,
                  })}
                  {field('organizer_email', 'Organizer contact email', {
                    type: 'email',
                    maxLength: 254,
                  })}
                </div>
                {field('age_policy', 'Age / admission policy', {
                  maxLength: 150,
                  placeholder:
                    'For example: All ages welcome, or 18+ with photo ID',
                })}
                {area('highlights', 'Experience highlights — one per line', 4)}
                {area('entry_instructions', 'Arrival & entry instructions', 4)}
              </div>
            </section>
          </div>
          <aside className="ea-form-aside">
            <section className="ea-panel">
              <header>
                <h2>Event artwork</h2>
              </header>
              <div className="ea-panel-body">
                <label className="ea-banner-upload">
                  {preview ? (
                    <img src={preview} alt="Event banner preview" />
                  ) : (
                    <>
                      <Icon name="plus" size={30} />
                      <strong>Add a cover image</strong>
                      <small>Landscape works best · Up to 5 MB</small>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (!f) return;
                      if (f.size > 5 * 1024 * 1024) {
                        setError('Choose an image smaller than 5 MB.');
                        return;
                      }
                      setBanner(f);
                      setPreview(URL.createObjectURL(f));
                      setRemoveBanner(false);
                    }}
                  />
                </label>
                {preview && (
                  <button
                    type="button"
                    className="ea-text"
                    onClick={() => {
                      setBanner(null);
                      setPreview('');
                      setRemoveBanner(true);
                    }}
                  >
                    Remove cover
                  </button>
                )}
              </div>
            </section>
            <section className="ea-panel">
              <header>
                <h2>Visibility</h2>
              </header>
              <div className="ea-panel-body">
                <label className="ea-field">
                  Event status
                  <select name="status" value={form.status} onChange={change}>
                    <option value="draft">
                      Off / Draft — hidden from customers
                    </option>
                    <option value="published">
                      On / Published — visible for booking
                    </option>
                    <option value="cancelled">
                      Cancelled — stop new bookings
                    </option>
                  </select>
                </label>
                <p className="ea-hint">
                  Turning an event off stops new bookings. It does not cancel or
                  refund existing orders.
                </p>
                <button className="ea-button primary" disabled={busy}>
                  {busy
                    ? 'Saving…'
                    : id
                      ? 'Save event'
                      : 'Create event & add tickets'}
                  <Icon name="arrow" />
                </button>
              </div>
            </section>
          </aside>
        </form>
      )}
    </div>
  );
}
