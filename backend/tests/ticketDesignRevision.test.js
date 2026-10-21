const test=require('node:test'),assert=require('node:assert/strict');
const {revision,check}=require('../services/ticketDesignRevision');
const row={name:'Original',active:1,config_json:'{"text":{}}',updated_at:'2026-10-21 10:00:00'};
test('old editor tabs cannot restore deleted elements over newer saved designs',()=>{
 const old=revision(row),next={...row,config_json:'{"element_adjustments":{"text_event_title":{"hidden":true}}}'};
 const existing={...next,kind:'ticket',revision:revision(next)};
 assert.throws(()=>check(existing,{revision:old,updated_at:row.updated_at}),{statusCode:409});
 assert.doesNotThrow(()=>check(existing,{revision:existing.revision}));
 assert.throws(()=>check({...existing,updated_at:'2026-10-21 10:01:00'},{updated_at:row.updated_at}),{statusCode:409});
 assert.doesNotThrow(()=>check(existing,{updated_at:row.updated_at}));
 assert.throws(()=>check(existing,{}),{statusCode:409});
});
test('name and status changes invalidate a ticket draft revision',()=>{
 assert.notEqual(revision(row),revision({...row,name:'New name'}));assert.notEqual(revision(row),revision({...row,active:0}));
 assert.doesNotThrow(()=>check({...row,kind:'email'},{}));
});
test('a concurrent save is rejected atomically before it can overwrite the design',async()=>{
 const db=require('../config/db'),Studio=require('../models/Studio'),original=db.query;
 try {
  db.query=async(sql,params)=>{assert.match(sql,/AND config_json=\? AND updated_at=\? AND name=\? AND active=\?/);assert.deepEqual(params.slice(-4),['{"text":{}}',row.updated_at,'Original',true]);return [{affectedRows:0}];};
  await assert.rejects(Studio.saveTemplate({id:1,kind:'ticket',name:'Original',active:true,config:{text:{event_title:''}},expected:{config:{text:{}},updated_at:row.updated_at,name:'Original',active:true}}),{statusCode:409});
 }finally{db.query=original;await db.end();}
});
