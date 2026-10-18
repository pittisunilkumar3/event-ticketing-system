import {useEffect,useRef,useState} from 'react';
import DesignedTicket from '../components/DesignedTicket';

export default function TicketDesignPreview({design,category='Horizontal',event={},name,price}) {
 const frame=useRef(null),content=useRef(null),[scale,setScale]=useState(.4);
 useEffect(()=>{
  const fit=()=>{
   if(!frame.current||!content.current)return;
   const {offsetWidth:width,offsetHeight:height}=content.current;
   if(width&&height)setScale(Math.min((frame.current.clientWidth-32)/width,(frame.current.clientHeight-28)/height,1));
  };
  const observer=new ResizeObserver(fit);
  observer.observe(frame.current);observer.observe(content.current);fit();
  return()=>observer.disconnect();
 },[]);
 return <div className={`ticket-thumbnail ticket-option-preview format-${category.toLowerCase()}`} ref={frame} aria-hidden="true">
  <div className="ticket-option-art" ref={content} style={{width:category==='Horizontal'?660:390,transform:`translate(-50%, -50%) scale(${scale})`}}>
   <DesignedTicket design={{...design,type_name:name||'Ticket name',price:Number(price)||0,currency:'INR'}} order={{event_title:event.title||'Event name',event_start:event.start_datetime,venue:event.venue,city:event.city,customer_name:'Guest name',currency:'INR'}} preview/>
  </div>
 </div>;
}
