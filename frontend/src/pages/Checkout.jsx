import { useEffect, useState } from 'react';
import {
  useNavigate,
  useParams,
  useSearchParams,
  Link,
  useLocation,
} from 'react-router-dom';
import api from '../api/client';
import {loadCheckout} from '../saas/razorpayCheckout';
import { formatCurrency, formatDateTime } from '../utils/format';
import Icon from '../components/Icon';
import CustomerState from '../components/CustomerState';
import './booking.css';
import CheckoutAttendees,{attendeePayload} from './CheckoutAttendees';
import {checkoutDestination} from './checkoutNavigation';
export default function Checkout() {
  const { slug } = useParams(),
    [params] = useSearchParams(),
    { state } = useLocation(),
    navigate = useNavigate();
  const [data, setData] = useState(null),
    [loadError, setLoadError] = useState(''),
    [error, setError] = useState(''),
    [pages, setPages] = useState([]);
  const [form, setForm] = useState({ customer_name: '', email: '', phone: '' }),
    [busy, setBusy] = useState(false);
  const [pending,setPending]=useState(null);
  const [people,setPeople]=useState({});
  useEffect(()=>{setPeople({});setPending(null);},[slug]);
  const cart =
    params.get('tickets') ||
    state?.items?.map((i) => i.ticket_type_id + ':' + i.qty).join(',') ||
    '';
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoadError('');
    api
      .get('/events/' + slug, { signal: controller.signal })
      .then(({ data: r }) => {
        if (controller.signal.aborted) return;
        if (r.data.checkout_path) {
          window.location.replace(checkoutDestination(r.data, slug, cart));
          return;
        }
        setData(r.data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setLoadError(e.response?.data?.message || 'Unable to load event.');
      });
    api
      .get('/pages', { signal: controller.signal })
      .then(({ data: r }) => setPages(r.data.pages))
      .catch(() => {});
    return () => controller.abort();
  }, [slug, cart]);
  const storageKey='event-checkout:'+window.location.pathname+':'+cart;
  function finish(result){sessionStorage.removeItem(storageKey);navigate('/confirmation/'+result.order.booking_ref,{replace:true,state:{fresh:result,email:result.order.email}});}
  useEffect(()=>{let active=true;setPending(null);const token=sessionStorage.getItem(storageKey);if(token)api.post('/booking-payments/status',{}, {headers:{'x-booking-token':token}}).then(r=>{if(!active)return;if(r.data.data.paid)finish(r.data.data);else setPending(r.data.data);}).catch(()=>{});return()=>{active=false;};},[storageKey]);
  async function checkPayment(){setBusy(true);setError('');try{const r=await api.post('/booking-payments/status',{}, {headers:{'x-booking-token':sessionStorage.getItem(storageKey)}});if(r.data.data.paid)finish(r.data.data);else{setPending(r.data.data);setError(r.data.data.payment.status==='review'?'Payment needs review. Please contact the organizer with your booking reference.':'Payment is not confirmed yet. You can resume checkout or check again.');}}catch(e){setError(e.response?.data?.message||'Unable to check payment.');}finally{setBusy(false);}}
  async function pay(result){
    if(result.paid){finish(result);return;}
    setPending(result);
    if(!result.payment.order_id||!result.payment.can_pay){setBusy(false);setError('This reservation has expired or needs review. Check payment status before starting again.');return;}
    await loadCheckout();
    const checkout=new window.Razorpay({key:result.payment.key,order_id:result.payment.order_id,amount:result.payment.amount,currency:result.payment.currency,name:data.event.title,description:'Event tickets',prefill:{name:result.order.customer_name,email:result.order.email,contact:result.order.phone||''},theme:{color:'#d95620'},
      handler:async response=>{try{const r=await api.post('/booking-payments/verify',response,{headers:{'x-booking-token':sessionStorage.getItem(storageKey)}});if(r.data.data.paid)finish(r.data.data);else{setPending(r.data.data);setError('Payment needs review. Contact the organizer with your booking reference.');}}catch(e){setError(e.response?.data?.message||'Payment confirmation is pending. Use Check payment before trying again.');}finally{setBusy(false);}},
      modal:{ondismiss:()=>setBusy(false)},
    });
    checkout.on('payment.failed',()=>{setBusy(false);setError('Payment did not complete. Resume this checkout to retry.');});checkout.open();
  }
  const requested = cart
    .split(',')
    .filter(Boolean)
    .map((s) => {
      const [id, qty] = s.split(':');
      return { id: Number(id), qty: Number(qty) };
    });
  const items = pending?.items?.length ? pending.items.map(i=>({id:i.ticket_type_id,qty:i.qty,type:{name:i.name,price:i.price}})) : data
    ? requested.map((i) => ({
        ...i,
        type: data.ticketTypes.find((t) => t.id === i.id),
      }))
    : [];
  const valid =
    items.length > 0 &&
    new Set(items.map((i) => i.id)).size === items.length &&
    items.every(
      (i) =>
        i.type?.is_on_sale &&
        Number.isInteger(i.qty) &&
        i.qty >= i.type.min_per_order &&
        i.qty <= Math.min(i.type.available, i.type.max_per_order)
    );
  const editLink = '/events/' + slug + '?tickets=' + encodeURIComponent(cart);
  if (loadError) return <CustomerState eyebrow="YOUR BOOKING" title="We couldn’t open this checkout." description={loadError} action="Browse events"/>;
  if (!data) return <CustomerState loading eyebrow="YOUR BOOKING" title="Getting your tickets ready…"/>;
  if (!valid && !pending) return <CustomerState eyebrow="YOUR BOOKING" title={requested.length ? 'Let’s update your selection.' : 'Start with your tickets.'} description={requested.length ? 'A selected ticket is unavailable or the quantity has changed. Review the latest options before continuing.' : 'Choose the ticket type and quantity you’d like before entering your booking details.'} to={editLink} action="Choose tickets"/>;
  const { event } = data,
    total = pending ? Number(pending.order.total_amount) : items.reduce((s, i) => s + Number(i.type.price) * i.qty, 0),
    count = items.reduce((s, i) => s + i.qty, 0);
  async function book(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if(pending){await pay(pending);return;}
      let requestKey=sessionStorage.getItem(storageKey);if(!requestKey){requestKey=crypto.randomUUID();sessionStorage.setItem(storageKey,requestKey);}
      const attendeeData=attendeePayload(items,people,data.registrationForm?.config);
      if(attendeeData.attachments.some(a=>a.file.size>2*1024*1024))throw new Error('Each registration attachment must be 2 MB or smaller.');
      if(attendeeData.attachments.length>30||attendeeData.attachments.reduce((n,a)=>n+a.file.size,0)>20*1024*1024)throw new Error('Use up to 30 attachments and 20 MB per booking.');
      const payload={
        event_id: event.id,
        request_key:requestKey,
        customer_name: form.customer_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        items: attendeeData.items,
        form_revision:data.registrationForm?.revision||0,
      };
      const attachments=attendeeData.attachments;
      let body=payload;
      if(attachments.length){body=new FormData();body.append('booking',JSON.stringify(payload));for(const f of attachments)body.append(f.name,f.file);}
      const {data:r}=await api.post('/orders',body,attachments.length?{headers:{'Content-Type':'multipart/form-data'}}:undefined);
      await pay(r.data);
    } catch (e) {
      setError(
        e.response?.data?.message || e.message || 'Booking failed. Please try again.'
      );
      if(e.response?.status===409&&e.response?.data?.message?.includes('registration form')){try{const r=await api.get('/events/'+slug);setData(r.data.data);}catch{}}
      setBusy(false);
    }
  }
  return (
    <main className="booking-page checkout-page">
      <div className="booking-container">
        <Link className="booking-back" to={editLink}>
          ← Back to ticket selection
        </Link>
        <div className="booking-steps" aria-label="Booking progress">
          <span>
            01 <b>Choose tickets</b>
          </span>
          <i />
          <span className="current" aria-current="step">
            02 <b>Your details</b>
          </span>
          <i />
          <span>
            03 <b>You’re in</b>
          </span>
        </div>
        <div className="checkout-intro">
          <span className="booking-kicker">ONE STEP CLOSER</span>
          <h1>
            Make it <em>official.</em>
          </h1>
          <p>Your next great experience starts here.</p>
        </div>
        <div className="checkout-grid">
          <form onSubmit={book} className="checkout-form">
            <div className="checkout-section-title">
              <span>01</span>
              <div>
                <h2>Booking contact</h2>
                <p>Your confirmation will be sent here and to any attendee email addresses provided.</p>
              </div>
            </div>
            <div className="checkout-fields">
              {[
                [
                  'customer_name',
                  'Full name',
                  'text',
                  'name',
                  'Your full name',
                ],
                ['email', 'Email address', 'email', 'email', 'you@example.com'],
                [
                  'phone',
                  'Phone number',
                  'tel',
                  'tel',
                  'Your contact number',
                ],
              ].map(([key, label, type, auto, placeholder]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    disabled={busy||Boolean(pending)}
                    type={type}
                    autoComplete={auto}
                    maxLength={
                      key === 'customer_name' ? 150 : key === 'email' ? 254 : 40
                    }
                    required
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <CheckoutAttendees items={items} people={people} config={data.registrationForm?.config} contact={form} disabled={busy||Boolean(pending)} saved={pending?.attendees} onChange={(key,person)=>setPeople(p=>({...p,[key]:person}))}/>
            <div className="checkout-section-title">
              <span>03</span>
              <div>
                <h2>Review & confirm</h2>
                <p>Check your ticket choices and the total before booking.</p>
              </div>
            </div>
            <div className="demo-payment">
              <Icon name="ticket" />
              <div>
                <strong>{total===0?'Free registration':data.payment?.mode==='live'?'Secure payment with Razorpay':'Razorpay test checkout'}</strong>
                <p>
                  {total===0?'Confirm to receive your entry tickets.':!data.payment?.configured||!data.payment?.has_webhook_secret?'Online payments are not available yet. Please contact the organizer.':data.payment?.mode==='live'?'Complete payment to receive your tickets. Your booking is confirmed after payment verification.':'Test mode is active. No real money is collected, and test balances cannot be withdrawn.'}
                </p>
              </div>
              <span>{total===0?'FREE':data.payment?.mode==='live'?'SECURE':'TEST MODE'}</span>
            </div>
            {pending&&<div className="booking-alert"><strong>Booking {pending.order.booking_ref}</strong><p>{pending.order.customer_name} · {pending.order.email}</p><p>Payment status: {pending.payment.status.replaceAll('_',' ')}. Your original total is {formatCurrency(pending.order.total_amount,pending.order.currency)}. Unpaid reservations are held for 15 minutes.</p><button type="button" disabled={busy} onClick={checkPayment}>Check payment</button>{pending.payment.status==='expired'&&<button type="button" disabled={busy} onClick={()=>{sessionStorage.removeItem(storageKey);setPending(null);window.location.reload();}}>Start a new booking</button>}</div>}
            {error && (
              <div className="booking-alert" role="alert">
                {error}
                <Link to={editLink}>Review ticket availability →</Link>
              </div>
            )}
            <button className="booking-primary" disabled={busy||(total>0&&(!data.payment?.configured||!data.payment?.has_webhook_secret))||(pending&&!pending.payment.can_pay)}>
              {busy
                ? 'Preparing payment…'
                : (pending?'Resume payment':total===0?'Confirm free booking':'Pay securely') + ' · ' + formatCurrency(total)}
              <Icon name="arrow" />
            </button>
            <p className="checkout-fineprint">
              Your total is shown in INR.{' '}
              {pages.length > 0 && (
                <>
                  Read the organizer’s{' '}
                  {pages.map((p, i) => (
                    <span key={p.slug}>
                      {i > 0 ? ', ' : ''}
                      <Link to={'/pages/' + p.slug} target="_blank" rel="noopener noreferrer">
                        {p.title}
                      </Link>
                    </span>
                  ))}
                  .
                </>
              )}
            </p>
          </form>
          <aside className="checkout-summary">
            <div className="checkout-summary-banner">
              {event.banner_image && <img src={event.banner_image} alt="" />}
              <span>{event.category || 'YOUR EXPERIENCE'}</span>
            </div>
            <div className="checkout-summary-body">
              <small>YOU’RE GOING TO</small>
              <h2>{event.title}</h2>
              <p>
                <Icon name="calendar" />
                {formatDateTime(event.start_datetime)}
              </p>
              <p>
                {event.venue} · {event.city}
              </p>
              <div className="checkout-line-items">
                {items.map((i) => (
                  <div key={i.id}>
                    <span>
                      <b>{i.type?.name || 'Reserved ticket'}</b>
                      <small>
                        {i.qty} × {formatCurrency(i.type?.price)}
                      </small>
                    </span>
                    <strong>{formatCurrency(i.qty * (i.type?.price||0))}</strong>
                  </div>
                ))}
              </div>
              <div className="checkout-total">
                <span>
                  Total{' '}
                  <small>
                    {count} ticket{count === 1 ? '' : 's'} · INR
                  </small>
                </span>
                <strong>{formatCurrency(total)}</strong>
              </div>
              <Link to={editLink} className="booking-text-link">
                Edit ticket selection ↗
              </Link>
              <div className="checkout-ticket-note">
                <Icon name="check" />
                <span>One personal QR ticket for every attendee.</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
