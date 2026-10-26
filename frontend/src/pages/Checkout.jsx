import TaxBreakdown,{readTaxSnapshot} from '../components/TaxBreakdown';
import { useEffect, useState, useRef } from 'react';
import {
  useNavigate,
  useParams,
  useSearchParams,
  Link,
  useLocation,
} from 'react-router-dom';
import api from '../api/client';
import {getPublicData} from '../settings/publicStartup';
import {loadCheckout} from '../saas/razorpayCheckout';
import { formatCurrency, formatDateTime } from '../utils/format';
import Icon from '../components/Icon';
import CustomerState from '../components/CustomerState';
import './booking.css';
import './checkoutThemes.css';
import {eventThemeId, refreshCheckoutTheme} from './eventTheme';
import {watchEventContent} from '../settings/watchEventContent';
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
  const [busy, setBusy] = useState(false);
  const [pending,setPending]=useState(null);
  const [people,setPeople]=useState({});
  const [couponInput,setCouponInput]=useState(''),[couponQuote,setCouponQuote]=useState(null),[couponError,setCouponError]=useState(''),[couponBusy,setCouponBusy]=useState(false);
  const couponRequest=useRef(0);
  const [baseQuote,setBaseQuote]=useState(null),[quoteError,setQuoteError]=useState(''),[quoteReload,setQuoteReload]=useState(0);
  useEffect(()=>{setPeople({});setPending(null);},[slug]);
  const cart =
    params.get('tickets') ||
    state?.items?.map((i) => i.ticket_type_id + ':' + i.qty).join(',') ||
    '';
  useEffect(()=>{couponRequest.current++;setCouponInput('');setCouponQuote(null);setCouponError('');setCouponBusy(false);},[slug,cart]);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoadError('');
    let loaded = false;
    const stop = watchEventContent(api.defaults.baseURL, signal => {
    getPublicData('/events/' + slug, { signal })
      .then(({ data: r }) => {
        if (signal.aborted) return;
        if (r.data.checkout_path) {
          window.location.replace(checkoutDestination(r.data, slug, cart));
          return;
        }
        loaded = true;
        setLoadError('');
        setData(current => refreshCheckoutTheme(current, r.data));
      })
      .catch((e) => {
        if (!signal.aborted && !loaded)
          setLoadError(e.response?.data?.message || 'Unable to load event.');
      });
    });
    api
      .get('/pages', { signal: controller.signal })
      .then(({ data: r }) => setPages(r.data.pages))
      .catch(() => {});
    return () => { stop(); controller.abort(); };
  }, [slug, cart]);
  useEffect(()=>{
    setBaseQuote(null);setQuoteError('');if(!data?.event.id)return;
    const controller=new AbortController();
    const items=cart.split(',').filter(Boolean).map(s=>{const [id,qty]=s.split(':');return {ticket_type_id:Number(id),qty:Number(qty)};});
    api.post('/checkout/quote',{event_id:data.event.id,items},{signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setBaseQuote(r.data.data);}).catch(e=>{if(!controller.signal.aborted)setQuoteError(e.response?.data?.message||'Unable to calculate the total. Please retry.');});
    return()=>controller.abort();
  },[data?.event.id,cart,quoteReload]);
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
  async function applyCoupon(e){
    e.preventDefault();const request=++couponRequest.current;setCouponBusy(true);setCouponError('');setCouponQuote(null);
    try{const r=await api.post('/checkout/quote',{event_id:data.event.id,coupon_code:couponInput,items:items.map(i=>({ticket_type_id:i.id,qty:i.qty}))});if(request===couponRequest.current)setCouponQuote(r.data.data);}
    catch(e){if(request===couponRequest.current)setCouponError(e.response?.data?.message||'Unable to validate this code. Please try again.');}
    finally{if(request===couponRequest.current)setCouponBusy(false);}
  }
  function changeCoupon(value){couponRequest.current++;setCouponInput(value);setCouponQuote(null);setCouponError('');setCouponBusy(false);}
  const editLink = '/events/' + slug + '?tickets=' + encodeURIComponent(cart);
  if (loadError) return <CustomerState eyebrow="YOUR BOOKING" title="We couldn’t open this checkout." description={loadError} action="Browse events"/>;
  if (!data) return <CustomerState loading eyebrow="YOUR BOOKING" title="Getting your tickets ready…"/>;
  if (!valid && !pending) return <CustomerState eyebrow="YOUR BOOKING" title={requested.length ? 'Let’s update your selection.' : 'Start with your tickets.'} description={requested.length ? 'A selected ticket is unavailable or the quantity has changed. Review the latest options before continuing.' : 'Choose the ticket type and quantity you’d like before entering your booking details.'} to={editLink} action="Choose tickets"/>;
  const { event } = data,
    total = pending ? Number(pending.order.total_amount) : (couponQuote||baseQuote) ? (couponQuote||baseQuote).total_minor/100 : items.reduce((s, i) => s + Number(i.type.price) * i.qty, 0),
    count = items.reduce((s, i) => s + i.qty, 0);
  async function book(e) {
    e.preventDefault();
    if (busy||couponBusy||(!pending&&!baseQuote)) return;
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
        pricing_token:(couponQuote||baseQuote)?.pricing_token,
        ...(couponQuote?{coupon_code:couponQuote.coupon.code,coupon_revision:couponQuote.coupon.revision}:{}),
        request_key:requestKey,
        contact_source: 'attendee',
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
      if(e.response?.data?.message?.startsWith('Prices or taxes changed')){setCouponQuote(null);setQuoteReload(n=>n+1);}
      if(e.response?.data?.message?.toLowerCase().includes('coupon')){setCouponQuote(null);setCouponError(e.response.data.message);}
      if(e.response?.status===409&&e.response?.data?.message?.includes('registration form')){try{const r=await api.get('/events/'+slug);setData(r.data.data);}catch{}}
      setBusy(false);
    }
  }
  return <CheckoutPageView {...{data, items, people, pending, busy, error, pages, editLink, total, count,couponInput,couponQuote,couponError,couponBusy,baseQuote,quoteError}} pricingBusy={!pending&&!baseQuote} onRetryQuote={()=>setQuoteReload(n=>n+1)} onApplyCoupon={applyCoupon} onCouponChange={changeCoupon} onBook={book} onPersonChange={(key,person)=>setPeople(p=>({...p,[key]:person}))} onCheckPayment={checkPayment} onStartNew={()=>{sessionStorage.removeItem(storageKey);setPending(null);window.location.reload();}}/>;
}

