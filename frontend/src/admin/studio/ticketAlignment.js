// All geometry is in viewport pixels so snapping feels consistent at any zoom.
export function snapTicketMove(rect, bounds, targets, dx, dy, threshold=6) {
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  dx=clamp(dx,bounds.left-rect.left,Math.max(bounds.left-rect.left,bounds.right-rect.right));
  dy=clamp(dy,bounds.top-rect.top,Math.max(bounds.top-rect.top,bounds.bottom-rect.bottom));
  const guides=[];
  for(const axis of ['x','y']) {
    const low=axis==='x'?'left':'top',high=axis==='x'?'right':'bottom',delta=axis==='x'?dx:dy;
    const anchors=[rect[low]+delta,(rect[low]+rect[high])/2+delta,rect[high]+delta];
    const candidates=[{position:(bounds[low]+bounds[high])/2,label:'Ticket center'},...targets.flatMap(r=>[r[low],(r[low]+r[high])/2,r[high]].map((position,i)=>({position,label:i===1?'Center':'Aligned'})))];
    let best=null;
    for(const target of candidates)for(const anchor of anchors){
      const adjustment=target.position-anchor;
      if(Math.abs(adjustment)>threshold||rect[low]+delta+adjustment<bounds[low]-.01||rect[high]+delta+adjustment>bounds[high]+.01)continue;
      if(!best||Math.abs(adjustment)<Math.abs(best.adjustment))best={...target,adjustment};
    }
    if(best){if(axis==='x')dx+=best.adjustment;else dy+=best.adjustment;guides.push({axis,position:best.position,label:best.label});}
  }
  return {dx,dy,guides};
}
