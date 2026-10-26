import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {AreaChart,Area,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
import api from '../api/client';
import {siteBase} from '../saas/context';
import Icon from '../components/Icon';
import {Spinner,Alert} from '../components/ui';
import {formatCurrency,formatDate,formatTime,StatusBadge} from '../utils/format';
import './dashboard.css';

const dayLabel=value=>new Date(value+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'});
const compactMoney=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',notation:'compact',maximumFractionDigits:1}).format(value);
const tooltipStyle={background:'#fff',border:'1px solid #e5ded6',borderRadius:12,color:'#292621',fontSize:12,boxShadow:'0 8px 24px #26201615'};

export default function Dashboard(){
 const websiteUrl=window.location.origin+siteBase;
 const [copyStatus,setCopyStatus]=useState('');
 async function copyWebsiteLink(){
  try{await navigator.clipboard.writeText(websiteUrl);setCopyStatus('Website link copied.');}
  catch{setCopyStatus('Unable to copy automatically. Select and copy the website link.');}
 }
 const [data,setData]=useState(null),[days,setDays]=useState(14),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true),[updatedAt,setUpdatedAt]=useState(null);
 useEffect(()=>{
  const controller=new AbortController();let running=false;
  async function update(){
   if(running||controller.signal.aborted)return;
   running=true;setLoading(true);
   try{const r=await api.get('/admin/dashboard',{params:{days},signal:controller.signal,timeout:15000});if(!controller.signal.aborted){setData(r.data.data);setUpdatedAt(new Date());setError('');}}
   catch(e){if(!controller.signal.aborted)setError(e.response?.data?.message||'Unable to update the dashboard. Showing the last successful update.');}
   finally{running=false;if(!controller.signal.aborted)setLoading(false);}
  }
  const refreshVisible=()=>{if(document.visibilityState!=='hidden')update();};
  update();const interval=setInterval(refreshVisible,15000);
  window.addEventListener('focus',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);
  return()=>{controller.abort();clearInterval(interval);window.removeEventListener('focus',refreshVisible);document.removeEventListener('visibilitychange',refreshVisible);};
 },[days,refresh]);
 const chart=useMemo(()=>{if(!data)return [];const end=new Date(data.today+'T12:00:00Z');return Array.from({length:data.days},(_,i)=>{const d=new Date(end);d.setUTCDate(end.getUTCDate()-data.days+1+i);const date=d.toISOString().slice(0,10),point=data.salesTrend.find(p=>p.date===date);return {date,revenue:Number(point?.revenue||0),orders:Number(point?.orders||0)};});},[data]);
 if(!data&&loading)return <Spinner label="Opening your event overview…"/>;
 if(!data)return <div><Alert>{error}</Alert><button className="studio-button secondary" onClick={()=>setRefresh(n=>n+1)}>Try again</button></div>;
 const {kpi,recentOrders,upcoming,topEvents}=data;
 const tickets=Number(kpi.valid_tickets)+Number(kpi.checked_in_tickets),checked=Number(kpi.checked_in_tickets),attendance=tickets?Math.round(checked/tickets*100):0;
 const periodRevenue=chart.reduce((sum,p)=>sum+p.revenue,0),periodOrders=chart.reduce((sum,p)=>sum+p.orders,0);
 return <div className="event-dashboard">
  <header className="dash-heading"><div><p className="dash-eyebrow">YOUR ORGANIZER WORKSPACE</p><h1>Your events, at a glance.</h1><p>Live database totals · Updates every 15 seconds</p></div><div className="dash-heading-actions"><button className="dash-button dash-secondary" disabled={loading} onClick={()=>setRefresh(n=>n+1)}><Icon name="clock" size={16}/>{loading?'Updating…':'Refresh'}</button><Link className="dash-button dash-primary" to="/admin/events/new"><Icon name="plus" size={17}/>Create event</Link></div></header>
  {error&&<Alert>{error}</Alert>}
  <section className="dash-website-link" aria-label="Your organization website">
   <div><strong>Your organization website</strong><a href={websiteUrl} target="_blank" rel="noopener noreferrer">{websiteUrl}</a>{copyStatus&&<small role="status">{copyStatus}</small>}</div>
   <div className="dash-heading-actions"><button className="dash-button dash-secondary" onClick={copyWebsiteLink}>Copy link</button><a className="dash-button dash-secondary" href={websiteUrl} target="_blank" rel="noopener noreferrer">Open website ↗</a></div>
  </section>
  <div className="dash-context"><span><Icon name="calendar" size={14}/>{new Date(data.today+'T12:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span><span>Real bookings · All-time totals{updatedAt&&<><span className="dash-context-dot">·</span>{error?'Last successful update':'Updated'} {updatedAt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</>}</span></div>
  <section className="dash-metrics" aria-label="Event overview">
   <Link to="/admin/orders" className="dash-metric dash-revenue"><div className="dash-metric-label"><span>Booking revenue</span><Icon name="credit-card" size={19}/></div><strong>{formatCurrency(kpi.total_revenue)}</strong><p>{kpi.inr_paid_orders} paid {Number(kpi.inr_paid_orders)===1?'booking':'bookings'} · INR</p><span className="dash-metric-link">View bookings <Icon name="arrow" size={14}/></span></Link>
   <Metric label="Tickets issued" value={tickets.toLocaleString('en-IN')} icon="ticket" detail="Valid and checked-in tickets" to="/admin/orders" footer={`${kpi.pending_orders} bookings awaiting payment`}/>
   <Metric label="Upcoming events" value={kpi.upcoming_events} icon="calendar" detail={`${kpi.active_events} published · ${kpi.draft_events} drafts`} to="/admin/events" footer="Manage your events"/>
   <Link to="/admin/check-in" className="dash-metric"><div className="dash-metric-label"><span>Guests checked in</span><Icon name="check" size={19}/></div><strong>{checked.toLocaleString('en-IN')}<small>/ {tickets}</small></strong><p>{tickets?`${attendance}% of issued tickets`:'Ready when your guests arrive'}</p><div className="dash-progress" role="progressbar" aria-label="Guests checked in" aria-valuemin={0} aria-valuemax={100} aria-valuenow={attendance}><span style={{width:attendance+'%'}}/></div></Link>
  </section>
  <div className="dash-main-grid">
   <section className="dash-panel dash-sales" aria-labelledby="sales-title"><header className="dash-panel-head"><div><h2 id="sales-title">Sales overview</h2><p>Paid booking revenue · INR</p></div><label className="dash-period"><span className="sr-only">Sales period</span><select value={days} disabled={loading} onChange={e=>setDays(Number(e.target.value))}><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></header><div className="dash-sales-total"><strong>{formatCurrency(periodRevenue)}</strong><span>{periodOrders} paid {periodOrders===1?'booking':'bookings'} in this period</span></div>
    <div className="dash-chart" aria-label={`Revenue over the last ${data.days} days: ${formatCurrency(periodRevenue)}`} aria-busy={loading}>{periodOrders===0?<div className="dash-chart-empty"><div className="dash-empty-icon"><Icon name="ticket" size={23}/></div><h3>Your next chapter starts with a booking.</h3><p>Sales will appear here as customers book your events.</p><Link to="/admin/events">View your events <Icon name="arrow" size={14}/></Link></div>:<ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{top:10,right:10,left:0,bottom:4}}><defs><linearGradient id="dashboard-revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#de682e" stopOpacity={.22}/><stop offset="100%" stopColor="#de682e" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ede8e2" strokeDasharray="4 4" vertical={false}/><XAxis dataKey="date" tickFormatter={dayLabel} tick={{fontSize:10,fill:'#847d74'}} axisLine={false} tickLine={false} minTickGap={38}/><YAxis tickFormatter={compactMoney} tick={{fontSize:10,fill:'#847d74'}} axisLine={false} tickLine={false} width={56}/><Tooltip contentStyle={tooltipStyle} labelFormatter={dayLabel} formatter={v=>[formatCurrency(v),'Revenue']}/><Area type="monotone" dataKey="revenue" stroke="#d3632d" fill="url(#dashboard-revenue-fill)" strokeWidth={2.5} isAnimationActive={false}/></AreaChart></ResponsiveContainer>}</div><footer className="dash-panel-foot"><span>Revenue excludes cancelled and refunded orders.</span><Link to="/admin/orders">View orders <Icon name="arrow" size={14}/></Link></footer>
   </section>
   <section className="dash-panel dash-upcoming"><header className="dash-panel-head"><div><h2>Next on the calendar</h2><p>Your upcoming published events</p></div><span className="dash-icon-soft"><Icon name="calendar" size={19}/></span></header>{upcoming.length?<div className="dash-event-list">{upcoming.map((event,i)=><Link key={event.id} className={`dash-event ${i===0?'dash-event-first':''}`} to={`/admin/events/${event.id}`}><DateTile value={event.start_datetime}/><div className="dash-event-info">{i===0&&<span className="dash-next-label">UP NEXT</span>}<h3>{event.title}</h3><p>{event.venue}{event.city&&`, ${event.city}`}</p><small><span style={{whiteSpace:'pre-line'}}>{event.schedule_text || formatTime(event.start_datetime)}</span> · {event.tickets_sold} tickets issued</small></div><Icon name="arrow" size={16}/></Link>)}</div>:<Empty icon="calendar" title="Make room for your next event." detail="Your published upcoming events will appear here."/>}<footer className="dash-panel-foot"><span>{kpi.draft_events} {Number(kpi.draft_events)===1?'draft':'drafts'} to work on</span><Link to="/admin/events">All events <Icon name="arrow" size={14}/></Link></footer></section>
  </div>
  <div className="dash-bottom-grid">
   <section className="dash-panel"><header className="dash-panel-head"><div><h2>Latest bookings</h2><p>{data.separate_test_bookings?'Customer activity from this organization':'Recent activity from this organization'}</p></div><Link className="dash-text-link" to="/admin/orders">View all <Icon name="arrow" size={14}/></Link></header>{recentOrders.length?<div className="dash-table-scroll"><table className="dash-orders"><thead><tr><th>Guest / event</th><th>Amount</th><th>Status</th></tr></thead><tbody>{recentOrders.map(order=><tr key={order.id}><td><Link to={`/admin/orders/${order.id}`}><span className="dash-guest-avatar">{order.customer_name.slice(0,1).toUpperCase()}</span><span><strong>{order.customer_name}</strong><small>{order.event_title}</small><span className="dash-booking-ref">{order.booking_ref}</span></span></Link></td><td>{formatCurrency(order.total_amount,order.currency)}</td><td><StatusBadge status={order.status}/>{['mock','razorpay_test'].includes(order.payment_method)&&<small className="dash-test-label">Test / demo</small>}</td></tr>)}</tbody></table></div>:<Empty icon="users" title="Your guest list starts here." detail="New customer bookings will appear automatically."/>}<footer className="dash-panel-foot"><span>{kpi.pending_orders} awaiting payment</span><span>{kpi.cancelled_orders} cancelled or refunded</span></footer></section>
   <section className="dash-panel"><header className="dash-panel-head"><div><h2>Top-performing events</h2><p>Ranked by paid revenue · INR · all time</p></div><span className="dash-icon-soft"><Icon name="grid" size={18}/></span></header>{topEvents.length?<ol className="dash-ranking">{topEvents.map((event,i)=><li key={event.id}><Link to={`/admin/events/${event.id}`}><span className="dash-rank">{String(i+1).padStart(2,'0')}</span><div><div className="dash-rank-label"><strong>{event.title}</strong><b>{formatCurrency(event.revenue)}</b></div><div className="dash-rank-bar"><span style={{width:Math.max(0,Number(event.revenue)/Number(topEvents[0].revenue)*100)+'%'}}/></div><small>{event.orders} paid bookings</small></div></Link></li>)}</ol>:<Empty icon="grid" title="Good things are taking shape." detail="Your leading events will appear after their first paid bookings."/>}<footer className="dash-panel-foot"><span>Keep every event moving.</span><Link to="/admin/events">Manage events <Icon name="arrow" size={14}/></Link></footer></section>
  </div>
  <nav className="dash-quick-actions" aria-label="Dashboard shortcuts"><Link to="/admin/check-in"><Icon name="check" size={19}/><span><strong>Welcome your guests</strong><small>Open guest check-in</small></span><Icon name="arrow" size={16}/></Link>{data.can_manage_finances&&<><Link to="/admin/ticket-designs"><Icon name="ticket" size={19}/><span><strong>Make every ticket yours</strong><small>Browse your ticket designs</small></span><Icon name="arrow" size={16}/></Link><Link to="/admin/wallet"><Icon name="credit-card" size={19}/><span><strong>Your event funds</strong><small>View balances & withdrawals</small></span><Icon name="arrow" size={16}/></Link></>}</nav>
 </div>;
}
function Metric({label,value,detail,icon,to,footer}){return <Link to={to} className="dash-metric"><div className="dash-metric-label"><span>{label}</span><Icon name={icon} size={19}/></div><strong>{value}</strong><p>{detail}</p><span className="dash-metric-link">{footer}<Icon name="arrow" size={14}/></span></Link>;}
function DateTile({value}){const date=new Date(String(value).replace(' ','T'));return <div className="dash-date-tile" aria-label={formatDate(value)}><span>{date.toLocaleDateString('en-IN',{month:'short'})}</span><strong>{date.getDate()}</strong></div>;}
function Empty({icon,title,detail}){return <div className="dash-empty"><span className="dash-empty-icon"><Icon name={icon} size={24}/></span><h3>{title}</h3><p>{detail}</p></div>;}
