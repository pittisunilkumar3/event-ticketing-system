import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import Icon from '../components/Icon';

export default function MyBookings() {
  const navigate = useNavigate();
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);

  async function handleSubmit(e) {
    e.preventDefault();
    const clean = reference.trim().toUpperCase();
    if (!clean || checking) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError('');
    setChecking(true);
    try {
      await api.get(`/bookings/${encodeURIComponent(clean)}`, { signal: controller.signal });
      if (!controller.signal.aborted) navigate(`/confirmation/${encodeURIComponent(clean)}`);
    } catch (err) {
      if (!controller.signal.aborted) setError(err.response?.status === 404 ? 'We couldn’t find that booking. Check the reference and try again.' : 'We couldn’t check your booking right now. Please try again.');
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }

  return (
    <main className="customer-page lookup-page">
      <div className="customer-container">
        <Link className="customer-back" to="/events">← Back to events</Link>
        <div className="lookup-layout">
          <section className="lookup-story">
            <p className="customer-eyebrow">YOUR PLANS, ALL TOGETHER</p>
            <h1>Your next memory.<br/><span>Right here.</span></h1>
            <p>Find your booking, get your tickets, and get ready for the good part.</p>
            <div className="lookup-ticket" aria-hidden="true"><div><Icon name="ticket" size={25}/><span>GOOD TIMES AHEAD</span></div><strong>Keep the plans.<br/>Bring the excitement.</strong><footer><span>YOUR TICKET TO BEING THERE</span><Icon name="arrow" size={24}/></footer></div>
            <span className="lookup-story-note"><Icon name="calendar" size={17}/> From the first plan to the front door.</span>
          </section>
          <section className="lookup-form-panel" aria-labelledby="lookup-title">
            <span className="customer-icon"><Icon name="search" size={25}/></span>
            <h2 id="lookup-title">Find my booking</h2>
            <p>Enter the reference shown on your booking confirmation.</p>
            <form onSubmit={handleSubmit} className="customer-form">
              <label htmlFor="booking-reference">Booking reference</label>
              <input id="booking-reference" className="reference-input" type="text" value={reference} onChange={e => { setReference(e.target.value); setError(''); }} placeholder="TKT-XXXXXXX" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={100} required disabled={checking} aria-invalid={Boolean(error)} aria-describedby={error ? 'reference-help reference-error' : 'reference-help'}/>
              <p id="reference-help" className="customer-field-help">Use the full reference, including TKT-.</p>
              {error && <p id="reference-error" className="customer-alert" role="alert">{error}</p>}
              <button className="customer-button" disabled={checking || !reference.trim()}>{checking ? 'Finding your booking…' : 'View my booking'}<Icon name="arrow" size={18}/></button>
            </form>
            <div className="lookup-help"><Icon name="mail" size={20}/><div><h3>Looking for your reference?</h3><p>Check your saved confirmation page or booking email, if you received one.</p></div></div>
            <Link to="/events" className="customer-text-link">Still making plans? Explore events <Icon name="arrow" size={16}/></Link>
          </section>
        </div>
      </div>
    </main>
  );
}
