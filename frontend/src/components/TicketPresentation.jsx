import {ticketSize} from './ticketSize';
import {TicketDataContext,resolveTicketText} from './ticketVariables';
import {useContext,useId,useRef,useState,useLayoutEffect} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import './ticketPresentation.css';
import {formatDate,formatTime,formatCurrency} from '../utils/format';
import TicketText,{TicketTextContext} from './TicketText';

// Adjust original elements without rebuilding the selected layout or moving its neighbours.
export default function TicketPresentation({design,children}) {
  const id='ticket_'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const size=ticketSize(design.ticket_size),outer=useRef(null);
  const [measuredWidth,setMeasuredWidth]=useState(null);
  const scaled=Boolean(size?.contentWidth&&size?.contentHeight),baseWidth=scaled?size.contentWidth:size?.width,baseHeight=scaled?size.contentHeight:size?.height;
  const scale=scaled?(measuredWidth||size.width)/baseWidth:1;
  useLayoutEffect(()=>{if(!scaled)return;const node=outer.current,observer=new ResizeObserver(()=>setMeasuredWidth(node.clientWidth));setMeasuredWidth(node.clientWidth);observer.observe(node);return()=>observer.disconnect();},[scaled]);
  const sizeRule=scaled?`#${id} .designed-ticket{width:${baseWidth}px;max-width:none;margin:0;height:${baseHeight}px;min-height:0;}`:size?`#${id} .designed-ticket{width:100%;max-width:none;height:${baseHeight/baseWidth*100}cqw;min-height:0;}`:'';
  const appearanceRule=/^#[0-9a-f]{6}$/i.test(design.card_background)?`#${id} .designed-ticket{background:${design.card_background}!important;}`:'';
  const badgeRule=design.element_adjustments?.text_ticket_type?.hidden?`#${id} .ticket-type-label,#${id} .ct-type{visibility:hidden!important;}`:'';
  const rules=Object.entries(design.element_adjustments||{}).filter(([key])=>/^[a-zA-Z0-9_]+$/.test(key)).map(([key,value])=>{
    const badge=key==='section_pass'||design.extra_elements?.some(e=>e.id===key&&e.type==='badge');
    const n=(v,f)=>Number.isFinite(v)?v:f;
    const moved=value.rotation||value.x||value.y||(value.sx??1)!==1||(value.sy??1)!==1;
    const hasLine=value.line_style||value.line_width||value.color;
    const lineStyle=['solid','dashed','dotted','double'].includes(value.line_style)?value.line_style:'dashed';
    const lineWidth=Math.min(12,Math.max(1,n(value.line_width,1)));
    const lineColor=/^#[0-9a-f]{6}$/i.test(value.color)?value.color:'currentColor';
    const lineRules=hasLine&&(key==='divider'||design.extra_elements?.some(e=>e.id===key&&e.type==='divider'))?`#${id} [data-ticket-part="${key}"]${key.startsWith('extra_')?' > .ticket-extra-line':''}{background:none;border:0;border-${value.line_axis==='vertical'?'left':'top'}:${lineWidth}px ${lineStyle} ${lineColor};${value.line_axis==='vertical'?'top:0;left:50%;width:0;height:100%;':''}}`:hasLine&&key==='divider_qr'?`#${id} [data-ticket-part="divider_qr"]{border:0;border-${value.line_axis==='horizontal'?'top':'left'}:${lineWidth}px ${lineStyle} ${lineColor};}`:'';
    const groupColor=key.startsWith('section_')&&/^#[0-9a-f]{6}$/i.test(value.color)?`#${id} [data-ticket-part="${key}"] ticket-text{color:${value.color}!important;}`:'';
    return lineRules+groupColor+`#${id} [data-ticket-part="${key}"]:not(.ticket-extra *){${value.hidden?'visibility:hidden!important;':''}${moved?`${key.startsWith('section_')||badge||key==='qr'?'':'display:inline-block;'}transform-origin:top left;transform:translate(${n(value.x,0)}cqw,${n(value.y,0)}cqw) scale(${n(value.sx,1)},${n(value.sy,1)}) rotate(${n(value.rotation,0)}deg);z-index:2;`:''}${/^#[0-9a-f]{6}$/i.test(value.color)?`color:${value.color}!important;`:''}${/^#[0-9a-f]{6}$/i.test(value.background)?`background:${value.background}!important;${badge?'box-shadow:none;':''}`:''}${Number.isFinite(value.border_radius)?`border-radius:${value.border_radius}px!important;`:''}${Number.isFinite(value.box_width)?`width:${value.box_width}cqw!important;max-width:none;box-sizing:border-box;`:''}${Number.isFinite(value.box_height)?`height:${value.box_height}cqw!important;min-height:${value.box_height}cqw!important;flex-shrink:0;box-sizing:border-box;`:''}${Number.isFinite(value.font_size)?`font-size:${value.font_size}px!important;`:''}${[400,700].includes(value.weight)?`font-weight:${value.weight}!important;`:''}${['left','center','right'].includes(value.align)?`text-align:${value.align};${badge?'':'display:block;'}`:''}${Number.isFinite(value.opacity)?`opacity:${value.opacity};`:''}${Number.isFinite(value.layer)?`${key.startsWith('text_')?'position:relative;':''}z-index:${value.layer};`:''}}`;
  }).join('\n');
  return <div ref={outer} id={id} className="ticket-presentation" style={scaled?{height:baseHeight*scale,overflow:'clip'}:undefined}>
    {(rules||sizeRule||appearanceRule||badgeRule)&&<style>{sizeRule+appearanceRule+badgeRule+rules+(rules?`#${id} .ticket-design-header{overflow:visible;}`:'')}</style>}{scaled?<div className="ticket-scale-surface" style={{width:size.referenceWidth||baseWidth,height:baseHeight,zoom:scale}}>{children}</div>:children}
  </div>;
}

