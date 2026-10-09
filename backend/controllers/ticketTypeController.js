const TicketType = require('../models/TicketType');
const Event = require('../models/Event');
const { asyncHandler } = require('../middleware/errorHandler');
const Studio = require('../models/Studio');
const { fail } = require('../services/studioValidation');

async function validateFields(input, existing = {}) {
  const values = { ...existing, ...input };
  if (typeof values.name !== 'string' || !values.name.trim() || values.name.length > 100) fail('Ticket name is required (up to 100 characters).');
  if (!Number.isFinite(Number(values.price)) || Number(values.price) < 0 || Number(values.price) > 99999999.99) fail('Enter a valid non-negative price.');
  if (!Number.isInteger(Number(values.quantity)) || Number(values.quantity) < 1 || Number(values.quantity) > 1000000) fail('Capacity must be a whole number between 1 and 1,000,000.');
  for (const field of ['sales_start','sales_end']) if (values[field] && Number.isNaN(new Date(values[field]).getTime())) fail('Enter valid sales dates.');
  if (values.sales_start && values.sales_end && new Date(values.sales_end) <= new Date(values.sales_start)) fail('Sales end must be after sales start.');
  if (input.template_id) {
    const template = await Studio.template(input.template_id);
    if (!template || template.kind !== 'ticket' || !template.active) fail('Choose an active ticket design.');
  }
}

/** GET /api/admin/ticket-types?event_id=1 */
const list = asyncHandler(async (req, res) => {
  const { event_id } = req.query;
  if (!event_id) {
    return res.status(400).json({ success: false, message: 'event_id query param is required.' });
  }
  const types = await TicketType.findByEventId(event_id);
  res.json({ success: true, data: { ticketTypes: types } });
});

/** POST /api/admin/ticket-types */
const create = asyncHandler(async (req, res) => {
  const { event_id, name, price, quantity } = req.body;
  await validateFields(req.body);
  if (!event_id || !name || price === undefined || quantity === undefined) {
    return res.status(400).json({ success: false, message: 'event_id, name, price and quantity are required.' });
  }
  const event = await Event.findById(event_id);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }
  if (Number(price) < 0 || Number(quantity) < 1) {
    return res.status(400).json({ success: false, message: 'Price must be >= 0 and quantity >= 1.' });
  }
  const type = await TicketType.create({
    event_id,
    name,
    description: req.body.description,
    price,
    quantity,
    sales_start: req.body.sales_start || null,
    sales_end: req.body.sales_end || null,
    template_id: req.body.template_id || null,
  });
  res.status(201).json({ success: true, message: 'Ticket type created', data: { ticketType: type } });
});

/** PUT /api/admin/ticket-types/:id */
const update = asyncHandler(async (req, res) => {
  const type = await TicketType.findById(req.params.id);
  if (!type) {
    return res.status(404).json({ success: false, message: 'Ticket type not found' });
  }
  // cannot reduce quantity below already-sold
  await validateFields(req.body, type);
  if (req.body.quantity !== undefined && Number(req.body.quantity) < type.sold) {
    return res.status(400).json({
      success: false,
      message: `Quantity cannot be less than already sold (${type.sold}).`,
    });
  }
  const updated = await TicketType.update(type.id, req.body);
  res.json({ success: true, message: 'Ticket type updated', data: { ticketType: updated } });
});

/** DELETE /api/admin/ticket-types/:id */
const remove = asyncHandler(async (req, res) => {
  const type = await TicketType.findById(req.params.id);
  if (!type) {
    return res.status(404).json({ success: false, message: 'Ticket type not found' });
  }
  if (type.sold > 0) {
    return res.status(409).json({
      success: false,
      message: `Cannot delete — ${type.sold} tickets already sold. Set quantity to 0 or refund orders instead.`,
    });
  }
  await TicketType.remove(type.id);
  res.json({ success: true, message: 'Ticket type deleted' });
});

module.exports = { list, create, update, remove };
