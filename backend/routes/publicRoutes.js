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
const { availability } = require('../services/eventValidation');
const { socialLinks } = require('../services/studioValidation');
router.use(['/site-settings','/social-links','/pages','/events'],(_req,res,next)=>{res.set('Cache-Control','no-store');next();});

router.get('/site-settings', asyncHandler(async (req,res) => {
  const settings = require('../services/siteSettings').publicSiteSettings(req.organization.is_legacy ? await require('../saas/website').brand() : await Studio.getSetting('brand'));
  res.json({success:true,data:{settings:{...settings,is_organizer:!req.organization.is_legacy}}});
}));

router.get('/social-links', asyncHandler(async (req, res) => {
  res.json({ success: true, data: { socialLinks: req.organization.is_legacy ? await require('../saas/website').social() : socialLinks(await Studio.getSetting('social_links')) } });
}));

router.get('/pages', asyncHandler(async (req, res) => {
  const pages = (await (req.organization.is_legacy ? require('../saas/website').pages(true) : Studio.pages(true))).map(({ slug, title }) => ({ slug, title }));
  res.json({ success: true, data: { pages } });
}));
router.get('/pages/:slug', asyncHandler(async (req, res) => {
  const page = (await (req.organization.is_legacy ? require('../saas/website').pages(true) : Studio.pages(true))).find(p => p.slug === req.params.slug);
  if (!page) return res.status(404).json({ success: false, message: 'This page has not been published yet.' });
  res.json({ success: true, data: { page } });
}));

// GET /api/events — browse published events
router.get(
  '/events',
  asyncHandler(async (req, res) => {
    const { category, city, search } = req.query;
    if(req.organization.is_legacy) return res.json({success:true,data:await require('../services/publicEventCatalog').list({category,city,search})});
    const events = await Event.findAll({ status: 'published', category, city, search, limit: 100 });
    const filters = await Event.distinctFilters();
    res.json({ success: true, data: { events, filters } });
  })
);

router.get('/events/stream',require('../services/eventUpdates').stream);

// GET /api/events/filters — available categories & cities
router.get(
  '/events/filters',
  asyncHandler(async (req, res) => {
    if(req.organization.is_legacy) return res.json({success:true,data:(await require('../services/publicEventCatalog').list()).filters});
    const filters = await Event.distinctFilters();
    res.json({ success: true, data: filters });
  })
);

// GET /api/events/:slug — event detail with ticket types & availability
router.get(
  '/events/:slug',
  asyncHandler(async (req, res) => {
    let event = await Event.findBySlug(req.params.slug);
    let organization = req.organization;
    if ((!event || event.status !== 'published' || event.archived_at) && req.organization.is_legacy) {
      const match = await require('../services/publicEventCatalog').findBySlug(req.params.slug);
      if (match) ({event,organization} = match);
    }
    if (!event || event.status !== 'published' || event.archived_at) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    // Ticket IDs and form IDs can overlap across tenants. Read every detail in
    // the resolved organizer and send checkout to that same organizer's app.
    await require('../config/db').run(organization, async () => {
      const ticketTypes = await TicketType.findByEventId(event.id);
      const now = new Date();
      const types = ticketTypes.filter(tt=>!tt.archived_at && Number(tt.is_active)===1).map((tt) => ({
        ...tt,
        available: Math.max(tt.quantity - tt.sold, 0),
        sale_status: availability(event,tt,now),
        is_on_sale: availability(event,tt,now)==='on_sale',
      }));
      const forms=require('../services/registrationForms'),ticketForms=await forms.forTickets(event.id);
      const checkout = organization.id !== req.organization.id
        ? {checkout_path:'/o/'+encodeURIComponent(organization.slug)+'/checkout/'+encodeURIComponent(event.slug)} : {};
      res.json({ success: true, data: { event, ...checkout, ticketTypes: types.map(type=>({...type,registrationForm:ticketForms.get(type.id)})), payment:require('../saas/paymentSettings').safe(await require('../saas/paymentSettings').get()), registrationForm:await forms.get(event.id) } });
    });
  })
);

// POST /api/orders — checkout (create order + issue tickets)
router.post('/orders', require('../saas/tenancy').rateLimit(20,60000), require('../middleware/registrationUpload'), orderController.createPublicOrder);


router.post('/booking-payments/verify', require('../saas/tenancy').rateLimit(60,60000), asyncHandler(async(req,res)=>res.json({success:true,data:await require('../services/bookingPayments').verify(req.get('x-booking-token'),req.body)})));
router.post('/booking-payments/status', require('../saas/tenancy').rateLimit(60,60000), asyncHandler(async(req,res)=>res.json({success:true,data:await require('../services/bookingPayments').resume(req.get('x-booking-token'))})));

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
