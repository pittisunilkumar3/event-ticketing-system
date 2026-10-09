/**
 * Public (customer-facing) routes — no auth required.
 * Mounted at: /api
 */
const router = require('express').Router();
const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const orderController = require('../controllers/orderController');
const { asyncHandler } = require('../middleware/errorHandler');
const Studio = require('../models/Studio');
const { socialLinks } = require('../services/studioValidation');

router.get('/social-links', asyncHandler(async (req, res) => {
  res.json({ success: true, data: { socialLinks: socialLinks(await Studio.getSetting('social_links')) } });
}));

router.get('/pages', asyncHandler(async (req, res) => {
  const pages = (await Studio.pages(true)).map(({ slug, title }) => ({ slug, title }));
  res.json({ success: true, data: { pages } });
}));
router.get('/pages/:slug', asyncHandler(async (req, res) => {
  const page = (await Studio.pages(true)).find(p => p.slug === req.params.slug);
  if (!page) return res.status(404).json({ success: false, message: 'This page has not been published yet.' });
  res.json({ success: true, data: { page } });
}));

// GET /api/events — browse published events
router.get(
  '/events',
  asyncHandler(async (req, res) => {
    const { category, city, search } = req.query;
    const events = await Event.findAll({ status: 'published', category, city, search, limit: 100 });
    const filters = await Event.distinctFilters();
    res.json({ success: true, data: { events, filters } });
  })
);

// GET /api/events/filters — available categories & cities
router.get(
  '/events/filters',
  asyncHandler(async (req, res) => {
    const filters = await Event.distinctFilters();
    res.json({ success: true, data: filters });
  })
);

// GET /api/events/:slug — event detail with ticket types & availability
router.get(
  '/events/:slug',
  asyncHandler(async (req, res) => {
    const event = await Event.findBySlug(req.params.slug);
    if (!event || event.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const ticketTypes = await TicketType.findByEventId(event.id);
    const now = new Date();
    const types = ticketTypes.map((tt) => ({
      ...tt,
      available: Math.max(tt.quantity - tt.sold, 0),
      is_on_sale:
        (!tt.sales_start || new Date(tt.sales_start) <= now) && (!tt.sales_end || new Date(tt.sales_end) >= now),
    }));
    res.json({ success: true, data: { event, ticketTypes: types } });
  })
);

// POST /api/orders — checkout (create order + issue tickets)
router.post('/orders', orderController.createPublicOrder);

// GET /api/bookings/:ref — "My Bookings" lookup by booking reference
router.get(
  '/bookings/:ref',
  asyncHandler(async (req, res) => {
    const order = await Order.findByRef(req.params.ref.toUpperCase());
    if (!order) {
      return res.status(404).json({ success: false, message: 'Booking not found. Check your reference.' });
    }
    const tickets = await Ticket.findByOrderId(order.id);
    res.json({ success: true, data: { order, tickets } });
  })
);

module.exports = router;