export function TicketExtras({design,ticket={},order={},preview}) {
  const booking=useContext(TicketDataContext);
  const start=order.event_start||(preview?'2026-12-12 18:00:00':null),date=start?new Date(String(start).replace(' ','T')):null;
  const values={event_title:order.event_title||'Cinematica · An evening of possibilities',ticket_type:design.type_name||ticket.type_name||'VIP Experience',attendee_name:ticket.attendee_name||order.customer_name||(preview?'Alex Morgan':'Guest'),venue:[order.venue||'Main Exhibition Hall',order.city].filter(Boolean).join(', '),price:formatCurrency(design.price??ticket.price??60,order.currency||design.currency||'INR'),booking_ref:order.booking_ref||'TKT-PREVIEW',ticket_code:preview?'TCK-PREVIEW-000042':ticket.ticket_code,serial:preview?'000042':String(ticket.id||0).padStart(6,'0'),date:start?formatDate(start):'Date to be confirmed',time:start?formatTime(start):'Time to be confirmed',day:date?String(date.getDate()).padStart(2,'0'):'—',month:date?date.toLocaleString('en-US',{month:'short'}).toUpperCase():'—',year:date?date.getFullYear():''};
  return <>{(design.extra_elements||[]).map(item=><div key={item.id} data-ticket-part={item.id} className={`ticket-extra ticket-extra-${item.type}`} style={{left:`${item.x}%`,top:`${item.y}%`,width:`${item.w}%`,height:`${item.h}%`,color:item.color||'#ffffff',...(item.type==='badge'?{background:design.accent||'#f97316'}:{}),fontSize:`${item.font_size/7.6}cqw`,...copiedAppearance(item.appearance)}}>
      {item.type==='divider'?<span className="ticket-extra-line"/>:item.type==='image'?<img src={item.src} alt={item.label||'Ticket image'} style={item.appearance?.object_fit?{objectFit:item.appearance.object_fit}:undefined}/>:item.type==='qr'?<QRCodeSVG value={preview?'PREVIEW-NOT-A-VALID-TICKET':ticket.ticket_code||'INVALID'} size={120} level="M" marginSize={item.appearance?.qr_margin??4} fgColor={item.appearance?.qr_margin!=null?'#111111':'#000000'}/>:item.type==='field'?<TicketTextContext.Provider value={{design,extra:true}}><TicketText name={item.field}>{values[item.field]}</TicketText></TicketTextContext.Provider>:resolveTicketText(item.text,booking)}
    </div>)}
  </>;
}

function copiedAppearance(a={}) {
  return {boxSizing:'border-box',fontFamily:{body:'Inter, Arial, sans-serif',display:'"Plus Jakarta Sans", Arial, sans-serif',mono:'monospace'}[a.font],fontWeight:a.weight,lineHeight:a.line_height,letterSpacing:a.letter_spacing,fontStyle:a.font_style,textTransform:a.text_transform,textAlign:a.align,...(a.padding_x!=null?{paddingLeft:a.padding_x,paddingRight:a.padding_x}:{}),...(a.padding_y!=null?{paddingTop:a.padding_y,paddingBottom:a.padding_y}:{})};
}
