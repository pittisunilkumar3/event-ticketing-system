export const TICKET_WIDTH = 760;
export const MAX_TICKET_HEIGHT = 6000;
const clamp = (n, min, max) => Math.max(min, Math.min(max, Math.round(n)));
export function transformFrame(frame, edge, dx, dy, height, type) {
  const minW = type === 'qr' ? 96 : 24, minH = type === 'qr' ? 120 : 24;
  if (edge === 'move') return {...frame, x:clamp(frame.x+dx,0,TICKET_WIDTH-frame.w),y:clamp(frame.y+dy,0,height-frame.h)};
  let left=frame.x, top=frame.y, right=frame.x+frame.w, bottom=frame.y+frame.h;
  if(edge.includes('e'))right=clamp(right+dx,left+minW,TICKET_WIDTH);
  if(edge.includes('s'))bottom=clamp(bottom+dy,top+minH,height);
  if(edge.includes('w'))left=clamp(left+dx,0,right-minW);
  if(edge.includes('n'))top=clamp(top+dy,0,bottom-minH);
  return {x:left,y:top,w:right-left,h:bottom-top};
}
export function ticketExtent(blocks) {return Math.max(240,...blocks.map(b=>(b.frame?.y||0)+(b.frame?.h||0)));}
export function newFrame(blocks,type,height) {
  const y=Math.min(height-160,blocks.length?Math.max(...blocks.map(b=>b.frame.y+b.frame.h))+16:24);
  return {x:24,y:Math.max(0,y),w:type==='qr'?160:300,h:160};
}
