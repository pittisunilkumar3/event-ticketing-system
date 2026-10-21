import bounds from '../../../shared/ticketSize.json';
export function ticketSize(value){
  if(!value||!Number.isFinite(value.width)||!Number.isFinite(value.height))return null;
  return {...(Number.isFinite(value.contentWidth)&&Number.isFinite(value.contentHeight)?{contentWidth:value.contentWidth,contentHeight:value.contentHeight,...(Number.isFinite(value.referenceWidth)?{referenceWidth:value.referenceWidth}:{})}:{}),width:Math.round(Math.min(bounds.maxWidth,Math.max(bounds.minWidth,value.width))),height:Math.round(Math.min(bounds.maxHeight,Math.max(bounds.minHeight,value.height)))};
}

// Keep the artwork's coordinate system stable while resizing the whole ticket.
export function scaleTicket(size,width,height,axis='width'){
 const ratio=axis==='height'?height/size.height:width/size.width;
 const factor=Math.max(Math.max(bounds.minWidth/size.width,bounds.minHeight/size.height),Math.min(ratio,bounds.maxWidth/size.width,bounds.maxHeight/size.height));
 return ticketSize({width:size.width*factor,height:size.height*factor,contentWidth:size.contentWidth||size.width,contentHeight:size.contentHeight||size.height,referenceWidth:size.referenceWidth||size.width});
}

// Edge handles change the artboard dimension without scaling its contents.
export function resizeTicketAxis(size,value,axis){
 const scale=size.contentWidth?size.width/size.contentWidth:1;
 const next=ticketSize({...size,[axis]:value});
 if(!next)return size;
 return {...next,contentWidth:next.width/scale,contentHeight:next.height/scale,referenceWidth:size.referenceWidth||size.width};
}
