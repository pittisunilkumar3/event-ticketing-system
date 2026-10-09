const Ticket = require('../models/Ticket');
const { asyncHandler } = require('../middleware/errorHandler');

/** GET /api/admin/tickets/:code — validate/lookup a ticket */
const lookup = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findByCode(req.params.code.toUpperCase());
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found. Invalid code.' });
  }
  res.json({ success: true, data: { ticket } });
});

/** POST /api/admin/tickets/checkin — check in by ticket code */
const checkIn = asyncHandler(async (req, res) => {
  const { ticket_code } = req.body;
  if (!ticket_code) {
    return res.status(400).json({ success: false, message: 'ticket_code is required.' });
  }

  const ticket = await Ticket.findByCode(ticket_code.toUpperCase());
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found. Invalid code.' });
  }
  if (ticket.status === 'cancelled' || ticket.order_status === 'cancelled' || ticket.order_status === 'refunded') {
    return res.status(409).json({ success: false, message: '❌ Ticket has been cancelled or refunded.' });
  }
  if (ticket.status === 'checked_in') {
    return res.status(409).json({
      success: false,
      message: `⚠️ Already checked in at ${ticket.checked_in_at}.`,
      data: { ticket },
    });
  }

  const done = await Ticket.checkIn(ticket.ticket_code);
  if (!done) {
    return res.status(409).json({ success: false, message: 'Could not check in this ticket.' });
  }
  const updated = await Ticket.findByCode(ticket.ticket_code);
  res.json({ success: true, message: '✅ Ticket checked in!', data: { ticket: updated } });
});

module.exports = { lookup, checkIn };
