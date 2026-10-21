import {TICKET_WIDTH} from '../../components/ticketGeometry';
export default function ticketLayoutToCanvas(container,config) {
  const canvas=container.querySelector('.ticket-canvas'),rect=canvas.getBoundingClientRect(),scale=TICKET_WIDTH/rect.width;
  const frame=node=>{const r=node.getBoundingClientRect();const x=Math.max(0,Math.min(736,Math.round((r.left-rect.left)*scale)));return {x,y:Math.max(0,Math.round((r.top-rect.top)*scale)),w:Math.min(760-x,Math.max(24,Math.round(r.width*scale))),h:Math.max(24,Math.round(r.height*scale))};};
  const blocks=[];
  for(const block of config.layout_blocks) {
    const node=[...canvas.querySelectorAll('[data-block-id]')].find(n=>n.dataset.blockId===block.id);
    if(!node)continue;
    if(block.type==='logos'&&config.logo&&blocks.length+config.layout_blocks.length+(config.logos?.length||0)<36) {
      const main=node.querySelector('.ticket-main-logo');
      if(main)blocks.push({id:'logo_'+crypto.randomUUID(),type:'main_logo',padding:0,frame:frame(main)});
      for(const image of node.querySelectorAll('.ticket-partner-logo')) {
        const partner_index=config.logos.findIndex(src=>src===image.getAttribute('src'));
        blocks.push({id:'logo_'+crypto.randomUUID(),type:'partner_logo',partner_index,padding:0,frame:frame(image)});
      }
      if(main)continue;
    }
    const f=frame(node);if(block.type==='qr'){f.w=Math.max(96,f.w);f.h=Math.max(120,f.h);f.x=Math.min(f.x,760-f.w);}
    blocks.push({...block,frame:f,padding:Math.min(48,Math.round((block.padding??12)*scale)),font_size:Math.min(64,Math.max(8,Math.round(parseFloat(getComputedStyle(node).fontSize)*scale))),margin_top:0,margin_bottom:0,margin_left:0,margin_right:0});
  }
  const height=Math.max(240,Math.ceil(rect.height*scale),...blocks.map(b=>b.frame.y+b.frame.h+16));
  if(height>6000)throw Error('This layout is too tall. Remove some sections before switching to drag and resize.');
  return {...config,canvas:{height},layout_blocks:blocks};
}
