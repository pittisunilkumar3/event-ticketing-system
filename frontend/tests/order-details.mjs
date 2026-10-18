import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const render=(Component,props)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Component,props)));
try{
 const {default:Details}=await server.ssrLoadModule('/src/admin/OrderBookingDetails.jsx');
 const {default:Preview}=await server.ssrLoadModule('/src/admin/IssuedTicketPreview.jsx');
 const order={booking_ref:'TKT-SAVED',customer_name:'Booker',email:'booker@example.test',event_title:'Saved Event',event_start:'2027-01-02 10:00:00',created_at:'2026-10-15 10:00:00',total_amount:'797',currency:'INR',status:'paid',payment_method:'mock'};
 const ticket={id:10,attendee_id:21,attendee_name:'Saved Guest',type_name:'Saved Pass',ticket_code:'TCK-SAVED-CODE',price:'999',status:'valid',design:{layout:'classic',brand:'Saved Brand',price:199,type_name:'Saved Pass'}};
 const data={order,tickets:[ticket],attendees:[{id:21,name:'Saved Guest',email:'guest@example.test',phone:'9876543210',answers:[{id:'f_city',type:'text',label:'City',value:'Hyderabad'}]}],separate_test_bookings:true};
 const page=render(Details,{data,onAction:()=>{},onDownload:()=>{}});
 assert.match(page,/CONTACT DETAILS/);assert.match(page,/9876543210/);assert.match(page,/Hyderabad/);assert.match(page,/<details[^>]*open/);
 assert.match(page,/Preview ticket for Saved Guest/);assert.match(page,/guest@example.test/);assert.match(page,/199.00/);assert.doesNotMatch(page,/999.00|<table/);assert.match(page,/booking_group=test/);
 const pending=render(Details,{data:{...data,order:{...order,status:'pending'},tickets:[]},onAction:()=>{},onDownload:()=>{}});
 assert.match(pending,/9876543210/);assert.match(pending,/Hyderabad/);
 assert.match(pending,/Ticket not issued/);assert.match(pending,/once payment is confirmed/);assert.doesNotMatch(pending,/Preview ticket for/);
 const preview=render(Preview,{ticket,order,demo:true,onClose:()=>{}});
 for(const value of ['Saved Guest','TCK-SAVED-CODE','Saved Brand','Saved Event','TKT-SAVED','199.00'])assert.ok(preview.includes(value),value);
 assert.doesNotMatch(preview,/PREVIEW ONLY|DESIGN PREVIEW|Alex Morgan|000042/);
 const cancelled=render(Preview,{ticket:{...ticket,status:'cancelled'},order,onClose:()=>{}});assert.match(cancelled,/VOID/);
 console.log('PASS: attendee-linked preview buttons, saved prices, demo navigation, pending tickets, actual ticket content and cancelled-ticket rendering.');
}finally{await server.close();}
