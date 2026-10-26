const test=require('node:test'),assert=require('node:assert/strict');
const {eventFields}=require('../services/eventValidation');
const {renderTicketDocument}=require('../generated/ticketDocument.cjs');
const defaults=require('../services/studioDefaults');
const hours='Saturday timings: 9AM–6PM\nSunday timings: 10AM–6PM';
const event={title:'Expo',start_datetime:'2026-12-12 09:00:00',end_datetime:'2026-12-13 18:00:00',schedule_text:hours};
test('daily hours survive partial edits and can be cleared',()=>{
 assert.equal(eventFields({title:'Updated'},event).schedule_text,hours);
 assert.equal(eventFields({schedule_text:''},event).schedule_text,'');
 assert.throws(()=>eventFields({...event,schedule_text:'x'.repeat(501)}));
});
test('every ticket layout includes readable daily hours outside its fixed design',()=>{
 for(const layout of [...require('../services/ticketLayouts'),...require('../services/legacyTicketLayouts')]){
 const html=renderTicketDocument({design:{...defaults.ticket,...layout.config},ticket:{id:1,ticket_code:'PREVIEW',attendee_name:'Guest'},order:{event_title:'Expo',event_schedule:hours}});
 assert.ok(html.includes(hours),layout.id);assert.match(html,/ticket-daily-schedule/);
 }
});
test('daily hours are safely escaped in ticket and email output',()=>{
 const schedule='<script>unsafe</script>';
 const html=renderTicketDocument({design:defaults.ticket,order:{event_schedule:schedule},ticket:{}});
 assert.match(html,/&lt;script&gt;unsafe/);assert.doesNotMatch(html,/<script>unsafe/);
 const {renderEmail}=require('../services/emailRenderer');
 const email=renderEmail({format:1,title:'Booking',body:'Hello'}, {site_url:'https://example.test'}, {event_schedule:hours});
 assert.ok(email.html.includes(hours));
});
