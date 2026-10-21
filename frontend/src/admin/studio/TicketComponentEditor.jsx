import {useEffect,useRef,useState} from 'react';
import {Field, ImageField, Toggle} from './StudioUI';
import {newFrame,ticketExtent,transformFrame,MAX_TICKET_HEIGHT} from '../../components/ticketGeometry';
import catalog from '../../../../shared/ticketBlocks.json';

export default function TicketComponentEditor({config,update,selectedId,onSelect,onTextEdit,onBusy,disabled,onEnableFreeform,onConfigChange}) {
  const [addType,setAddType]=useState('text');
  const [imagesOpen,setImagesOpen]=useState(false);
  const [propertiesOpen,setPropertiesOpen]=useState(false);
  const blocks=config.layout_blocks;
  const block=blocks?.find(item=>item.id===selectedId);
  const settings=useRef(null);
  useEffect(()=>{if(!config.canvas)settings.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[selectedId,config.canvas]);
  const index=blocks?.findIndex(item=>item.id===selectedId) ?? -1;
  function changeBlock(key,value){update('layout_blocks',blocks.map(item=>item.id===selectedId?{...item,[key]:value}:item));}
  function move(delta){const list=[...blocks];[list[index],list[index+delta]]=[list[index+delta],list[index]];update('layout_blocks',list);}
  function add(){
    const item={id:'block_'+crypto.randomUUID(),type:addType,width:100,...(addType==='text'?{text:'Your text'}:{})};
    if(config.canvas){const height=Math.min(MAX_TICKET_HEIGHT,Math.max(config.canvas.height,ticketExtent(blocks)+200));item.frame=newFrame(blocks,addType,height);onConfigChange({...config,canvas:{height},layout_blocks:[...blocks,item]});}
    else update('layout_blocks',[...blocks,item]);
    onSelect(item.id);
  }
  function geometry(key,value){
    const f=block.frame;let next;
    if(key==='x'||key==='y')next=transformFrame(f,'move',key==='x'?value-f.x:0,key==='y'?value-f.y:0,config.canvas.height,block.type);
    else next=transformFrame(f,key==='w'?'e':'s',key==='w'?value-f.w:0,key==='h'?value-f.h:0,config.canvas.height,block.type);
    changeBlock('frame',next);
  }
  const numeric=(label,value,change,min=0,max=64)=><Field label={label}><input type="number" min={min} max={max} value={value} onChange={e=>change(Math.max(min,Math.min(max,Number(e.target.value)||0)))} /></Field>;
  const align=(value,change)=><Field label="Alignment"><select value={value||'left'} onChange={e=>change(e.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></Field>;
  const logoStyle=config.logo_style||{};
  function logoSetting(key,value){update('logo_style',{...logoStyle,[key]:value});}
  const labelKey={date:'date_label',time:'time_label',venue:'venue_label',attendee_name:'attendee_label',price:'price_label',booking_ref:'booking_label',qr:'scan_label'}[block?.type];
  return <fieldset className="ticket-component-controls" disabled={disabled}>
    <div className="ticket-component-toolbar">
      <button type="button" className="studio-button" onClick={()=>setImagesOpen(!imagesOpen)}>Logos & banner</button>
      {!config.canvas&&<button type="button" className="studio-button primary" onClick={()=>onEnableFreeform()}>Drag & resize</button>}
      <button type="button" className="studio-text-button" onClick={()=>onEnableFreeform(true)}>Blank ticket</button>
      {blocks&&<>
        <Field label="Add component"><select value={addType} onChange={e=>setAddType(e.target.value)}>{Object.entries(catalog.types).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
        <button type="button" className="studio-button" disabled={blocks.length>=36} onClick={add}>Add component</button>
        <button type="button" className="studio-text-button" onClick={()=>{if(window.confirm('Return to the original layout? Your component arrangement will be removed.')){update('layout_blocks',null);onSelect(null);}}}>Use original layout</button>
      </>}
    </div>
    {imagesOpen&&<section className="ticket-component-panel" aria-label="Ticket images">
      <div className="studio-two-col"><ImageField label="Main logo" value={config.logo} onChange={value=>update('logo',value)} onBusy={onBusy}/><ImageField label="Event banner" value={config.banner_image} onChange={value=>update('banner_image',value)} onBusy={onBusy}/></div>
      {!blocks&&config.banner_image&&<Toggle label="Show the full banner" checked={config.full_banner===true} onChange={value=>update('full_banner',value)}/>}
      <div className="studio-two-col">{(config.logos||[]).map((logo,i)=><div key={i}>
        <ImageField label={`Partner logo ${i+1}`} value={logo} onBusy={onBusy} onChange={value=>update('logos',(config.logos||[]).map((old,n)=>n===i?value:old))}/>
        <div className="ticket-component-toolbar">
          <button type="button" className="studio-text-button" disabled={i===0} onClick={()=>{const list=[...config.logos];[list[i-1],list[i]]=[list[i],list[i-1]];update('logos',list);}}>Move left</button>
          <button type="button" className="studio-text-button" disabled={i===config.logos.length-1} onClick={()=>{const list=[...config.logos];[list[i+1],list[i]]=[list[i],list[i+1]];update('logos',list);}}>Move right</button>
          <button type="button" className="studio-text-button" onClick={()=>update('logos',config.logos.filter((_,n)=>n!==i))}>Delete logo {i+1}</button>
        </div>
      </div>)}</div>
      {(config.logos||[]).length<6&&<button type="button" className="studio-button" onClick={()=>update('logos',[...(config.logos||[]),''])}>Add partner logo</button>}
      <div className="ticket-component-grid">
        {!blocks&&align(logoStyle.align,value=>logoSetting('align',value))}
        {numeric('Logo height (px)',logoStyle.size??44,value=>logoSetting('size',value),24,96)}
        {numeric('Logo gap (px)',logoStyle.gap??8,value=>logoSetting('gap',value),0,40)}
        {numeric('Space above logos (px)',logoStyle.margin_top??0,value=>logoSetting('margin_top',value))}
        {numeric('Space below logos (px)',logoStyle.margin_bottom??0,value=>logoSetting('margin_bottom',value))}
      </div>
      <button type="button" className="studio-button" onClick={()=>setImagesOpen(false)}>Done with images</button>
    </section>}
    {blocks&&<details className="ticket-layer-controls"><summary>Layers & ticket size</summary>
    {config.canvas&&<div className="ticket-component-toolbar">
      {numeric('Ticket height (px)',config.canvas.height,value=>update('canvas',{height:Math.max(ticketExtent(blocks),value)}),240,MAX_TICKET_HEIGHT)}
      <button type="button" className="studio-button" disabled={config.canvas.height>=MAX_TICKET_HEIGHT} onClick={()=>update('canvas',{height:Math.min(MAX_TICKET_HEIGHT,config.canvas.height+200)})}>Extend ticket</button>
    </div>}
    {blocks&&<Field label="Select component"><select value={selectedId||''} onChange={e=>onSelect(e.target.value)}><option value="">Click a component in the preview</option>{blocks.map((item,i)=><option key={item.id} value={item.id}>{i+1}. {catalog.types[item.type]}</option>)}</select></Field>}
    </details>}
    {block&&config.canvas&&<button type="button" className="studio-button" onClick={()=>setPropertiesOpen(!propertiesOpen)}>Component settings</button>}
    {block&&(!config.canvas||propertiesOpen)&&<section ref={settings} className={`ticket-component-panel ${config.canvas?'ticket-floating-properties':''}`} aria-label={`${catalog.types[block.type]} component settings`}>
      {config.canvas&&<button type="button" className="studio-text-button" onClick={()=>setPropertiesOpen(false)}>Close component settings</button>}
      <div className="ticket-component-toolbar"><strong>{catalog.types[block.type]}</strong><button type="button" className="studio-button" onClick={()=>move(-1)} disabled={index===0}>{config.canvas?'Send backward':'Move up'}</button><button type="button" className="studio-button" onClick={()=>move(1)} disabled={index===blocks.length-1}>{config.canvas?'Bring forward':'Move down'}</button><button type="button" className="studio-text-button" disabled={!config.canvas&&blocks.length===1} onClick={()=>{update('layout_blocks',blocks.filter(item=>item.id!==selectedId));onSelect(null);}}>Delete component</button></div>
      {block.type==='text'&&<Field label="Text"><textarea rows={3} maxLength={1000} value={block.text||''} onChange={e=>changeBlock('text',e.target.value)}/></Field>}
      {['heading','event_title','ticket_type','date','time','venue','attendee_name','price','booking_ref','ticket_code','serial','footer'].includes(block.type)&&<button type="button" className="studio-button" onClick={e=>onTextEdit(block.type,e.currentTarget)}>Edit text</button>}
      {labelKey&&<button type="button" className="studio-button" onClick={e=>onTextEdit(labelKey,e.currentTarget)}>Edit label</button>}
      {block.type==='date_chip'&&['day','month','year'].map(name=><button key={name} type="button" className="studio-button" onClick={e=>onTextEdit(name,e.currentTarget)}>Edit {name}</button>)}
      {block.type==='logos'&&!config.logo&&<button type="button" className="studio-button" onClick={e=>onTextEdit('brand',e.currentTarget)}>Edit brand text</button>}
      {['logos','banner','main_logo','partner_logo'].includes(block.type)&&<button type="button" className="studio-button" onClick={()=>setImagesOpen(true)}>Edit images</button>}
      {block.type==='partner_logo'&&<Field label="Partner logo"><select value={block.partner_index||0} onChange={e=>changeBlock('partner_index',Number(e.target.value))}>{Array.from({length:6},(_,i)=><option key={i} value={i}>Partner logo {i+1}</option>)}</select></Field>}
      <div className="ticket-component-grid">
        {config.canvas?['x','y','w','h'].map((key,i)=><div key={key}>{numeric(['Left (px)','Top (px)','Width (px)','Height (px)'][i],block.frame[key],value=>geometry(key,value),0,key==='x'||key==='w'?760:6000)}</div>):<Field label="Width"><select value={block.width||100} onChange={e=>changeBlock('width',Number(e.target.value))}><option value={100}>Full width</option><option value={50}>Half width</option><option value={25}>Quarter width</option></select></Field>}
        {align(block.align,value=>changeBlock('align',value))}
        {!config.canvas&&block.type==='qr'&&numeric('QR size (px)',block.qr_size??112,value=>changeBlock('qr_size',value),72,240)}
        {numeric('Padding (px)',block.padding??12,value=>changeBlock('padding',value),0,48)}
        {!config.canvas&&['margin_top','margin_bottom','margin_left','margin_right'].map(key=><div key={key}>{numeric(key.replace('margin_','Margin ')+' (px)',block[key]??0,value=>changeBlock(key,value))}</div>)}
        {!['banner','logos','main_logo','partner_logo','qr','barcode'].includes(block.type)&&<Field label="Text size (px)"><input type="number" placeholder="Default" min={8} max={64} value={block.font_size??''} onChange={e=>changeBlock('font_size',e.target.value===''?null:Math.max(8,Math.min(64,Number(e.target.value))))}/></Field>}
      </div>
    </section>}
    {blocks&&!config.canvas&&!blocks.some(item=>item.type==='qr')&&<small>QR code is hidden. Add a QR code component to show it again.</small>}
  </fieldset>;
}
