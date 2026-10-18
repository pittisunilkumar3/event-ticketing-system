const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../config/db');
const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const forms = require('../services/registrationForms');
const payments = require('../saas/paymentSettings');

test('platform event links resolve published organizers and preserve tenant-scoped tickets, forms and checkout', async () => {
  const originals = {query:db.platform.query,event:Event.findBySlug,types:TicketType.findByEventId,forms:forms.forTickets,form:forms.get,payment:payments.get};
  const legacy = {id:1,slug:'legacy',db_name:'detail_legacy',is_legacy:1,status:'active'};
  const alpha = {id:2,slug:'alpha',db_name:'detail_alpha',is_legacy:0,status:'active'};
  const bravo = {id:3,slug:'bravo',db_name:'detail_bravo',is_legacy:0,status:'active'};
  const suspended = {id:4,slug:'paused',db_name:'detail_paused',is_legacy:0,status:'suspended'};
  const organizations = [legacy,alpha,bravo,suspended];
  const events = new Map();
  const published = slug => ({id:1,slug,title:'Public Expo',status:'published',start_datetime:'2035-12-12 09:00:00',end_datetime:'2035-12-12 18:00:00'});
  events.set(alpha.id,[published('expo'),{...published('draft'),status:'draft'},{...published('archived'),archived_at:'2026-10-01'}]);
  events.set(bravo.id,[published('other')]);
  events.set(suspended.id,[published('paused-event')]);
  let server, catalogReads=0;
  try {
    db.platform.query = async sql => {
      catalogReads++;
      assert.match(sql,/status='active' AND is_legacy=FALSE/);
      return [organizations.filter(org => org.status==='active' && !org.is_legacy)];
    };
    Event.findBySlug = async slug => events.get(db.current().id)?.find(e=>e.slug===slug) || null;
    TicketType.findByEventId = async id => {
      assert.equal(id,1);
      return [{id:1,name:db.current().slug+' pass',quantity:10,sold:2,is_active:1}, {id:2,name:'Disabled',quantity:10,sold:0,is_active:0}];
    };
    forms.forTickets = async () => new Map([[1,{owner:db.current().slug,revision:3}]]);
    forms.get = async () => ({owner:db.current().slug,revision:2});
    payments.get = async () => ({key_id:''});
    const app = express();
    const router = require('../routes/publicRoutes');
    app.use('/api/o/:slug',(req,res,next) => {
      req.organization = organizations.find(o=>o.slug===req.params.slug);
      db.run(req.organization,next);
    },router);
    app.use('/api',(req,res,next) => {req.organization=legacy;db.run(legacy,next);},router);
    app.use((err,req,res,next) => res.status(err.statusCode||500).json({success:false,message:err.message}));
    server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const get=async path=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`);return {status:response.status,body:await response.json()};};
    const platform = await get('/events/expo');
    assert.equal(platform.status,200);
    assert.equal(platform.body.data.checkout_path,'/o/alpha/checkout/expo');
    assert.deepEqual(platform.body.data.ticketTypes.map(t=>[t.id,t.name,t.available]),[[1,'alpha pass',8]]);
    assert.equal(platform.body.data.ticketTypes[0].registrationForm.owner,'alpha');
    assert.equal(platform.body.data.registrationForm.owner,'alpha');
    assert.doesNotMatch(JSON.stringify(platform.body),/db_name|detail_alpha/);
    const reads=catalogReads;
    const organizer = await get('/o/alpha/events/expo');
    assert.equal(organizer.status,200);
    assert.equal(organizer.body.data.checkout_path,undefined);
    const {checkout_path,...details}=platform.body.data;
    assert.deepEqual(details,organizer.body.data);
    assert.equal((await get('/o/bravo/events/expo')).status,404);
    assert.equal(catalogReads,reads,'Organizer routes never search another organization');
    for(const slug of ['draft','archived','paused-event','missing']) assert.equal((await get('/events/'+slug)).status,404);
    events.get(bravo.id).push(published('expo'));
    assert.equal((await get('/events/expo')).status,409,'Ambiguous shared slugs cannot choose a tenant arbitrarily');
    assert.equal((await get('/o/alpha/events/expo')).status,200);
    assert.equal((await get('/o/bravo/events/expo')).status,200);
    events.set(legacy.id,[published('expo')]);
    const existing = await get('/events/expo');
    assert.equal(existing.status,200);
    assert.equal(existing.body.data.checkout_path,undefined,'Existing legacy URLs retain their original owner');
    assert.equal(existing.body.data.ticketTypes[0].name,'legacy pass');
    events.get(alpha.id)[0].status='draft';
    assert.equal((await get('/o/alpha/events/expo')).status,404);
  } finally {
    db.platform.query=originals.query;Event.findBySlug=originals.event;TicketType.findByEventId=originals.types;
    forms.forTickets=originals.forms;forms.get=originals.form;payments.get=originals.payment;
    if(server) await new Promise(resolve=>server.close(resolve));
    await db.end();
  }
});
