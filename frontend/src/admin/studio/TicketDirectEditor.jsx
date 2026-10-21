import {snapTicketMove} from './ticketAlignment';
import {componentKind,pasteTicketComponent} from './ticketClipboard';
import {ticketTextSource} from '../../components/TicketText';
import {TicketFormContext} from './TicketVariablePicker';
import {useContext,useLayoutEffect,useRef,useState} from 'react';
import {ticketSize,scaleTicket,resizeTicketAxis} from '../../components/ticketSize';
import TicketTextComposer from './TicketTextComposer';
import TicketElementStyle from './TicketElementStyle';
import TicketComponentPicker from './TicketComponentPicker';
import DesignedTicket from '../../components/DesignedTicket';
import api from '../../api/client';
import textCatalog from '../../../../shared/ticketText.json';
import mediaCatalog from '../../../../shared/ticketElements.json';
const normal={x:0,y:0,sx:1,sy:1};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const round=n=>Math.round(n*10000)/10000;
const colorHex=value=>{const channels=value?.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);return channels?'#'+channels.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):undefined;};

export default function TicketDirectEditor({config,onChange,onTextEdit,disabled,onBusy}) {
  const {sample}=useContext(TicketFormContext);
  const [guides,setGuides]=useState([]);
  const [clipboard,setClipboard]=useState(null),pasteCount=useRef(0);
  const fitted=useRef(false),viewport=useRef(null),root=useRef(null),gesture=useRef(null),fileInput=useRef(null),uploadTarget=useRef(null);
  const [zoom,setZoom]=useState(1),[height,setHeight]=useState(600),[sizeDraft,setSizeDraft]=useState(null),[cardBox,setCardBox]=useState(null),[pan,setPan]=useState({x:0,y:0});
  const [selected,setSelected]=useState(null),[draft,setDraft]=useState(null),[box,setBox]=useState(null),[error,setError]=useState(''),[customText,setCustomText]=useState(null),[footerBox,setFooterBox]=useState(null);
  const size=sizeDraft||ticketSize(config.ticket_size),width=size?.width||760;
  const design={...config,...(size?{ticket_size:size}:{}),...(draft?{element_adjustments:{...config.element_adjustments,[selected]:draft}}:{})};
  const label=id=>id==='card'?'Ticket size':id?.startsWith('text_')?textCatalog[id.slice(5)]?.label:mediaCatalog[id]||(id?.startsWith('block_')?'Ticket component':null)||extraLabel(id)||'Component';
  function extraLabel(id){const item=config.extra_elements?.find(e=>e.id===id);return item?.type==='qr'?'Ticket QR code':item?.type==='field'?textCatalog[item.field]?.label:item?.label;}
  function partFromTarget(target){return target.closest('[data-ticket-part="section_pass"]')|| target.closest('.ticket-extra')||target.closest('[data-ticket-part]:not([data-ticket-part^="section_"])')||target.closest('h2,strong,small,p,code')?.querySelector('[data-ticket-part]')||target.closest('[data-ticket-part]');}
  function nodeFor(id){if(id==='card')return root.current?.querySelector('.designed-ticket');return [...(root.current?.querySelectorAll('[data-ticket-part]')||[])].find(n=>n.dataset.ticketPart===id);}
  useLayoutEffect(()=>{
    const measure=()=>{
      const node=nodeFor(selected),container=root.current;
      if(!node||!container){setBox(null);return;}
      const r=node.getBoundingClientRect(),p=container.getBoundingClientRect();
      const style=getComputedStyle(node),textStyle=getComputedStyle(node.querySelector('ticket-text')||node);
      setBox({color:colorHex(textStyle.color),background:colorHex(style.backgroundColor),parentId:node.parentElement.closest('[data-ticket-part^="section_"]')?.dataset.ticketPart,left:(r.left-p.left)/zoom,top:(r.top-p.top)/zoom,width:r.width/zoom,height:r.height/zoom});
    };
    measure();const observer=new ResizeObserver(measure);if(root.current)observer.observe(root.current);
    return()=>observer.disconnect();
  },[selected,config,draft,sizeDraft,zoom]);
  useLayoutEffect(()=>{const measure=()=>{setHeight(root.current?.offsetHeight||600);const c=nodeFor('card')?.getBoundingClientRect(),r=root.current?.getBoundingClientRect();if(c&&r)setCardBox({left:(c.left-r.left)/zoom,top:(c.top-r.top)/zoom,width:c.width/zoom,height:c.height/zoom});const f=nodeFor('section_footer')?.getBoundingClientRect();setFooterBox(f&&r?{left:(f.left-r.left)/zoom,top:(f.top-r.top)/zoom,width:f.width/zoom,height:f.height/zoom}:null);};measure();const observer=new ResizeObserver(measure);if(root.current)observer.observe(root.current);return()=>observer.disconnect();},[zoom,config,sizeDraft,draft]);
  function fit(){setPan({x:0,y:0});const area=viewport.current;if(area)setZoom(Math.min(1,Math.max(.25,(area.clientWidth-96)/width),Math.max(.25,(area.clientHeight-128)/height)));}
  useLayoutEffect(()=>{const area=viewport.current;const fitOnce=()=>{if(area?.clientWidth>100&&!fitted.current){fitted.current=true;setZoom(Math.min(1,Math.max(.25,(area.clientWidth-96)/width),Math.max(.25,(area.clientHeight-128)/(root.current?.offsetHeight||600))));}};const observer=new ResizeObserver(fitOnce);if(area)observer.observe(area);fitOnce();return()=>observer.disconnect();},[width]);
  function adjust(id,value){onChange(c=>({...c,element_adjustments:{...c.element_adjustments,[id]:value}}));}
  function copy(){
    const type=componentKind(selected,config),node=nodeFor(selected);
    if(disabled||!type||!node)return null;
    const extra=config.extra_elements?.find(e=>e.id===selected);
    let data;
    if(extra){data={item:structuredClone(extra),adjustment:structuredClone(config.element_adjustments?.[selected]||{})};if(extra.type==='field'){data.item.type='text';data.item.text=ticketTextSource(config,extra.field);delete data.item.field;}}
    else {
      const card=nodeFor('card'),r=node.getBoundingClientRect(),p=card.getBoundingClientRect();
      const style=getComputedStyle(node),textNode=node.querySelector('ticket-text')||node,textStyle=getComputedStyle(textNode);
      const scale=p.width/card.offsetWidth,unit=(root.current.querySelector('.ticket-scale-surface')||root.current.querySelector('.ticket-presentation')).getBoundingClientRect().width/scale/100;
      let matrix=new DOMMatrix(),opacity=1;
      for(let n=node;n&&n!==card;n=n.parentElement){const s=getComputedStyle(n);matrix=new DOMMatrix(s.transform==='none'?undefined:s.transform).multiply(matrix);opacity*=Number(s.opacity);}
      const sx=Math.hypot(matrix.a,matrix.c)||1,sy=Math.hypot(matrix.b,matrix.d)||1,rotation=Math.atan2(-matrix.c,matrix.a)*180/Math.PI;
      const w=node.offsetWidth||r.width/scale,h=node.offsetHeight||r.height/scale;
      const corners=[[0,0],[w,0],[0,h],[w,h]].map(([x,y])=>({x:matrix.a*x+matrix.c*y,y:matrix.b*x+matrix.d*y}));
      const x=(r.left-p.left)/scale-card.clientLeft-Math.min(...corners.map(c=>c.x)),y=(r.top-p.top)/scale-card.clientTop-Math.min(...corners.map(c=>c.y));
      const fontSize=parseFloat(textStyle.fontSize),lineHeight=parseFloat(textStyle.lineHeight)||fontSize*1.3;
      const item={type,label:label(selected),x:0,y:0,w:clamp((w+(type==='text'?1:0))/card.clientWidth*100,1,100),h:clamp((type==='text'?Math.max(h,lineHeight):h)/card.clientHeight*100,1,100),font_size:clamp(Math.round(fontSize),8,100),color:colorHex(textStyle.color)||'#ffffff'};
      const adjustment={x:x/unit,y:y/unit,sx,sy,rotation,opacity,font_size:clamp(fontSize,6,150)};
      if(type==='text'||type==='badge'){
        item.text=ticketTextSource(config,type==='badge'?'ticket_type':selected.slice(5));
        item.appearance={font: textStyle.fontFamily.includes('Plus Jakarta')?'display':textStyle.fontFamily.includes('monospace')?'mono':'body',weight:clamp(Number(textStyle.fontWeight)||400,100,900),line_height:clamp(lineHeight/fontSize,.5,5),letter_spacing:clamp(parseFloat(textStyle.letterSpacing)||0,-10,40),text_transform:['uppercase','lowercase','capitalize'].includes(textStyle.textTransform)?textStyle.textTransform:'none',font_style:textStyle.fontStyle==='italic'?'italic':'normal',align:['left','center','right'].includes(textStyle.textAlign)?textStyle.textAlign:'left'};
        if(type==='text'&&style.display==='inline')adjustment.y-=(lineHeight-h)/2/unit;
      }
      if(type==='badge'){
        adjustment.background=colorHex(style.backgroundColor)||config.accent;
        adjustment.border_radius=clamp(parseFloat(style.borderRadius)||0,0,100);
        item.appearance.padding_x=clamp(parseFloat(style.paddingLeft)||0,0,100);item.appearance.padding_y=clamp(parseFloat(style.paddingTop)||0,0,100);
      }
      if(type==='image'){item.src=node.getAttribute('src');item.appearance={object_fit:style.objectFit==='cover'?'cover':'contain'};}
      if(type==='qr'){item.appearance={qr_margin:1,padding_x:clamp(parseFloat(style.paddingLeft)||0,0,100),padding_y:clamp(parseFloat(style.paddingTop)||0,0,100)};adjustment.background=colorHex(style.backgroundColor)||'#ffffff';adjustment.border_radius=clamp(parseFloat(style.borderRadius)||0,0,100);}
      if(type==='divider'){adjustment.line_axis=w>h?'horizontal':'vertical';adjustment.line_style=['solid','dashed','dotted','double'].includes(style.borderLeftStyle)&&w<h?style.borderLeftStyle:['solid','dashed','dotted','double'].includes(style.borderTopStyle)?style.borderTopStyle:'dashed';adjustment.line_width=clamp(parseFloat(w>h?style.borderTopWidth:style.borderLeftWidth)||1,1,12);adjustment.color=colorHex(w>h?style.borderTopColor:style.borderLeftColor)||item.color;}
      data={item,adjustment};
    }
    const bounds=node.getBoundingClientRect(),paper=nodeFor('card').getBoundingClientRect(),unit=(root.current.querySelector('.ticket-scale-surface')||root.current.querySelector('.ticket-presentation')).getBoundingClientRect().width/100;
    data.offsetBounds={x:{min:Math.min(0,(paper.left-bounds.left)/unit),max:Math.max(0,(paper.right-bounds.right)/unit)},y:{min:Math.min(0,(paper.top-bounds.top)/unit),max:Math.max(0,(paper.bottom-bounds.bottom)/unit)}};
    pasteCount.current=0;setClipboard(data);setError('');root.current.focus({preventScroll:true});return data;
  }
  function paste(data=clipboard){
    if(disabled||!data)return;
    if((config.extra_elements||[]).length>=36){setError('You can add up to 36 components. Delete one before pasting.');return;}
    const id='extra_'+crypto.randomUUID().replaceAll('-',''),sequence=++pasteCount.current;
    onChange(c=>pasteTicketComponent(c,data,id,sequence)||c);setSelected(id);setError('');root.current.focus({preventScroll:true});
  }
  function remove(){
    if(!selected||selected==='card'||disabled)return;
    if(selected.startsWith('extra_'))onChange(c=>({...c,extra_elements:(c.extra_elements||[]).filter(e=>e.id!==selected),element_adjustments:Object.fromEntries(Object.entries(c.element_adjustments||{}).filter(([id])=>id!==selected))}));
    else adjust(selected,{...normal,...config.element_adjustments?.[selected],hidden:true});
    setSelected(null);
  }
  function start(event,id,edge='move') {
    if(disabled||event.button!==0||!id)return;
    const node=nodeFor(id);if(!node||getComputedStyle(node).visibility==='hidden')return;
    event.preventDefault();event.stopPropagation();setSelected(id);
    const r=node.getBoundingClientRect(),p=root.current.querySelector('.designed-ticket').getBoundingClientRect();
    if(id==='card'){gesture.current={id,edge,startX:event.clientX,startY:event.clientY,width:r.width/zoom,height:r.height/zoom,contentWidth:size?.contentWidth,contentHeight:size?.contentHeight,referenceWidth:size?.referenceWidth||width,pan};event.currentTarget.setPointerCapture(event.pointerId);return;}
    const current={...normal,...config.element_adjustments?.[id]};
    const parentId=node.parentElement.closest('[data-ticket-part^="section_"]')?.dataset.ticketPart,parent=config.element_adjustments?.[parentId];
    const unit=(root.current.querySelector('.ticket-scale-surface')||root.current.querySelector('.ticket-presentation')).getBoundingClientRect().width/100;
    const targets=[...root.current.querySelectorAll('[data-ticket-part]')].filter(n=>n!==node&&!node.contains(n)&&!n.contains(node)&&!n.dataset.ticketPart.startsWith('section_')&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).display!=='none').map(n=>n.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
    gesture.current={targets,id,edge,current,r,p,startX:event.clientX,startY:event.clientY,unitX:unit*(parent?.sx||1),unitY:unit*(parent?.sy||1),qrSize:(id==='qr'||id==='section_qr'||config.extra_elements?.find(e=>e.id===id)?.type==='qr')?(node.matches('svg')?node:node.querySelector('svg'))?.getBoundingClientRect().width:null,baseW:r.width/current.sx,baseH:r.height/current.sy};
    event.currentTarget.setPointerCapture(event.pointerId);root.current.focus({preventScroll:true});
  }
  function move(event){
    const g=gesture.current;if(!g)return;
    const dx=event.clientX-g.startX,dy=event.clientY-g.startY,c=g.current;
    if(g.id==='card'){if(g.edge==='move'){setPan({x:g.pan.x+dx,y:g.pan.y+dy});return;}const w=g.width+(g.edge.includes('w')?-dx:g.edge.includes('e')?dx:0)/zoom,h=g.height+(g.edge.includes('n')?-dy:g.edge.includes('s')?dy:0)/zoom;g.latest=g.edge.length===2?scaleTicket(g,w,h):resizeTicketAxis(g,g.edge==='e'||g.edge==='w'?w:h,g.edge==='e'||g.edge==='w'?'width':'height');setSizeDraft(g.latest);return;}
    let value={...c};
    if(g.edge==='move'){
      const snapped=snapTicketMove(g.r,g.p,g.targets,dx,dy,event.altKey?0:6);
      value.x=c.x+snapped.dx/g.unitX;value.y=c.y+snapped.dy/g.unitY;
      const origin=root.current.getBoundingClientRect();
      setGuides(event.altKey?[]:snapped.guides.map(line=>({...line,position:(line.position-(line.axis==='x'?origin.left:origin.top))/zoom,start:((line.axis==='x'?g.p.top:g.p.left)-(line.axis==='x'?origin.top:origin.left))/zoom,length:(line.axis==='x'?g.p.height:g.p.width)/zoom})));
    }else{
      let w=g.r.width,h=g.r.height;
      if(g.edge.includes('e'))w+=dx;if(g.edge.includes('w'))w-=dx;
      if(g.edge.includes('s'))h+=dy;if(g.edge.includes('n'))h-=dy;
      if(config.extra_elements?.some(e=>e.id===g.id&&e.type==='badge')){w=clamp(w,40,g.p.width);h=clamp(h,24,g.p.height);value.box_width=round(w/g.unitX);value.box_height=round(h/g.unitY);value.sx=1;value.sy=1;if(g.edge.includes('w'))value.x=c.x+(g.r.width-w)/g.unitX;if(g.edge.includes('n'))value.y=c.y+(g.r.height-h)/g.unitY;g.latest=value;setDraft(value);return;}
      if(g.id==='section_footer'){w=clamp(w,80,g.p.width);h=clamp(h,24,2000*zoom);value.box_width=round(w/g.unitX);value.box_height=round(h/g.unitY);value.sx=1;value.sy=1;if(g.edge.includes('w'))value.x=c.x+(g.r.width-w)/g.unitX;if(g.edge.includes('n'))value.y=c.y+(g.r.height-h)/g.unitY;const savedSize=ticketSize(config.ticket_size);if(savedSize){const size=savedSize;const factor=size.width/(size.contentWidth||size.width),added=(h-g.r.height)/zoom,updatedHeight=clamp(size.height+added,240,4000);g.cardSize={...size,height:updatedHeight,...(size.contentWidth?{contentHeight:updatedHeight/factor}:{})};setSizeDraft(g.cardSize);}g.latest=value;setDraft(value);return;}
      const qr=g.id==='qr'||g.id==='section_qr'||config.extra_elements?.find(e=>e.id===g.id)?.type==='qr';
      const line=g.id.startsWith('divider')||config.extra_elements?.find(e=>e.id===g.id)?.type==='divider';
      if(line){if(g.r.width>g.r.height)h=g.r.height;else w=g.r.width;}
      if(!line||g.r.width>g.r.height)w=clamp(w,qr?64:12,Math.max(qr?64:12,g.p.width));if(!line||g.r.height>=g.r.width)h=clamp(h,qr?64:12,Math.max(qr?64:12,g.p.height));
      if(qr||g.edge.length===2){let ratio=g.edge.length===2?Math.min(w/g.r.width,h/g.r.height):g.edge==='e'||g.edge==='w'?w/g.r.width:h/g.r.height;
        if(g.qrSize)ratio=Math.max(ratio,64/g.qrSize);
        w=g.r.width*ratio;h=g.r.height*ratio;}
      value.sx=clamp(w/g.baseW,.1,10);value.sy=clamp(h/g.baseH,.1,10);
      if(g.edge.includes('w'))value.x=c.x+(g.r.width-w)/g.unitX;
      if(g.edge.includes('n'))value.y=c.y+(g.r.height-h)/g.unitY;
    }
    for(const k of ['x','y','sx','sy'])value[k]=round(clamp(value[k],k==='x'||k==='y'?-10000:.1,k==='x'||k==='y'?10000:10));
    g.latest=value;setDraft(value);
  }
  function finish(event,cancel=false){const g=gesture.current;if(!g)return;if(!cancel&&g.latest){if(g.id==='card')onChange(c=>({...c,ticket_size:g.latest}));else onChange(c=>({...c,...(g.cardSize?{ticket_size:g.cardSize}:{}),element_adjustments:{...c.element_adjustments,[g.id]:g.latest}}));}gesture.current=null;setGuides([]);setDraft(null);setSizeDraft(null);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
  const gestures={onPointerMove:move,onPointerUp:e=>finish(e),onPointerCancel:e=>finish(e,true)};
  function edit(id=selected,target){
    if(disabled)return;
    if(id==='section_pass')return onTextEdit('ticket_type',target);
    if(id?.startsWith('text_'))return onTextEdit(id.slice(5),target);
    const item=config.extra_elements?.find(e=>e.id===id);
    if(id?.startsWith('block_')){
      const block=config.layout_blocks?.find(b=>'block_'+b.id===id);
      if(block?.type==='text'){setCustomText({id,value:block.text||'',block:true});onBusy(true);}
      return;
    }
    if(item?.type==='field')return onTextEdit(item.field,target);
    if(['text','badge'].includes(item?.type)){
      setCustomText({id,value:item.text||''});onBusy(true);
    }else if(item?.type==='image'||['main_logo','banner','banner_inline','banner_art'].includes(id)||id?.startsWith('partner_')){uploadTarget.current=id;fileInput.current.click();}
  }
  function add(type){
    if(type==='image'){uploadTarget.current='new';fileInput.current.click();return;}
    const text=type==='text'?'Your text':type==='badge'?'{{ticket_type}}':null;
    const field=type.startsWith('field_')?type.slice(6):null;
    const item={id:'extra_'+crypto.randomUUID().replaceAll('-',''),type:field?'field':type,...(field?{field}:{}),label:field?textCatalog[field].label:type==='qr'?'Ticket QR code':type==='divider'?'Dotted divider':type==='badge'?'Button / badge':'Text',x:10,y:10,w:type==='qr'?20:type==='badge'?35:40,h:type==='qr'?30:type==='divider'?2:type==='badge'?12:15,font_size:type==='badge'?16:18,color:type==='badge'?'#ffffff':'#f97316',...(text?{text:text.slice(0,1000)}:{})};
    onChange(c=>({...c,extra_elements:[...(c.extra_elements||[]),item]}));setSelected(item.id);if(['text','badge'].includes(type)){setCustomText({id:item.id,value:text});onBusy(true);}
  }
  async function upload(event){
    const file=event.target.files[0];event.target.value='';if(!file)return;
    if(file.size>5*1024*1024){setError('Choose an image smaller than 5 MB.');return;}
    onBusy(true);setError('');
    try{
      const body=new FormData();body.append('image',file);
      const {data}=await api.post('/admin/studio/upload',body,{headers:{'Content-Type':'multipart/form-data'}});const src=data.data.url,id=uploadTarget.current;
      onChange(c=>{
        if(id==='new')return {...c,extra_elements:[...(c.extra_elements||[]),{id:'extra_'+crypto.randomUUID().replaceAll('-',''),type:'image',label:'Image',src,x:10,y:10,w:30,h:25,font_size:18,color:'#ffffff'}]};
        if(id.startsWith('extra_'))return {...c,extra_elements:c.extra_elements.map(e=>e.id===id?{...e,src}:e)};
        if(id.startsWith('partner_'))return {...c,logos:c.logos.map((v,i)=>i===Number(id.slice(8))?src:v)};
        return {...c,[id==='main_logo'?'logo':'banner_image']:src};
      });
    }catch(err){setError(err.response?.data?.message||'Image upload failed.');}finally{onBusy(false);}
  }
  function closeCustomText(){setCustomText(null);onBusy(false);}
  return <div className="ticket-canvas-workspace">
    {customText&&<TicketTextComposer value={customText.value} onClose={closeCustomText} onApply={text=>{onChange(c=>customText.block?{...c,layout_blocks:c.layout_blocks.map(b=>'block_'+b.id===customText.id?{...b,text}:b)}:{...c,extra_elements:c.extra_elements.map(e=>e.id===customText.id?{...e,text}:e)});closeCustomText();}}/>}
    <div className="ticket-canvas-tools" role="toolbar" aria-label="Canvas tools">
      <span className="ticket-canvas-tool-title">Canvas</span>
      <TicketComponentPicker onAdd={add} onRestore={id=>adjust(id,{...config.element_adjustments[id],hidden:false})} hidden={Object.entries(config.element_adjustments||{}).filter(([,v])=>v.hidden).map(([id])=>({id,label:label(id)}))} disabled={disabled} atLimit={(config.extra_elements||[]).length>=36}/>
      <button type="button" disabled={disabled} onClick={()=>setSelected('card')}>Card size & color</button>
      <button type="button" disabled={disabled||!componentKind(selected,config)} title="Copy selected component (Ctrl/Cmd+C)" onClick={copy}>Copy</button>
      <button type="button" disabled={disabled||!clipboard||(config.extra_elements||[]).length>=36} title="Paste component (Ctrl/Cmd+V)" onClick={()=>paste()}>Paste</button>
      <button type="button" className="ticket-original-action" disabled={disabled} onClick={()=>{onChange(c=>({...c,layout_blocks:null,canvas:null,ticket_size:null,card_background:null,element_adjustments:{},extra_elements:[]}));setSelected(null);}}>Restore original</button>
    </div>
    <div className="ticket-canvas-viewport" ref={viewport}>
    <div className="ticket-canvas-stage" style={{width:width*zoom,height:height*zoom,transform:`translate(${pan.x}px,${pan.y}px)`}}>
    <div ref={root} tabIndex={0} className="ticket-preserve-editor" style={{width,transform:`scale(${zoom})`,transformOrigin:'top left'}}
      onCopy={event=>{if(!disabled&&componentKind(selected,config)&&!event.target.closest('input,textarea,select,[contenteditable=true]')){event.preventDefault();copy();event.clipboardData.setData('text/plain','Ticket component');}}}
      onPaste={event=>{if(!disabled&&clipboard&&!event.target.closest('input,textarea,select,[contenteditable=true]')){event.preventDefault();paste();}}}
      onKeyDown={event=>{
    if(disabled||event.target.closest('button,input,textarea,select,summary,[contenteditable=true]'))return;
    if((event.ctrlKey||event.metaKey)&&!event.altKey){const key=event.key.toLowerCase();if(key==='c'&&componentKind(selected,config)){event.preventDefault();event.stopPropagation();copy();return;}if(key==='v'&&clipboard){event.preventDefault();event.stopPropagation();paste();return;}if(key==='d'&&componentKind(selected,config)){event.preventDefault();event.stopPropagation();paste(copy());return;}}
    if(!selected||selected==='card')return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();gesture.current=null;setGuides([]);setDraft(null);setSelected(null);}
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();remove();}
    const step=event.shiftKey?10:1,delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];
    if(delta){event.preventDefault();const c={...normal,...config.element_adjustments?.[selected]},unit=root.current.querySelector('.ticket-presentation').getBoundingClientRect().width/100;adjust(selected,{...c,x:round(clamp(c.x+delta[0]/unit,-10000,10000)),y:round(clamp(c.y+delta[1]/unit,-10000,10000))});}
  }}>
    <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload}/>
    {error&&<p role="alert">{error}</p>}
    <div onPointerDownCapture={e=>{const node=partFromTarget(e.target);if(node)start(e,node.dataset.ticketPart);else if(e.target.closest('.designed-ticket'))setSelected('card');else setSelected(null);}} {...gestures}
      onDoubleClick={e=>{const node=partFromTarget(e.target);if(node)edit(node.dataset.ticketPart,node);}}>
      <DesignedTicket design={design} ticket={sample||{}} order={sample||{}} preview/>
    </div>
    {guides.map(line=><div key={line.axis} aria-hidden="true" className={`ticket-alignment-guide guide-${line.axis}`} style={line.axis==='x'?{left:line.position,top:line.start,height:line.length}:{top:line.position,left:line.start,width:line.length}}><span>{line.label}</span></div>)}
    {!disabled&&<div className="ticket-card-resize" style={cardBox||{}}><button className="ticket-card-size-button" aria-label="Move ticket on canvas" onPointerDown={e=>start(e,'card','move')} {...gestures}>✥ Move ticket</button><button className="ticket-card-corner" title="Drag to resize the whole ticket proportionally" aria-label="Resize ticket card" onPointerDown={e=>start(e,'card','se')} {...gestures}>↘</button><button className="ticket-card-edge ticket-card-edge-e" aria-label="Drag to widen ticket" onPointerDown={e=>start(e,'card','e')} {...gestures}>↔</button><button className="ticket-card-edge ticket-card-edge-s" aria-label="Drag to extend ticket height" onPointerDown={e=>start(e,'card','s')} {...gestures}>↕ Resize card</button></div>}
    {!disabled&&footerBox&&<div className="ticket-footer-resize" style={footerBox}><button aria-label="Drag to extend footer" onPointerDown={e=>start(e,'section_footer','s')} {...gestures}>↕ Footer</button></div>}
    {box&&!disabled&&<div className="ticket-preserve-selection" style={{left:box.left,top:box.top,width:box.width,height:box.height}}>
      <div className="part-actions">{selected==='card'?<button onClick={()=>onChange(c=>({...c,ticket_size:null}))}>Original size</button>:<>{selected?.startsWith('section_')&&<button className="ticket-section-grip" aria-label="Drag selected section" onPointerDown={e=>start(e,selected)} {...gestures}>✥ Move</button>}{selected!=='qr'&&config.extra_elements?.find(e=>e.id===selected)?.type!=='qr'&&(selected==='section_pass'||!selected?.startsWith('section_'))&&!selected?.startsWith('divider')&&config.extra_elements?.find(e=>e.id===selected)?.type!=='divider'&&<button onClick={e=>edit(selected,e.currentTarget)}>Edit</button>}
      <TicketElementStyle key={selected} currentColor={box.color} currentBackground={box.background} value={config.element_adjustments?.[selected]} line={selected?.startsWith('divider')||config.extra_elements?.find(e=>e.id===selected)?.type==='divider'} background={['section_pass','section_footer'].includes(selected)||config.extra_elements?.find(e=>e.id===selected)?.type==='badge'} badge={selected==='section_pass'||config.extra_elements?.find(e=>e.id===selected)?.type==='badge'} text={['section_pass','section_footer'].includes(selected)||selected?.startsWith('text_')||['text','badge','field'].includes(config.extra_elements?.find(e=>e.id===selected)?.type)} onChange={v=>adjust(selected,selected==='divider_qr'?{...v,line_axis:box.width>box.height?'horizontal':'vertical'}:v)}/>{box.parentId&&<button onClick={()=>setSelected(box.parentId)}>Select section</button>}<button onClick={remove}>Delete</button><button onClick={()=>{onChange(c=>({...c,element_adjustments:Object.fromEntries(Object.entries(c.element_adjustments||{}).filter(([id])=>id!==selected))}));}}>Reset</button></>}</div>
      {(selected?.startsWith('divider')||config.extra_elements?.find(e=>e.id===selected)?.type==='divider'?(box.width>box.height?['e','w']:['n','s']):['nw','n','ne','e','se','s','sw','w']).map(edge=><button key={edge} aria-label={`Resize ${label(selected)} ${edge}`} className={`canvas-handle handle-${edge}`} onPointerDown={e=>start(e,selected,edge)} {...gestures}/>)}
    </div>}
    </div></div></div>
    <div className="ticket-canvas-footer">{selected==='card'?<div className="ticket-size-inputs"><label>W <input aria-label="Ticket width" type="number" min="240" max="1600" key={Math.round(size?.width||box?.width||width)} defaultValue={Math.round(size?.width||box?.width||width)} onBlur={e=>onChange(c=>({...c,ticket_size:resizeTicketAxis(size||{width:box?.width||width,height:box?.height||height,referenceWidth:width},Number(e.target.value),'width')}))}/></label><label>H <input aria-label="Ticket height" type="number" min="240" max="4000" key={Math.round(size?.height||box?.height||height)} defaultValue={Math.round(size?.height||box?.height||height)} onBlur={e=>onChange(c=>({...c,ticket_size:resizeTicketAxis(size||{width:box?.width||width,height:box?.height||height,referenceWidth:width},Number(e.target.value),'height')}))}/></label><span>px</span><label>Background <input type="color" aria-label="Ticket background" value={config.card_background||config.background||'#171917'} onInput={e=>onChange(c=>({...c,background:e.target.value,card_background:e.target.value}))}/></label><label>Accent <input type="color" aria-label="Ticket accent" value={config.accent||'#f97316'} onInput={e=>onChange(c=>({...c,accent:e.target.value}))}/></label></div>:<span>{selected?label(selected):'Select an element on the ticket'}</span>}<div><button type="button" aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.25,z-.1))}>−</button><output>{Math.round(zoom*100)}%</output><button type="button" aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(2,z+.1))}>+</button><button type="button" onClick={fit}>Fit</button><button type="button" onClick={()=>setZoom(1)}>100%</button></div></div>
  </div>;
}