export function CheckoutPageView({data,items,people={},pending=null,busy=false,error='',pages=[],editLink,total,count,onBook,onPersonChange,onCheckPayment,onStartNew,couponInput='',couponQuote=null,couponError='',couponBusy=false,onApplyCoupon,onCouponChange,baseQuote=null,quoteError='',pricingBusy=false,onRetryQuote}) {
  const {event}=data;
  const tax=pending?readTaxSnapshot(pending.order.tax_snapshot):(couponQuote||baseQuote)?.tax;
  let breakdown=couponQuote?.breakdown;
  if(pending){try{breakdown=JSON.parse(pending.order.coupon_breakdown||'null');}catch{breakdown=null;}}

  return (
    <main className={`booking-page checkout-page event-theme-${eventThemeId(event.page_theme)}`}>
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
          <form onSubmit={onBook} className="checkout-form">
            <CheckoutAttendees items={items} people={people} config={data.registrationForm?.config} disabled={busy||Boolean(pending)} saved={pending?.attendees} onChange={onPersonChange}/>
            <div className="checkout-section-title">
              <span>02</span>
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
            {pending&&<div className="booking-alert"><strong>Booking {pending.order.booking_ref}</strong><p>{pending.order.customer_name} · {pending.order.email}</p><p>Payment status: {pending.payment.status.replaceAll('_',' ')}. Your original total is {formatCurrency(pending.order.total_amount,pending.order.currency)}. Unpaid reservations are held for 15 minutes.</p><button type="button" disabled={busy} onClick={onCheckPayment}>Check payment</button>{pending.payment.status==='expired'&&<button type="button" disabled={busy} onClick={onStartNew}>Start a new booking</button>}</div>}
            {error && (
              <div className="booking-alert" role="alert">
                {error}
                <Link to={editLink}>Review ticket availability →</Link>
              </div>
            )}
            {!pending&&pricingBusy&&<p role="status">{quoteError||'Calculating your total and taxes…'} {quoteError&&<button type="button" className="booking-text-link" onClick={onRetryQuote}>Retry total</button>}</p>}
            <button className="booking-primary" disabled={busy||couponBusy||pricingBusy||(total>0&&(!data.payment?.configured||!data.payment?.has_webhook_secret))||(pending&&!pending.payment.can_pay)}>
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
                {formatDateTime(event.start_datetime)}{event.schedule_text && <span style={{display:'block'}}>{event.schedule_text}</span>}
              </p>
              <p>
                {event.venue} · {event.city}
              </p>
              <div className="checkout-line-items">
                {items.map((i) => {const line=breakdown?.lines?.find(line=>line.ticket_type_id===i.id),taxLine=tax?.lines?.find(line=>line.ticket_type_id===i.id);return (
                  <div key={i.id}>
                    <span>
                      <b>{i.type?.name || 'Reserved ticket'}</b>
                      <small>
                        {i.qty} × {formatCurrency(i.type?.price)}
                      </small>
                    </span>
                    <span className="checkout-line-price">{line?.discount_minor>0?<><s>{formatCurrency(line.subtotal_minor/100)}</s><strong>{formatCurrency(line.total_minor/100)}</strong><small>Coupon savings: {formatCurrency(line.discount_minor/100)}</small></>:<><strong>{formatCurrency(i.qty * (i.type?.price||0))}</strong>{line&&!line.eligible&&<small>Coupon does not apply</small>}</>}{taxLine?.profile_id&&<small>{taxLine.price_mode==='inclusive'?<>Includes {formatCurrency(taxLine.tax_minor/100)} tax</>:<>With tax: {formatCurrency(taxLine.total_minor/100)}</>}</small>}</span>
                  </div>
                );})}
              </div>
              {!pending&&<form className="checkout-coupon" onSubmit={onApplyCoupon}>
                <label htmlFor="checkout-coupon-code">Have a coupon code?</label><div><input id="checkout-coupon-code" value={couponInput} placeholder="Enter coupon code" maxLength={40} autoComplete="off" disabled={busy||couponBusy} onChange={e=>onCouponChange(e.target.value.toUpperCase())}/>{couponQuote?<button type="button" disabled={busy} onClick={()=>onCouponChange('')}>Remove</button>:<button disabled={busy||couponBusy||pricingBusy||!couponInput.trim()}>{couponBusy?'Checking…':'Apply'}</button>}</div>
                {couponError&&<p role="alert">{couponError}</p>}{couponQuote&&<p className="coupon-applied" role="status">{couponQuote.coupon.code} applied · You save {formatCurrency(couponQuote.discount_minor/100)}</p>}
              </form>}
              {breakdown&&<p className="checkout-coupon-scope">{breakdown.scope==='all'?'Discount applies to all tickets in this booking.':'Discount applies only to eligible ticket types.'} <span>Eligible ticket subtotal: {formatCurrency(breakdown.eligible_subtotal_minor/100)}</span></p>}
              {(pending?.order.coupon_code||couponQuote)&&<div className="checkout-discount" aria-label="Discount summary"><div><span>Subtotal</span><strong>{formatCurrency(pending?pending.order.subtotal_amount:couponQuote.subtotal_minor/100)}</strong></div><div><span>Discount · {pending?pending.order.coupon_code:couponQuote.coupon.code}</span><strong>−{formatCurrency(pending?pending.order.discount_amount:couponQuote.discount_minor/100)}</strong></div></div>}
              <TaxBreakdown value={tax}/>
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
