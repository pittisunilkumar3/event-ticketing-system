const Order = require('../models/Order');
const { asyncHandler } = require('../middleware/errorHandler');

/** POST /api/orders — public checkout (no auth) */
const createPublicOrder = asyncHandler(async (req, res) => {
  const { event_id, customer_name, email, phone, items } = req.body;

  if (!event_id || !customer_name || !email || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'event_id, customer_name, email and at least one item are required.',
    });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  }
  for (const item of items) {
    if (!item.ticket_type_id || !item.qty) {
      return res.status(400).json({ success: false, message: 'Each item needs ticket_type_id and qty.' });
    }
  }

  const { order, tickets } = await Order.createWithTickets({
    event_id,
    customer_name,
    email: email.toLowerCase().trim(),
    phone,
    items,
  });

  res.status(201).json({
    success: true,
    message: 'Booking confirmed! 🎉',
    data: { order, tickets },
  });
});

/** GET /api/admin/orders — list with filters */
const list = asyncHandler(async (req, res) => {
  const { status, event_id, search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const orders = await Order.findAll({ status, event_id, search, limit: Number(limit), offset });
  const total = await Order.countAll({ status, event_id, search });
  res.json({
    success: true,
    data: { orders, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } },
  });
});

/** GET /api/admin/orders/:id — detail with tickets */
const detail = asyncHandler(async (req, res) => {
  const Ticket = require('../models/Ticket');
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const tickets = await Ticket.findByOrderId(order.id);
  res.json({ success: true, data: { order, tickets } });
});

/** PATCH /api/admin/orders/:id/cancel — cancel + release inventory */
const cancel = asyncHandler(async (req, res) => {
  const order = await Order.cancel(req.params.id, 'cancelled');
  res.json({ success: true, message: 'Order cancelled, inventory released', data: { order } });
});

/** PATCH /api/admin/orders/:id/refund — mark refunded + invalidate tickets */
const refund = asyncHandler(async (req, res) => {
  const order = await Order.cancel(req.params.id, 'refunded');
  res.json({ success: true, message: 'Order refunded, tickets invalidated', data: { order } });
});

module.exports = { createPublicOrder, list, detail, cancel, refund };
