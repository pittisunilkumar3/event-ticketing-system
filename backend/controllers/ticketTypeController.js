const TicketType = require('../models/TicketType');
const Event = require('../models/Event');
const { asyncHandler } = require('../middleware/errorHandler');
const Studio = require('../models/Studio');
const { fail, url } = require('../services/studioValidation');
const { date } = require('../services/eventValidation');
const db = require('../config/db');

async function validateFields(input, existing = {}) {
  const values = {min_per_order:1,max_per_order:10,sort_order:0,is_active:true,...existing, ...input };
  for (const key of ['min_per_order','max_per_order']) if(!Number.isInteger(Number(values[key])) || Number(values[key])<1 || Number(values[key])>100) fail('Tickets per order must be between 1 and 100.');
  if(Number(values.min_per_order)>Number(values.max_per_order)) fail('Minimum per order must not exceed maximum.');
  if(!Number.isInteger(Number(values.sort_order)) || Math.abs(Number(values.sort_order))>10000) fail('Display order must be a whole number between -10000 and 10000.');
  if(![true,false,0,1].includes(values.is_active)) fail('Choose whether ticket sales are on or off.');
  if(values.description && (typeof values.description!=='string' || values.description.length>255)) fail('Ticket description must be under 255 characters.');
  if(values.price===null || values.price==='') fail('Price is required.');
  if (typeof values.name !== 'string' || !values.name.trim() || values.name.length > 100) fail('Ticket name is required (up to 100 characters).');
  if (!Number.isFinite(Number(values.price)) || Number(values.price) < 0 || Number(values.price) > 99999999.99) fail('Enter a valid non-negative price.');
  if (!Number.isInteger(Number(values.quantity)) || Number(values.quantity) < 1 || Number(values.quantity) > 1000000) fail('Capacity must be a whole number between 1 and 1,000,000.');
  for (const field of ['sales_start','sales_end']) if (values[field] && Number.isNaN(new Date(values[field]).getTime())) fail('Enter valid sales dates.');
  if (values.sales_start && values.sales_end && new Date(values.sales_end) <= new Date(values.sales_start)) fail('Sales end must be after sales start.');
  if(input.email_template_id!=null&&input.email_template_id!==''){
    if(!Number.isSafeInteger(Number(input.email_template_id))||Number(input.email_template_id)<1)fail('Choose a valid email template.');
    const email=await Studio.template(input.email_template_id);
    if(!email||email.kind!=='email'||email.event_key||!email.active)fail('Choose an active custom email template from this organization.');
  }
  for(const key of ['submission_url','guidelines_url'])if(input[key])url(input[key]);
  if (input.template_id && Number(input.template_id)!==Number(existing.template_id)) {
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
  if(event.archived_at) fail('Restore the event before adding tickets.',409);
  if (Number(price) < 0 || Number(quantity) < 1) {
    return res.status(400).json({ success: false, message: 'Price must be >= 0 and quantity >= 1.' });
  }
  const type = await TicketType.create({
    event_id,
    name,
    description: req.body.description,
    price,
    quantity,
    sales_start: date(req.body.sales_start,'Sales start'),
    sales_end: date(req.body.sales_end,'Sales end'),
    is_active:req.body.is_active ?? true, min_per_order:req.body.min_per_order ?? 1, max_per_order:req.body.max_per_order ?? 10, sort_order:req.body.sort_order ?? 0,
    template_id: req.body.template_id || null,
    email_template_id:req.body.email_template_id||null,submission_url:req.body.submission_url||null,guidelines_url:req.body.guidelines_url||null,
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
  if(type.archived_at) fail('Restore the ticket type before editing.',409);
  const fields={...req.body};
  for(const key of ['email_template_id','submission_url','guidelines_url'])if(key in fields&&!fields[key])fields[key]=null;
  for(const key of ['sales_start','sales_end']) if(key in fields) fields[key]=date(fields[key],key);
  const updated = await TicketType.update(type.id, fields);
  res.json({ success: true, message: 'Ticket type updated', data: { ticketType: updated } });
});

/** DELETE /api/admin/ticket-types/:id */
const remove = asyncHandler(async (req, res) => {
  const type = await TicketType.findById(req.params.id);
  if (!type) {
    return res.status(404).json({ success: false, message: 'Ticket type not found' });
  }
  await TicketType.remove(type.id);
  res.json({ success: true, message: 'Ticket type archived. Issued tickets are preserved.' });
});

const restore=asyncHandler(async(req,res)=>{
  if(!await TicketType.findById(req.params.id)) fail('Ticket type not found',404);
  await db.query('UPDATE ticket_types SET archived_at=NULL,is_active=0 WHERE id=?',[req.params.id]);
  res.json({success:true,message:'Ticket restored with sales off.'});
});
module.exports = { list, create, update, remove, restore };
