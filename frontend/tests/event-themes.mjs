import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
import themes from '../../shared/eventThemes.json' with {type:'json'};
const server=await createServer({plugins:[{name:'theme-test-api',enforce:'pre',load(id){if(id.endsWith('/src/api/client.js'))return 'export default {};';}}],server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const render=(Component,props)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Component,props)));
try {
 const {EventPageView}=await server.ssrLoadModule('/src/pages/EventDetail.jsx');
 const {default:Picker}=await server.ssrLoadModule('/src/admin/EventThemePicker.jsx');
 const event={title:'Saved Event',slug:'saved-event',start_datetime:'2030-01-01 12:00:00',banner_image:'/uploads/saved.png',description:'Actual saved description',status:'published'};
 const ticket={id:12,name:'Actual pass',price:999,is_active:1,is_on_sale:true,sale_status:'on_sale',available:20,min_per_order:1,max_per_order:10};
 for(const theme of themes){
  const page=render(EventPageView,{data:{event:{...event,page_theme:theme.id},ticketTypes:[ticket,{...ticket,id:13,name:'Hidden pass',is_active:0}]},selection:{12:2}});
  assert.match(page,new RegExp('event-theme-'+theme.id));
  for(const text of ['Saved Event','Actual saved description','Actual pass','1,998.00','Continue to booking'])assert.ok(page.includes(text),text);
  assert.doesNotMatch(page,/Hidden pass/);
 }
 assert.match(render(EventPageView,{data:{event:{...event,page_theme:'unknown'},ticketTypes:[]}}),/event-theme-classic/);
 const premiere=render(EventPageView,{data:{event:{...event,page_theme:'premiere',organizer_name:'Actual organizer'},ticketTypes:[ticket]}});
 for(const text of ['premiere-hero','premiere-artwork','Find your pass','Actual organizer','Date &amp; time'])assert.ok(premiere.includes(text),text);
 const noArt=render(EventPageView,{data:{event:{...event,banner_image:null,page_theme:'premiere'},ticketTypes:[]}});
 assert.match(noArt,/premiere-no-art/);assert.match(noArt,/Explore the event/);assert.doesNotMatch(noArt,/premiere-artwork|Tickets from/);
 assert.deepEqual(themes.filter(t=>!['marquee','atelier','horizon','pulse'].includes(t.id)).map(t=>t.id),['premiere','classic','cinema','poster','editorial','aurora','summit','festival','gala','blueprint','gallery']);

 for(const id of ['marquee','atelier','horizon','pulse']) {
  const content=render(EventPageView,{data:{event:{...event,page_theme:id,organizer_name:'Saved organizer',venue:'Saved venue'},ticketTypes:[ticket]}});
  for(const text of ['showcase-'+id,'showcase-art','Saved organizer','Saved venue','Choose your pass'])assert.ok(content.includes(text),id+': '+text);
  const empty=render(EventPageView,{data:{event:{...event,page_theme:id,banner_image:null},ticketTypes:[]}});
  assert.match(empty,/showcase-no-art/);assert.match(empty,/Explore the event/);assert.doesNotMatch(empty,/showcase-art|showcase-price/);
 }
 const {formatEventDates,eventDateInput}=await server.ssrLoadModule('/src/utils/format.jsx');
 assert.equal(eventDateInput('2026-12-12 09:00:00'),'2026-12-12T09:00');
 assert.equal(eventDateInput(null),'');
 assert.equal(formatEventDates('2026-12-31 09:00:00','2027-01-01 18:00:00'),'31 Dec 2026 – 1 Jan 2027');
 assert.equal(formatEventDates('2026-11-30 09:00:00','2026-12-01 18:00:00'),'30 Nov – 1 Dec 2026');
 assert.equal(formatEventDates('2026-12-12 09:00:00','2026-12-12 18:00:00'),'12 Dec 2026');
 assert.equal(formatEventDates('2026-12-12 09:00:00',null),'12 Dec 2026');
 for(const theme of themes){
  const page=render(EventPageView,{data:{event:{...event,page_theme:theme.id,start_datetime:'2026-12-12 09:00:00',end_datetime:'2026-12-13 18:00:00'},ticketTypes:[]}});
  assert.match(page,/12–13 Dec 2026/);
  assert.match(page,/9:00 AM/);
 }
 const {default:DateStamp}=await server.ssrLoadModule('/src/pages/EventDateStamp.jsx');
 const stamp=(start,end)=>render(DateStamp,{start,end});
 assert.match(stamp('2026-12-12 09:00:00','2026-12-13 18:00:00'),/<small>Dec<\/small><strong>12–13<\/strong>/);
 assert.match(stamp('2026-12-12 09:00:00',null),/<small>Dec<\/small><strong>12<\/strong>/);
 assert.match(stamp('2026-12-12 09:00:00','2026-12-12 18:00:00'),/<strong>12<\/strong>/);
 assert.match(stamp('2026-12-31 09:00:00','2027-01-01 18:00:00'),/<strong>31 Dec 2026 – 1 Jan 2027<\/strong>/);
 const {eventMapsUrl}=await server.ssrLoadModule('/src/components/EventVenueLink.jsx');
 const location={venue:'T-Hub',address:'T-Hub, Hyderabad, Telangana, India',city:'Hyderabad'};
 assert.equal(new URL(eventMapsUrl(location)).searchParams.get('query'),'T-Hub, Hyderabad, Telangana, India');
 assert.equal(eventMapsUrl({}),null);
 assert.equal(new URL(eventMapsUrl({venue:'Hall & Studio',city:'New Delhi'})).searchParams.get('query'),'Hall & Studio, New Delhi');
 for(const theme of themes){
  const page=render(EventPageView,{data:{event:{...event,...location,page_theme:theme.id},ticketTypes:[]}});
  assert.equal((page.match(/class="event-venue-link"/g)||[]).length,2,theme.id);
  assert.match(page,/aria-label="T-Hub — Open in Google Maps">T-Hub<\/a>/);
  assert.match(page,/target="_blank" rel="noopener noreferrer"/);
 }
 const picker=render(Picker,{value:'poster',onChange:()=>{},event,ticketTypes:[ticket]});
 assert.equal((picker.match(/type="radio"/g)||[]).length,themes.length);assert.equal((picker.match(/checked=""/g)||[]).length,1);
 for(const theme of themes)assert.ok(picker.includes('Preview '+theme.name));
 console.log('PASS all shared page themes, safe fallback, same live content/cart, hidden tickets, and selectable preview gallery.');
}finally{await server.close();}
