const Order = require('../models/Order');
const { string, emailAddress, fail } = require('../services/studioValidation');
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
    if (!item || !item.ticket_type_id || !item.qty) {
      return res.status(400).json({ success: false, message: 'Each item needs ticket_type_id and qty.' });
    }
  }

  string(customer_name,'Name',150,true); emailAddress(email,true);
  string(phone,'Phone',40,true);
  if(!/^\+?[0-9 ()\-.]{6,40}$/.test(phone)||phone.replace(/\D/g,'').length<6) fail('Please provide a valid phone number.');
  const result = await require('../services/bookingPayments').create({
    event_id,
    customer_name,
    email: email.toLowerCase().trim(),
    phone,
    items,
    registration_answers:req.body.registration_answers,
    form_revision:req.body.form_revision,
    registration_files:req.files||[],
  },req.body.request_key);

  res.status(201).json({
    success: true,
    message: result.paid ? 'Booking confirmed!' : 'Complete payment to confirm your booking.',
    data: result,
  });
});

/** GET /api/admin/orders — list with filters */
const list = asyncHandler(async (req, res) => {
  const { status, event_id, search, page = 1, limit = 20 } = req.query;
  const separated=true;
  const booking_group=separated?(req.query.booking_group||'real'):undefined;
  if(separated&&!['real','test'].includes(booking_group))fail('Choose real bookings or test and demo bookings.');
  const offset = (Number(page) - 1) * Number(limit);
  const orders = await Order.findAll({ status, event_id, search, booking_group, limit: Number(limit), offset });
  const total = await Order.countAll({ status, event_id, search, booking_group });
  res.json({
    success: true,
    data: { orders, separate_test_bookings:separated, booking_group:booking_group||'all', organization_name:req.organization.name, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } },
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
  const [[payment]]=await require('../config/db').platform.query('SELECT status,mode,currency,provider_payment_id,provider_refund_id,expires_at FROM booking_payments WHERE organization_id=? AND order_id=?',[req.organization.id,order.id]);
  res.json({ success: true, data: { order, tickets, separate_test_bookings:true, payment:payment||null, attendees:await require('../services/attendees').forOrder(order.id), registration:await require('../services/registrationForms').forOrder(order.id) } });
});

/** PATCH /api/admin/orders/:id/cancel — cancel + release inventory */
const cancel = asyncHandler(async (req, res) => {
  const existing=await Order.findById(req.params.id);
  if(existing?.payment_method.startsWith('razorpay_')){if(req.admin.role!=='super_admin')return res.status(403).json({success:false,message:'Only an organization owner can request a payment refund.'});const payment=await require('../services/bookingPayments').cancelOrder(existing.id);return res.json({success:true,data:{payment},message:'Refund requested. Tickets and wallet update after the provider confirms it.'});}
  const order = await Order.cancel(req.params.id, 'cancelled');
  res.json({ success: true, message: 'Order cancelled, inventory released', data: { order } });
});

/** PATCH /api/admin/orders/:id/refund — mark refunded + invalidate tickets */
const refund = asyncHandler(async (req, res) => {
  const existing=await Order.findById(req.params.id);
  if(existing?.payment_method.startsWith('razorpay_')){if(req.admin.role!=='super_admin')return res.status(403).json({success:false,message:'Only an organization owner can request a payment refund.'});const payment=await require('../services/bookingPayments').cancelOrder(existing.id);return res.json({success:true,data:{payment},message:'Refund requested. Tickets and wallet update after the provider confirms it.'});}
  const order = await Order.cancel(req.params.id, 'refunded');
  res.json({ success: true, message: 'Order refunded, tickets invalidated', data: { order } });
});

module.exports = { createPublicOrder, list, detail, cancel, refund };
