const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const Ticket = require('../models/Ticket');
const { eventFields } = require('../services/eventValidation');
const { fail } = require('../services/studioValidation');
const { asyncHandler } = require('../middleware/errorHandler');

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** GET /api/admin/events — list all events (any status) */
const list = asyncHandler(async (req, res) => {
  const { status, category, city, search } = req.query;
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 20)));
  const offset = (page - 1) * limit;
  const archived = req.query.archived === 'true';
  const events = await Event.findAll({ status, category, city, search, limit, offset, archived });
  const total = await Event.countAll({ status, category, city, search, archived });
  res.json({
    success: true,
    data: { events, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } },
  });
});

/** GET /api/admin/events/:id — event detail with ticket types */
const detail = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }
  const ticketTypes = await TicketType.findByEventId(event.id);
  const ticketStats = await Ticket.countByStatus(event.id);
  res.json({ success: true, data: { event, ticketTypes, ticketStats, summary: await Event.summary(event.id) } });
});

/** POST /api/admin/events — create */
const create = asyncHandler(async (req, res) => {
  const fields = eventFields({...req.body, ...(req.file ? {banner_image:require('../middleware/upload').url(req)} : {})});
  const base = slugify(req.body.slug || fields.title) || 'event';
  let slug = base, suffix = 1;
  while (await Event.findBySlug(slug)) slug = `${base}-${++suffix}`;
  const event = await Event.create({...fields,slug});
  res.status(201).json({ success: true, message: 'Event created', data: { event } });
});

/** PUT /api/admin/events/:id — update */
const update = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  if (event.archived_at) fail('Restore this event before editing it.',409);
  const fields = eventFields({...req.body, ...(req.file ? {banner_image:require('../middleware/upload').url(req)} : {})}, event);
  // Keep existing booking-page links stable when an event is renamed.
  const updated = await Event.update(event.id, fields);
  res.json({ success: true, message: 'Event updated', data: { event: updated } });
});

/** DELETE /api/admin/events/:id */
const remove = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }
  await Event.remove(event.id);
  res.json({ success: true, message: 'Event moved to archive. Existing bookings are preserved.' });
});

const status = asyncHandler(async(req,res)=>{
  const event = await Event.findById(req.params.id);
  if(!event) fail('Event not found',404);
  if(event.archived_at) fail('Restore this event before changing its status.',409);
  if(!['draft','published','cancelled'].includes(req.body.status)) fail('Choose a valid status.');
  const updated = await Event.update(event.id,{status:req.body.status});
  res.json({success:true,data:{event:updated},message:req.body.status==='published'?'Event is live.':'Event is off. New bookings are stopped; existing orders are unchanged.'});
});
const restore = asyncHandler(async(req,res)=>{
  if(!await Event.findById(req.params.id)) fail('Event not found',404);
  res.json({success:true,data:{event:await Event.restore(req.params.id)},message:'Event restored as a draft.'});
});
module.exports = { list, detail, create, update, remove, status, restore };
