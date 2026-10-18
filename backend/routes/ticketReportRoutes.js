// Mounted after organizer authentication at /admin/orders/tickets.
const router=require('express').Router();
const {asyncHandler}=require('../middleware/errorHandler');
const report=require('../services/ticketReport');
router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.get('/options',asyncHandler(async(req,res)=>res.json({success:true,data:await report.options(report.filters(req.query))})));
router.get('/export',asyncHandler(async(req,res)=>{
 const filters=report.filters(req.query);
 const rows=report.exportRows(filters);
 try{
  // Start the query before sending headers so database errors remain readable.
  let item=await rows.next();
  res.attachment('individual-tickets-'+filters.booking_group+'.csv');
  res.set('Content-Type','text/csv; charset=utf-8');
  res.set('X-Content-Type-Options','nosniff');
  res.write(report.csvHeader());
  while(!item.done&&!res.destroyed){
   if(!res.write(report.csvRow(item.value))){
    await new Promise(resolve=>{const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);});
   }
   if(res.destroyed)break;
   item=await rows.next();
  }
  res.end();
 }catch(error){if(res.headersSent)res.destroy(error);else throw error;}
 finally{await rows.return();}
}));
router.get('/',asyncHandler(async(req,res)=>res.json({success:true,data:{...await report.list(report.filters(req.query)),organization_name:req.organization.name}})));
module.exports=router;
