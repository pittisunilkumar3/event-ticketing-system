const test=require('node:test'),assert=require('node:assert/strict');
const {renderTicketDocument}=require('../generated/ticketDocument.cjs');
const layouts=require('../services/ticketLayouts'),defaults=require('../services/studioDefaults').ticket;
const ticket={id:42,attendee_name:'Alexandra Catherine Morgan Patel',ticket_code:'TCK-ACTUAL-1234',status:'valid'};
const order={event_title:'Cinematica Expo 2026',event_start:'2026-12-12 09:00:00',venue:'Main Hall',city:'Hyderabad',booking_ref:'TKT-1234',currency:'INR'};
test('every selected design is rendered with the shared issued-ticket component',()=>{
 for(const item of layouts){
  const html=renderTicketDocument({design:{...defaults,...item.config,type_name:'Selected pass',price:1999},ticket,order});
  assert.match(html,new RegExp('ticket-layout-'+item.id));
  assert.match(html,/Alexandra Catherine Morgan Patel/);
  assert.match(html,/TCK-ACTUAL-1234/);
  assert.match(html,/Selected pass/i);
  assert.doesNotMatch(html,/PREVIEW ONLY/);
 }
});
test('preview QR is invalid and hidden attendee/price settings are respected',()=>{
 const html=renderTicketDocument({design:{...defaults,show_attendee:false,show_price:false},ticket,order,preview:true});
 assert.match(html,/PREVIEW ONLY/);assert.doesNotMatch(html,/TCK-ACTUAL-1234|Alexandra Catherine|TICKET PRICE/);
});
test('ticket content and branding are escaped in the PDF document',()=>{
 const html=renderTicketDocument({design:{...defaults,brand:'<script>bad</script>'},ticket:{...ticket,attendee_name:'<img src=x onerror=bad>'},order});
 assert.doesNotMatch(html,/<script>|<img src="x"/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);
});
