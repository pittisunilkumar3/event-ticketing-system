import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import themes from '../../../shared/eventThemes.json';
import {EventPageView} from '../pages/EventDetail';
import './eventThemePicker.css';

export default function EventThemePicker({value,onChange,event,ticketTypes=[]}) {
 const [preview,setPreview]=useState(null);
 return <section className="ea-panel event-theme-picker">
  <header><h2>04 · Event page theme</h2></header>
  <div className="ea-panel-body"><p className="ea-hint">Choose a look for this event. Preview it, then save the event to publish your choice.</p>
   <div className="event-theme-options" role="radiogroup" aria-label="Event page theme">
    {themes.map(theme=><div className={'event-theme-option'+(value===theme.id?' is-selected':'')} key={theme.id}>
     <label><input type="radio" name="page_theme" value={theme.id} checked={value===theme.id} onChange={()=>onChange(theme.id)}/>
      <div className={'event-theme-thumbnail thumb-'+theme.id} aria-hidden="true"><div className="theme-thumb-cover">{event.banner_image&&<img src={event.banner_image} alt=""/>}<span>{event.title||'Your event'}</span></div><div className="theme-thumb-cards"><i/><i/><i/></div></div>
      <strong>{theme.name}{value===theme.id&&<small>Selected</small>}</strong><span>{theme.description}</span>
     </label><button className="ea-button" type="button" onClick={()=>setPreview(theme)}>Preview {theme.name}</button>
    </div>)}
   </div>
  </div>
  {preview&&<ThemePreview theme={preview} event={event} ticketTypes={ticketTypes} onClose={()=>setPreview(null)} onUse={()=>{onChange(preview.id);setPreview(null);}}/>}
 </section>;
}
function ThemePreview({theme,event,ticketTypes,onClose,onUse}) {
 const dialog=useRef(null);
 useEffect(()=>{const element=dialog.current;const previous=document.activeElement;const overflow=document.body.style.overflow;element.showModal();document.body.style.overflow='hidden';return()=>{element.close();document.body.style.overflow=overflow;previous?.focus();};},[]);
 const data={event:{...event,title:event.title||'Your event',start_datetime:event.start_datetime||'2030-01-01 10:00:00',page_theme:theme.id},ticketTypes};
 return createPortal(<dialog ref={dialog} className="event-theme-dialog" aria-labelledby="theme-preview-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <header><div><h2 id="theme-preview-title">{theme.name} preview</h2><p>Preview only · Save the event to apply your selection.</p></div><div><button type="button" className="ea-button primary" onClick={onUse}>Use this theme</button><button type="button" className="ea-button" onClick={onClose} autoFocus>Close preview</button></div></header>
  <div className="event-theme-preview-scroll" tabIndex={0} aria-label="Event page preview"><div inert><EventPageView data={data}/></div></div>
 </dialog>,document.body);
}
