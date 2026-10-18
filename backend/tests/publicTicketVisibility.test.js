const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const Event=require('../models/Event'),TicketType=require('../models/TicketType'),forms=require('../services/registrationForms'),payments=require('../saas/paymentSettings'),db=require('../config/db');
test('public event hides disabled and archived passes while retaining enabled scheduled and sold-out passes',async()=>{
 const originals={event:Event.findBySlug,types:TicketType.findByEventId,forms:forms.forTickets,form:forms.get,payment:payments.get};
 let server;
 try{
 Event.findBySlug=async()=>({id:1,status:'published',start_datetime:'2035-12-12 09:00:00',end_datetime:'2035-12-12 18:00:00'});
 const base={quantity:100,sold:0,is_active:1,min_per_order:1,max_per_order:10};
 const types=[{...base,id:1,name:'Enabled'},{...base,id:2,name:'Off',is_active:0},{...base,id:3,name:'Archived',archived_at:'2026-01-01'},{...base,id:4,name:'Scheduled',sales_start:'2035-12-01 00:00:00'},{...base,id:5,name:'Sold out',sold:100}];
 TicketType.findByEventId=async()=>types;
 forms.forTickets=async()=>new Map(types.map(t=>[t.id,{fields:[]} ]));forms.get=async()=>({fields:[]});payments.get=async()=>({key_id:''});
 const app=express();app.use((req,res,next)=>{req.organization={id:2,is_legacy:false};next();});app.use(require('../routes/publicRoutes'));
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const response=await fetch(`http://127.0.0.1:${server.address().port}/events/example`);assert.equal(response.status,200);const json=await response.json();assert.deepEqual(json.data.ticketTypes.map(t=>t.id),[1,4,5]);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(types.length,5); // Visibility filtering does not change the organizer's records.
 types[0].is_active=0;const changed=await(await fetch(`http://127.0.0.1:${server.address().port}/events/example`)).json();assert.deepEqual(changed.data.ticketTypes.map(t=>t.id),[4,5]);
 types[0].is_active=1;const restored=await(await fetch(`http://127.0.0.1:${server.address().port}/events/example`)).json();assert.deepEqual(restored.data.ticketTypes.map(t=>t.id),[1,4,5]);
 }finally{Event.findBySlug=originals.event;TicketType.findByEventId=originals.types;forms.forTickets=originals.forms;forms.get=originals.form;payments.get=originals.payment;if(server)await new Promise(r=>server.close(r));await db.end();}
});
