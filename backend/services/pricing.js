const db=require('../config/db'),coupons=require('./coupons'),taxes=require('./taxes');
async function preview(input){
 const conn=await db.getConnection();
 try{await conn.beginTransaction();const items=await coupons.resolveCart(input,conn),coupon=await coupons.calculate(conn,input,items),tax=await taxes.calculate(conn,input.event_id,items,coupon);if(tax.total_minor>0&&tax.total_minor<100)require('./studioValidation').fail('The final booking amount must be at least ₹1.');const result={...coupon,total_minor:tax.total_minor,tax,pricing_token:taxes.token(input.event_id,coupon,tax)};await conn.commit();return result;}catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
module.exports={preview};
