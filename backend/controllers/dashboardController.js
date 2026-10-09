const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

/** GET /api/admin/dashboard — KPIs + charts data */
const stats = asyncHandler(async (req, res) => {
  // KPI cards
  const [[kpi]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM events WHERE status = 'published') AS active_events,
      (SELECT COUNT(*) FROM events WHERE status = 'draft') AS draft_events,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'paid') AS total_revenue,
      (SELECT COUNT(*) FROM orders WHERE status = 'paid') AS paid_orders,
      (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending_orders,
      (SELECT COUNT(*) FROM orders WHERE status IN ('cancelled', 'refunded')) AS cancelled_orders,
      (SELECT COUNT(*) FROM tickets WHERE status = 'valid') AS valid_tickets,
      (SELECT COUNT(*) FROM tickets WHERE status = 'checked_in') AS checked_in_tickets
  `);

  // Revenue + orders per day (last 14 days)
  const [salesTrend] = await db.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
           COUNT(*) AS orders,
           COALESCE(SUM(total_amount), 0) AS revenue
    FROM orders
    WHERE status = 'paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
    GROUP BY date
    ORDER BY date
  `);

  // Top events by revenue
  const [topEvents] = await db.query(`
    SELECT e.id, e.title, e.start_datetime,
           COUNT(o.id) AS orders,
           COALESCE(SUM(o.total_amount), 0) AS revenue,
           (SELECT COUNT(*) FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id
             WHERE tt.event_id = e.id AND t.status != 'cancelled') AS tickets_sold
    FROM events e
    LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'paid'
    GROUP BY e.id, e.title, e.start_datetime
    ORDER BY revenue DESC
    LIMIT 5
  `);

  // Recent orders
  const [recentOrders] = await db.query(`
    SELECT o.id, o.booking_ref, o.customer_name, o.total_amount, o.status, o.created_at,
           e.title AS event_title
    FROM orders o JOIN events e ON e.id = o.event_id
    ORDER BY o.created_at DESC
    LIMIT 8
  `);

  // Upcoming events
  const [upcoming] = await db.query(`
    SELECT id, title, start_datetime, venue, city,
           (SELECT COALESCE(SUM(tt.sold), 0) FROM ticket_types tt WHERE tt.event_id = events.id) AS tickets_sold
    FROM events
    WHERE status = 'published' AND start_datetime >= NOW()
    ORDER BY start_datetime
    LIMIT 5
  `);

  res.json({ success: true, data: { kpi, salesTrend, topEvents, recentOrders, upcoming } });
});

module.exports = { stats };
