import {useState} from 'react';
function ColorControl({label,value,onChange}){
 const [draft,setDraft]=useState(null);
 const hex=draft?.source===value?draft.hex:value;
 const update=next=>{setDraft({source:value,hex:next});if(/^#[0-9a-f]{6}$/i.test(next)&&next.toLowerCase()!==value.toLowerCase())onChange(next.toLowerCase());};
 return <label>{label}<span className="ticket-color-control"><input aria-label={label} type="color" value={value} onInput={e=>update(e.target.value)} onChange={e=>update(e.target.value)}/><input aria-label={`${label} hex`} value={hex} maxLength={7} spellCheck={false} onChange={e=>update(e.target.value)} onBlur={()=>setDraft(null)}/></span></label>;
}
export default function TicketElementStyle({value={},currentColor,currentBackground,text,line,background,badge,onChange}){
 const [open,setOpen]=useState(false);
 const change=patch=>onChange({...value,...patch});
 return <span className="ticket-element-style"><button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}>Style</button>{open&&<div className="ticket-style-popover" role="dialog" aria-label="Element style" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();setOpen(false);}}}>
   <header><strong>Element style</strong><button type="button" aria-label="Close element style" onClick={()=>setOpen(false)}>×</button></header>
   {background&&<ColorControl label="Element background" value={value.background||currentBackground||'#f97316'} onChange={background=>change({background})}/>}
   {badge&&<label>Corner radius <input aria-label="Corner radius" type="number" min="0" max="100" defaultValue={value.border_radius??6} onBlur={e=>change({border_radius:Math.max(0,Math.min(100,Number(e.target.value)))})}/></label>}
   {line&&<><ColorControl label="Line color" value={value.color||currentColor||'#c79d56'} onChange={color=>change({color})}/><label>Line style <select aria-label="Line style" value={value.line_style||''} onChange={e=>change({line_style:e.target.value})}><option value="" disabled>Original</option>{['solid','dashed','dotted','double'].map(style=><option key={style}>{style}</option>)}</select></label><label>Thickness <input aria-label="Line thickness" type="number" min="1" max="12" defaultValue={value.line_width||1} onBlur={e=>change({line_width:Math.max(1,Math.min(12,Number(e.target.value)))})}/></label></>}
   {text&&<><ColorControl label="Text color" value={value.color||currentColor||'#ffffff'} onChange={color=>change({color})}/><label>Text size <input aria-label="Text size" type="number" min="6" max="150" placeholder="Original" defaultValue={value.font_size??''} onBlur={e=>{const n=Number(e.target.value);if(n>=6&&n<=150)change({font_size:n});}}/></label><div className="ticket-style-row"><button type="button" aria-pressed={value.weight===700} onClick={()=>change({weight:value.weight===700?400:700})}>Bold</button>{['left','center','right'].map(align=><button type="button" key={align} aria-pressed={value.align===align} onClick={()=>change({align})}>{align}</button>)}</div></>}
   <label>Rotation <input aria-label="Rotation" type="number" min="-180" max="180" defaultValue={value.rotation||0} onBlur={e=>change({rotation:Math.max(-180,Math.min(180,Number(e.target.value)))})}/></label>
   <label>Opacity <input aria-label="Opacity" type="range" min="0" max="100" value={Math.round((value.opacity??1)*100)} onChange={e=>change({opacity:Number(e.target.value)/100})}/></label>
   <div className="ticket-style-row"><button type="button" onClick={()=>change({layer:20})}>Bring to front</button><button type="button" onClick={()=>change({layer:0})}>Send to back</button></div>
 </div>}</span>;
}
