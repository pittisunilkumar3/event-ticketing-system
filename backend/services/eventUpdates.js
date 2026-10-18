// Public invalidation notices contain no event, customer or authentication data.
const clients=new Set();
function publish(organizationId){for(const client of clients)if(client.platform||client.organizationId===organizationId)client.res.write('event: changed\ndata: {}\n\n');}
function afterMutation(req,res,next){
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&/^\/admin\/(events|ticket-types)(\/|$)/.test(req.path)){
    const id=req.organization.id;
    res.once('finish',()=>{if(res.statusCode>=200&&res.statusCode<300)publish(id);});
  }
  next();
}
function stream(req,res){
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no','Connection':'keep-alive'});
  res.flushHeaders();
  res.write('retry: 2000\nevent: ready\ndata: {}\n\n');
  const client={res,organizationId:req.organization.id,platform:!!req.organization.is_legacy};clients.add(client);
  const timer=setInterval(()=>res.write(': heartbeat\n\n'),15000);timer.unref();
  res.once('close',()=>{clearInterval(timer);clients.delete(client);});
}
module.exports={afterMutation,stream,publish};
