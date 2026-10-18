const test=require('node:test'),assert=require('node:assert/strict');
const db=require('../config/db'),Event=require('../models/Event');
test('platform catalog combines published tenant cards with unique links, filters and public-only fields',async()=>{
 const originalQuery=db.platform.query,originalFind=Event.findAll,originalFilters=Event.distinctFilters;
 try{
  db.platform.query=async sql=>{assert.match(sql,/WHERE status='active'/);return [[{id:1,slug:'legacy',db_name:'catalog_legacy',is_legacy:1},{id:2,slug:'alpha',db_name:'catalog_alpha',is_legacy:0},{id:3,slug:'bravo',db_name:'catalog_bravo',is_legacy:0}]];};
  Event.findAll=async opts=>{assert.equal(opts.status,'published');assert.equal(opts.archived,false);assert.equal(opts.search,'Expo');assert.equal(opts.city,'Hyderabad');const org=db.current();return [{id:1,title:'Expo '+org.slug,slug:'same-slug',start_datetime:'2035-01-01',status:'published',min_price:999,revenue:4000,organizer_email:'private@example.test'}];};
  Event.distinctFilters=async()=>({categories:['Expo'],cities:['Hyderabad']});
  const result=await require('../services/publicEventCatalog').list({search:'Expo',city:'Hyderabad',status:'draft',archived:true});
  assert.equal(result.events.length,3);assert.equal(new Set(result.events.map(e=>e.public_key)).size,3);
  assert.deepEqual(result.events.map(e=>e.public_path),['/events/same-slug','/o/alpha/events/same-slug','/o/bravo/events/same-slug']);
  assert.deepEqual(result.filters,{categories:['Expo'],cities:['Hyderabad']});
  for(const e of result.events){assert.equal(e.revenue,undefined);assert.equal(e.organizer_email,undefined);assert.equal(e.db_name,undefined);}
 }finally{db.platform.query=originalQuery;Event.findAll=originalFind;Event.distinctFilters=originalFilters;await db.end();}
});
