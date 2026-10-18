import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),plugins:[{name:'editor-test-api',enforce:'pre',load(id){if(id.endsWith('/src/api/client.js'))return 'export default {};';}}],server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const render=element=>renderToStaticMarkup(React.createElement(MemoryRouter,null,element));
try {
  const { default:TicketModal } = await server.ssrLoadModule('/src/admin/TicketTypeModal.jsx');
  const ticketValues={name:'',price:'',quantity:'',description:'',sales_start:'',sales_end:'',template_id:'',is_active:true,min_per_order:1,max_per_order:10,sort_order:0};
  const ticketEditor=values=>render(React.createElement(TicketModal,{values,eventId:2,onClose:()=>{},onSave:()=>{}}));
  const newTicket=ticketEditor(ticketValues);
  assert.match(newTicket,/Add ticket type/);assert.match(newTicket,/Default ticket design/);
  assert.match(newTicket,/<details class="ticket-advanced"><summary>Booking limits/);
  assert.doesNotMatch(newTicket,/A pass for every kind|ea-presets|Choose a design/);
  const editedTicket=ticketEditor({...ticketValues,id:12,name:'Saved ticket',price:'499.00',quantity:50,sold:8,template_id:99,min_per_order:2,max_per_order:6});
  assert.match(editedTicket,/Edit ticket type/);assert.match(editedTicket,/Saved ticket/);
  assert.match(editedTicket,/Previously assigned design/);assert.match(editedTicket,/8 already sold/);
  assert.match(editedTicket,/<details class="ticket-advanced" open="">/);
  const {default:TicketDesignGallery}=await server.ssrLoadModule('/src/admin/TicketDesignGallery.jsx');
  for(const markup of [newTicket,editedTicket]) {
    assert.doesNotMatch(markup,/Submission form link|Guidelines link|Create a custom design in Email templates/);
    assert.match(markup,/Confirmation email template/);
  }
  const gallery=render(React.createElement(TicketDesignGallery,{designs:[{id:41,name:'Saved blue design',category:'Horizontal',config:{layout:'classic',brand:'Saved Organizer',accent:'#123456',background:'#fefefe'}}],defaultDesign:{layout:'classic'},selectedId:41,onSelect:()=>{},event:{title:'Actual Event',start_datetime:'2027-05-01 09:00:00',venue:'Saved Venue'},name:'Actual Pass',price:'499'}));
  assert.match(gallery,/aria-label="Select Saved blue design" aria-pressed="true"/);
  assert.match(gallery,/aria-label="Select Default ticket design" aria-pressed="false"/);
  for(const text of ['Saved Organizer','Actual Event','Actual Pass','Saved Venue','499.00','DESIGN PREVIEW'])assert.ok(gallery.includes(text),text);
  assert.doesNotMatch(gallery,/<select|<option|Alex Morgan|Cinematica/);
  const many=render(React.createElement(TicketDesignGallery,{designs:Array.from({length:100},(_,id)=>({id:id+1,name:`Design ${id+1}`,config:{layout:'classic'}})),selectedId:1,onSelect:()=>{}}));
  assert.equal((many.match(/class="ticket-design-card"/g)||[]).length,8);
  assert.match(many,/Show more designs/);
  console.log('Ticket gallery: saved configurations, selected state, live event/name/price, preview labels, no dropdown and bounded rendering passed.');
  console.log('Ticket editor: create/edit fields, preserved designs, sold capacity, optional settings and simplified labels passed.');
} finally {await server.close();}
