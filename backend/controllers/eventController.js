const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const Ticket = require('../models/Ticket');
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
  const { status, category, city, search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const events = await Event.findAll({ status, category, city, search, limit: Number(limit), offset });
  const total = await Event.countAll({ status, category, city, search });
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
  res.json({ success: true, data: { event, ticketTypes, ticketStats } });
});

/** POST /api/admin/events — create */
const create = asyncHandler(async (req, res) => {
  const { title, description, category, venue, city, start_datetime, end_datetime, status } = req.body;
  if (!title || !start_datetime) {
    return res.status(400).json({ success: false, message: 'Title and start date/time are required.' });
  }

  let slug = req.body.slug ? slugify(req.body.slug) : slugify(title);
  // ensure unique slug
  let suffix = 1;
  while (await Event.findBySlug(slug)) {
    slug = `${slugify(title)}-${++suffix}`;
  }

  const banner = req.file ? `/uploads/${req.file.filename}` : req.body.banner_image || null;

  const event = await Event.create({
    title,
    slug,
    description,
    category,
    venue,
    city,
    banner_image: banner,
    start_datetime,
    end_datetime: end_datetime || null,
    status: status || 'draft',
  });
  res.status(201).json({ success: true, message: 'Event created', data: { event } });
});

/** PUT /api/admin/events/:id — update */
const update = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  const fields = { ...req.body };
  if (fields.title && fields.title !== event.title && !fields.slug) {
    fields.slug = slugify(fields.title);
    let suffix = 1;
    let candidate = fields.slug;
    let existing = await Event.findBySlug(candidate);
    while (existing && existing.id !== event.id) {
      candidate = `${slugify(fields.title)}-${++suffix}`;
      existing = await Event.findBySlug(candidate);
    }
    fields.slug = candidate;
  }
  if (req.file) {
    fields.banner_image = `/uploads/${req.file.filename}`;
  }

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
  res.json({ success: true, message: 'Event deleted' });
});

module.exports = { list, detail, create, update, remove };
