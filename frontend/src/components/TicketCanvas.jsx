import {TicketExtras} from './TicketPresentation';
import {TicketDataContext,resolveTicketText} from './ticketVariables';
import {useContext,useEffect,useRef,useState} from 'react';
import {TICKET_WIDTH,MAX_TICKET_HEIGHT,transformFrame,ticketExtent} from './ticketGeometry';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate, formatTime, formatCurrency } from '../utils/format';
import TicketText, {TicketTextContext} from './TicketText';
import TicketLogos from './TicketLogos';
import catalog from '../../../shared/ticketBlocks.json';
import './ticketCanvas.css';

export default function TicketCanvas({design, ticket={}, order={}, preview=false, onBlockSelect, selectedBlock, onBlockChange, onBlockDelete, onCanvasHeight}) {
  const booking=useContext(TicketDataContext);
  const wrapper=useRef(null), canvasRef=useRef(null), gesture=useRef(null);
  const [scale,setScale]=useState(1), [draft,setDraft]=useState(null);
  const free=Boolean(design.canvas), height=draft?.canvasHeight??design.canvas?.height;
  useEffect(()=>{
    if(!free||!wrapper.current)return;
    const resize=()=>setScale(wrapper.current.clientWidth/TICKET_WIDTH);
    resize();const observer=new ResizeObserver(resize);observer.observe(wrapper.current);
    return ()=>observer.disconnect();
  },[free]);
  function startDrag(event,block,edge) {
    if(event.button!==0||!free||!onBlockChange)return;
    event.preventDefault();event.stopPropagation();event.currentTarget.focus({preventScroll:true});
    if(block)onBlockSelect?.(block.id);
    gesture.current={id:block?.id,frame:block?.frame,type:block?.type,edge,x:event.clientX,y:event.clientY,height,
      scale:canvasRef.current.getBoundingClientRect().width/TICKET_WIDTH,font:block?parseFloat(getComputedStyle(event.currentTarget.closest('[data-block-id]')).fontSize):null};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function drag(event) {
    const g=gesture.current;if(!g)return;
    const dx=(event.clientX-g.x)/g.scale,dy=(event.clientY-g.y)/g.scale;
    const next=g.edge==='ticket'?{canvasHeight:Math.round(Math.max(ticketExtent(design.layout_blocks),Math.min(MAX_TICKET_HEIGHT,g.height+dy)))}:
      {id:g.id,frame:transformFrame(g.frame,g.edge,dx,dy,g.height,g.type)};
    if(next.frame&&['nw','ne','sw','se'].includes(g.edge)&&!['logos','main_logo','partner_logo','banner','qr','barcode'].includes(g.type))next.font_size=Math.max(8,Math.min(64,Math.round(g.font*Math.min(next.frame.w/g.frame.w,next.frame.h/g.frame.h))));
    g.latest=next;setDraft(next);
  }
  function endDrag(event,cancel=false) {
    const g=gesture.current;if(!g)return;
    const latest=g.latest;
    if(!cancel&&latest){if(g.edge==='ticket')onCanvasHeight?.(latest.canvasHeight);else onBlockChange(g.id,{frame:latest.frame,...(latest.font_size?{font_size:latest.font_size}:{})});}
    gesture.current=null;setDraft(null);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyMove(event,block,edge='move') {
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();gesture.current=null;setDraft(null);return;}
    if((event.key==='Delete'||event.key==='Backspace')&&onBlockDelete){event.preventDefault();onBlockDelete(block.id);return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(!delta||!onBlockChange)return;
    event.preventDefault();const step=event.shiftKey?10:1;
    onBlockChange(block.id,{frame:transformFrame(block.frame,edge,delta[0]*step,delta[1]*step,height,block.type)});
  }
  const dragEvents=block=>({onPointerMove:drag,onPointerUp:event=>endDrag(event),onPointerCancel:event=>endDrag(event,true),onKeyDown:event=>keyMove(event,block)});
  const start=order.event_start || (preview?'2026-12-12 18:00:00':null);
  const date=start?new Date(String(start).replace(' ','T')):null;
  const values={event_title:order.event_title||'Cinematica · An evening of possibilities',ticket_type:design.type_name||ticket.type_name||'VIP Experience',
    date:start?formatDate(start):'Date to be confirmed',time:start?formatTime(start):'Time to be confirmed',venue:[order.venue||'Main Exhibition Hall',order.city].filter(Boolean).join(', '),
    attendee_name:ticket.attendee_name||order.customer_name||(preview?'Alex Morgan':'Guest'),price:formatCurrency(design.price??ticket.price??60,order.currency||design.currency||'INR'),
    booking_ref:order.booking_ref||'TKT-PREVIEW',ticket_code:preview?'PREVIEW ONLY':ticket.ticket_code,serial:preview?'000042':String(ticket.id||0).padStart(6,'0')};
  const labels={date:'date_label',time:'time_label',venue:'venue_label',attendee_name:'attendee_label',price:'price_label',booking_ref:'booking_label'};
  const bg=design.background||'#111111';
  const rgb=bg.slice(1).match(/../g)?.map(v=>parseInt(v,16))||[17,17,17];
  const ink=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>155?'#171717':'#ffffff';
  function content(block) {
    const type=block.type;
    if(type==='main_logo'||type==='partner_logo'){const src=type==='main_logo'?design.logo:design.logos?.[block.partner_index||0];return src?<img data-ticket-part={type==='main_logo'?'main_logo':`partner_${block.partner_index||0}`} className="canvas-single-logo" src={src} alt={type==='main_logo'?(design.brand||'Main logo'):'Partner logo'}/>:onBlockSelect?<span>Upload {type==='main_logo'?'main':'partner'} logo</span>:null;}
    if(type==='logos')return <TicketLogos design={{...design,logo_style:{...design.logo_style,align:block.align||'left'}}}/>;
    if(type==='banner')return design.banner_image?<img data-ticket-part="banner" className="canvas-banner" src={design.banner_image} alt="Event banner"/>:onBlockSelect?<span>Upload a banner</span>:null;
    if(type==='qr')return <div className="canvas-qr"><small><TicketText name="scan_label"/></small><QRCodeSVG data-ticket-part="qr" value={preview?'PREVIEW-NOT-A-VALID-TICKET':ticket.ticket_code||'INVALID'} size={block.qr_size || 112} level="M" marginSize={2} bgColor="#fff" fgColor="#111"/></div>;
    if(type==='status')return <span>{preview?'DESIGN PREVIEW':String(ticket.status||'valid').replace('_',' ').toUpperCase()}</span>;
    if(type==='barcode')return <span className="ticket-barcode" aria-label="Decorative barcode"/>;
    if(type==='date_chip')return <div className="canvas-date"><strong><TicketText name="day">{date?String(date.getDate()).padStart(2,'0'):'—'}</TicketText></strong><span><TicketText name="month">{date?date.toLocaleString('en-US',{month:'short'}).toUpperCase():'—'}</TicketText> <TicketText name="year">{date?date.getFullYear():''}</TicketText></span></div>;
    if(type==='text')return <div className="canvas-custom-text">{resolveTicketText(block.text || (onBlockSelect?'Your text':''),booking)}</div>;
    return <>{labels[type]&&<small><TicketText name={labels[type]}/></small>}<div><TicketText name={type}>{values[type]}</TicketText></div></>;
  }
  const ticketNode=<article ref={canvasRef} className={`designed-ticket ticket-canvas ${free?'ticket-freeform':''} ${ticket.status==='cancelled'?'ticket-void':''}`} style={{'--canvas-bg':bg,'--canvas-ink':ink,'--canvas-accent':design.accent||'#f97316',...(free?{width:TICKET_WIDTH,height,transform:`scale(${scale})`}:{})}}>
    {ticket.status==='cancelled'&&<span className="ticket-void-stamp">VOID</span>}
    {design.layout_blocks.map(original=>{
      const block=draft?.id===original.id?{...original,frame:draft.frame,...(draft.font_size?{font_size:draft.font_size}:{})}:original;
      return <section data-ticket-part={`block_${block.id}`} data-block-id={block.id} key={block.id} className={`ticket-canvas-block canvas-${block.type} ${selectedBlock===block.id?'canvas-selected':''}`} style={{
        '--block-span':12/(100/(block.width||100)),textAlign:block.align||'left',padding:block.padding??12,
        ...(free?{left:block.frame.x,top:block.frame.y,width:block.frame.w,height:block.frame.h}:{marginTop:block.margin_top||0,marginBottom:block.margin_bottom||0,marginLeft:block.margin_left||0,marginRight:block.margin_right||0}),
        ...(block.font_size?{fontSize:block.font_size}:{}),
      }}>
        <div className="canvas-content">{content(block)}</div>
        {onBlockSelect&&<button type="button" className="canvas-select" aria-label={`Edit ${catalog.types[block.type]} component`} onClick={()=>onBlockSelect(block.id)}
          {...(free?{...dragEvents(block),onPointerDown:event=>startDrag(event,block,'move')}: {})}><span>{catalog.types[block.type]}</span></button>}
        {free&&onBlockChange&&selectedBlock===block.id&&<>
          {['nw','n','ne','e','se','s','sw','w'].map(edge=><button key={edge} type="button" className={`canvas-handle handle-${edge}`} aria-label={`Resize ${catalog.types[block.type]} ${edge}`} onPointerDown={event=>startDrag(event,block,edge)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={event=>endDrag(event,true)} onKeyDown={event=>keyMove(event,block,edge)}/>)}
          <button type="button" className="canvas-delete" aria-label={`Delete ${catalog.types[block.type]} component`} onClick={()=>onBlockDelete?.(block.id)}>×</button>
        </>}
      </section>;
    })}
    {free&&onCanvasHeight&&<button type="button" className="canvas-extend" aria-label="Resize ticket height" onPointerDown={event=>startDrag(event,null,'ticket')} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={event=>endDrag(event,true)} onKeyDown={event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();onCanvasHeight(Math.max(ticketExtent(design.layout_blocks),Math.min(MAX_TICKET_HEIGHT,height+(event.key==='ArrowDown'?20:-20))));}}}>↕</button>}
    <TicketExtras design={design} ticket={ticket} order={order} preview={preview}/>
  </article>;
  return <TicketTextContext.Provider value={{design}}>{free?<div className="ticket-freeform-wrap" ref={wrapper} style={{aspectRatio:`${TICKET_WIDTH} / ${height}`}}>{ticketNode}</div>:ticketNode}</TicketTextContext.Provider>;
}
