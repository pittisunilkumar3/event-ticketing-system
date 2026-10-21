import {useEffect,useRef,useState} from 'react';
import textCatalog from '../../../../shared/ticketText.json';

function ComponentIcon({type}) {
  const paths={badge:<><rect x="2" y="6" width="20" height="12" rx="5"/><path d="M7 12h10"/></>,image:<><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></>,text:<><path d="M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3"/></>,qr:<><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3v3h-6z"/></>,divider:<path d="M2 12h3m3 0h3m3 0h3m3 0h2"/>,field:<><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 14h6"/></>};
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]||paths.field}</svg>;
}

export default function TicketComponentPicker({onAdd,onRestore,hidden,disabled,atLimit}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState('');
  const host=useRef(null),trigger=useRef(null),search=useRef(null);
  useEffect(()=>{
    if(!open)return;
    search.current?.focus();
    const close=e=>{if(!host.current?.contains(e.target))setOpen(false);};
    document.addEventListener('pointerdown',close);
    return()=>document.removeEventListener('pointerdown',close);
  },[open]);
  const choices=[{type:'text',name:'Text',description:'Add your own words'},{type:'badge',name:'Button / badge',description:'A label with its own color'},{type:'image',name:'Logo or image',description:'Upload from your device'},{type:'qr',name:'Ticket QR code',description:'Scannable image for entry'},{type:'divider',name:'Dotted divider',description:'Separate ticket sections'}];
  const matches=name=>name.toLowerCase().includes(query.trim().toLowerCase());
  const fields=Object.entries(textCatalog).filter(([,entry])=>entry.token&&matches(entry.label));
  function choose(type){setOpen(false);onAdd(type);}
  return <div ref={host} className="ticket-component-picker" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
    <button ref={trigger} type="button" className="ticket-add-trigger" aria-expanded={open} aria-controls="ticket-component-popover" disabled={disabled} onClick={()=>{setOpen(!open);setQuery('');}}><span aria-hidden="true">＋</span> Add component</button>
    {open&&<section id="ticket-component-popover" className="ticket-component-popover" aria-label="Add component">
      <header><div><strong>Add to your ticket</strong><p>Choose an element to place on the canvas.</p></div><button type="button" aria-label="Close component picker" onClick={()=>{setOpen(false);trigger.current?.focus();}}>×</button></header>
      <input ref={search} type="search" aria-label="Search components" placeholder="Search text, QR, attendee name…" value={query} onChange={e=>setQuery(e.target.value)}/>
      <div className="ticket-picker-scroll">
        {atLimit&&<p role="status">This ticket has 36 added components. Remove one to add another.</p>}
        <div className="ticket-component-tiles">{choices.filter(c=>matches(c.name)).map(c=><button key={c.type} type="button" disabled={disabled||atLimit} onClick={()=>choose(c.type)}><ComponentIcon type={c.type}/><strong>{c.name}</strong><small>{c.description}</small></button>)}</div>
        {fields.length>0&&<><h3>Booking fields <span>Filled automatically</span></h3><div className="ticket-field-tiles">{fields.map(([key,entry])=><button type="button" key={key} disabled={disabled||atLimit} onClick={()=>choose('field_'+key)}><ComponentIcon type="field"/>{entry.label}<span aria-hidden="true">＋</span></button>)}</div></>}
        {hidden.filter(item=>matches(item.label)).length>0&&<><h3>Removed elements</h3><div className="ticket-field-tiles">{hidden.filter(item=>matches(item.label)).map(item=><button type="button" key={item.id} disabled={disabled} onClick={()=>{onRestore(item.id);setOpen(false);}}>Restore {item.label}</button>)}</div></>}
        {!choices.some(c=>matches(c.name))&&!fields.length&&!hidden.some(c=>matches(c.label))&&<p className="ticket-picker-empty">No matching components.</p>}
      </div>
    </section>}
  </div>;
}
