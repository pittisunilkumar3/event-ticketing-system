import {useState} from 'react';
import TicketDesignPreview from './TicketDesignPreview';

export default function TicketDesignGallery({designs,defaultDesign,selectedId,onSelect,event,name,price}) {
 const [search,setSearch]=useState(''),[format,setFormat]=useState('All'),[limit,setLimit]=useState(8);
 const options=[...(defaultDesign?[{id:'',name:'Default ticket design',config:defaultDesign,category:'Horizontal'}]:[]),...designs];
 const filtered=options.filter(t=>(format==='All'||t.category===format)&&t.name.toLowerCase().includes(search.trim().toLowerCase()));
 return <div className="ticket-design-picker" id="ticket-design-picker">
  <label className="ea-field">Search designs<input autoFocus type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(8);}} placeholder="Search by design name"/></label>
  <div className="ticket-collection-tools ticket-picker-formats"><div role="group" aria-label="Filter ticket formats">
   {['All','Horizontal','Portrait','Compact'].map(value=><button key={value} type="button" aria-pressed={format===value} onClick={()=>{setFormat(value);setLimit(8);}}>{value}</button>)}
  </div><span role="status">{filtered.length} {filtered.length===1?'design':'designs'}</span></div>
  <div className="ticket-design-grid" role="group" aria-label="Available ticket designs">
   {filtered.slice(0,limit).map(t=><button type="button" className="ticket-design-card" key={t.id} aria-label={`Select ${t.name}`} aria-pressed={String(selectedId||'')===String(t.id)} onClick={()=>onSelect(t.id)}>
    <TicketDesignPreview design={t.config} category={t.category} event={event} name={name} price={price}/>
    <span className="ticket-design-caption"><strong>{t.name}</strong><span>{String(selectedId||'')===String(t.id)?'✓ Selected':'Select design'}</span></span>
   </button>)}
  </div>
  {!filtered.length&&<p role="status">No designs match your search and format.</p>}
  {filtered.length>limit&&<button type="button" className="ea-button ticket-design-more" onClick={()=>setLimit(n=>n+8)}>Show more designs ({filtered.length-limit} more)</button>}
 </div>;
}
