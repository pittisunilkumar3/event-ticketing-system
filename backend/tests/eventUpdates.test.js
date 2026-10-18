const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const updates=require('../services/eventUpdates');
function response(){const r=new EventEmitter();r.statusCode=200;r.chunks=[];r.set=x=>r.headers=x;r.flushHeaders=()=>{};r.write=x=>r.chunks.push(x);return r;}
test('successful mutations notify platform and affected organizer only; errors and reads do not',()=>{
 const platform=response(),one=response(),two=response();
 for(const [res,id,legacy] of [[platform,1,1],[one,2,0],[two,3,0]])updates.stream({organization:{id,is_legacy:legacy}},res);
 try{
  assert.equal(platform.headers['X-Accel-Buffering'],'no');
  const change=(method,path,status=200)=>{const res=response();res.statusCode=status;updates.afterMutation({method,path,organization:{id:2}},res,()=>{});res.emit('finish');};
  change('PATCH','/admin/events/1/status');change('PUT','/admin/ticket-types/1');
  assert.equal(platform.chunks.filter(s=>s.includes('event: changed')).length,2);assert.equal(one.chunks.filter(s=>s.includes('event: changed')).length,2);assert.equal(two.chunks.filter(s=>s.includes('event: changed')).length,0);
  change('PATCH','/admin/events/1/status',403);change('GET','/admin/events');change('POST','/auth/login');assert.equal(one.chunks.length,3);
  one.emit('close');change('DELETE','/admin/events/1');assert.equal(one.chunks.length,3);assert.equal(platform.chunks.length,4);
  assert(platform.chunks.slice(1).every(s=>s==='event: changed\ndata: {}\n\n'));
 }finally{platform.emit('close');one.emit('close');two.emit('close');}
});
