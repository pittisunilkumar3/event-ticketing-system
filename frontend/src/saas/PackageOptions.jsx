import './packageOptions.css';

const money=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(value)/100);
export default function PackageOptions({data,owner,busy,onBuy}) {
 const remaining=Number(data.organization.event_balance),purchased=Boolean(data.subscription?.latest_purchase)||remaining>0;
 return <section className="package-options" aria-labelledby="available-packages">
  <h2 id="available-packages">{purchased?'Add more event credits':'Choose your event package'}</h2>
  <p className="muted">Every package is a one-time purchase. Buying another package adds its events to your remaining balance, with no monthly renewal or expiry.</p>
  <div className="grid">{data.packages.map(pack=>{
   const disabled=!owner||!data.payments_ready||busy!==null||data.organization.status!=='active';
   const action=!owner?'Owner purchase only':data.organization.status!=='active'?'Account suspended':!data.payments_ready?'Payments unavailable':purchased?'Add '+pack.event_count+' events':'Buy '+pack.name;
   return <article className="card" key={pack.id} aria-label={pack.name+' package'}>
    <h3>{pack.name}</h3><div className="metric">{pack.event_count} <small>events</small></div>
    <div className="package-option-price"><strong>{money(pack.price_paise)}</strong><span>One-time payment · {money(Math.round(pack.price_paise/pack.event_count))} per event</span></div>
    <ul><li>Your branded ticketing site</li><li>Ticket designs, bookings and check-in</li><li>No monthly renewal or expiry</li></ul>
    <p className="package-option-balance">After payment: <strong>{remaining+Number(pack.event_count)} events remaining</strong></p>
    <button className="full" disabled={disabled} onClick={()=>onBuy(pack)}>{busy===pack.id?'Opening payment…':action}</button>
   </article>;
  })}</div>
  {!data.packages.length&&<p className="empty">No event packages are available yet. Contact the platform administrator to purchase a package.</p>}
 </section>;
}
