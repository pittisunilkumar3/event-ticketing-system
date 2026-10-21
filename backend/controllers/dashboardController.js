const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const {fail}=require('../services/studioValidation');

/** Tenant-scoped dashboard. Use the same real/demo boundary as the Orders page. */
const stats = asyncHandler(async (req, res) => {
  const days=Number(req.query.days||14);
  if(![14,30,90].includes(days))fail('Choose a 14, 30 or 90 day sales period.');
  const conn=await db.getConnection();
  try {
    await conn.beginTransaction();
    const separated=true;
    const scope=" AND o.archived_at IS NULL AND o.payment_method NOT IN ('mock','razorpay_test')";
    const [[kpi]]=await conn.query(`SELECT
      (SELECT COUNT(*) FROM events WHERE status='published' AND archived_at IS NULL) active_events,
      (SELECT COUNT(*) FROM events WHERE status='draft' AND archived_at IS NULL) draft_events,
      (SELECT COUNT(*) FROM events WHERE status='published' AND archived_at IS NULL AND start_datetime>=NOW()) upcoming_events,
      (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o WHERE o.status='paid' AND o.currency='INR'${scope}) total_revenue,
      (SELECT COUNT(*) FROM orders o WHERE o.status='paid'${scope}) paid_orders,
      (SELECT COUNT(*) FROM orders o WHERE o.status='paid' AND o.currency='INR'${scope}) inr_paid_orders,
      (SELECT COUNT(*) FROM orders o WHERE o.status='pending'${scope}) pending_orders,
      (SELECT COUNT(*) FROM orders o WHERE o.status IN ('cancelled','refunded')${scope}) cancelled_orders,
      (SELECT COUNT(*) FROM tickets t JOIN orders o ON o.id=t.order_id WHERE t.status='valid' AND o.status='paid'${scope}) valid_tickets,
      (SELECT COUNT(*) FROM tickets t JOIN orders o ON o.id=t.order_id WHERE t.status='checked_in' AND o.status='paid'${scope}) checked_in_tickets`);
    const [salesTrend]=await conn.query(`SELECT DATE_FORMAT(o.created_at,'%Y-%m-%d') date,COUNT(*) orders,COALESCE(SUM(o.total_amount),0) revenue
      FROM orders o WHERE o.status='paid' AND o.currency='INR'${scope}
      AND o.created_at>=DATE_SUB(CURDATE(),INTERVAL ? DAY) AND o.created_at<DATE_ADD(CURDATE(),INTERVAL 1 DAY)
      GROUP BY date ORDER BY date`,[days-1]);
    const [topEvents]=await conn.query(`SELECT e.id,e.title,COUNT(o.id) orders,SUM(o.total_amount) revenue
      FROM events e JOIN orders o ON o.event_id=e.id AND o.status='paid' AND o.currency='INR'${scope}
      GROUP BY e.id,e.title HAVING SUM(o.total_amount)>0 ORDER BY revenue DESC,e.id DESC LIMIT 5`);
    const [recentOrders]=await conn.query(`SELECT o.id,o.booking_ref,o.customer_name,o.total_amount,o.currency,o.status,o.created_at,o.payment_method,e.title event_title
      FROM orders o JOIN events e ON e.id=o.event_id WHERE 1=1${scope}
      ORDER BY o.created_at DESC,o.id DESC LIMIT 5`);
    const [upcoming]=await conn.query(`SELECT e.id,e.title,e.start_datetime,e.venue,e.city,
      (SELECT COUNT(*) FROM tickets t JOIN orders o ON o.id=t.order_id WHERE o.event_id=e.id AND o.status='paid' AND t.status IN ('valid','checked_in')${scope}) tickets_sold
      FROM events e WHERE e.status='published' AND e.archived_at IS NULL AND e.start_datetime>=NOW()
      ORDER BY e.start_datetime,e.id LIMIT 4`);
    const [[clock]]=await conn.query("SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') today");
    await conn.commit();
    res.set('Cache-Control','no-store');
    res.json({success:true,data:{kpi,salesTrend,topEvents,recentOrders,upcoming,days,today:clock.today,separate_test_bookings:separated,can_manage_finances:req.admin.role==='super_admin'}});
  } catch(error){await conn.rollback();throw error;}finally{conn.release();}
});
module.exports={stats};
