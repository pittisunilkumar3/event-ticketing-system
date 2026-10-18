import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 global.window={location:{pathname:'/o/alpha/admin/orders',hostname:'localhost'}};
 const {TicketRows,default:Bookings}=await server.ssrLoadModule('/src/admin/TicketBookings.jsx');
 const {default:Orders}=await server.ssrLoadModule('/src/admin/Orders.jsx');
 const render=(Component,props={},url='/admin/orders')=>renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[url]},React.createElement(Component,props)));
 const tickets=Array.from({length:3},(_,i)=>({id:i+1,order_id:9,attendee_name:'Person '+i,attendee_email:'person'+i+'@example.test',attendee_phone:'900000000'+i,ticket_code:'TCK-'+i,booking_ref:'BOOK-SAME',event_title:'Expo',type_name:i?'General':'VIP',order_status:'paid',ticket_status:i?'valid':'checked_in',booked_at:'2026-10-19 12:00:00'}));
 const rows=render(TicketRows,{tickets,onPreview:()=>{}});assert.equal((rows.match(/BOOK-SAME/g)||[]).length,3);for(const person of tickets){assert.ok(rows.includes(person.attendee_email));assert.ok(rows.includes(person.ticket_code));assert.ok(rows.includes('View ticket for '+person.attendee_name));}assert.match(rows,/href="\/admin\/orders\/9"/);
 const page=render(Bookings,{},'/admin/orders?view=tickets&booking_group=test&event_id=1');for(const label of ['Search tickets','Booking type','Event','Pass','Booking status','Check-in status','Booked from','Booked through','Export CSV','Clear filters'])assert.ok(page.includes(label),label);assert.match(page,/value="test" selected/);
 const wrapper=render(Orders,{},'/admin/orders?view=tickets');assert.match(wrapper,/Booking view/);assert.match(wrapper,/aria-pressed="true">Individual tickets/);
 console.log('PASS individual attendee rows, order links, preview actions, filters, CSV action and view switching.');
}finally{await server.close();}
