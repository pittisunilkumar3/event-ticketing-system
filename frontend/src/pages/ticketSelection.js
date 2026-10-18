export function isVisibleTicket(ticket) {
  return !ticket.archived_at && ticket.sale_status !== 'paused' && (ticket.is_active == null || Number(ticket.is_active) === 1);
}
export function ticketLimit(ticket) {
  return Math.max(0, Math.min(Number(ticket.available), Number(ticket.max_per_order)));
}
export function canSelectTicket(ticket) {
  return isVisibleTicket(ticket) && Boolean(ticket.is_on_sale) && ticketLimit(ticket) >= Number(ticket.min_per_order);
}
export function validQuantity(ticket, value) {
  const quantity = Number(value);
  return canSelectTicket(ticket) && Number.isInteger(quantity) && quantity >= Number(ticket.min_per_order) && quantity <= ticketLimit(ticket) ? quantity : 0;
}
export function nextQuantity(ticket, current, delta) {
  if (!canSelectTicket(ticket)) return 0;
  const quantity = validQuantity(ticket, current);
  if (delta < 0) return quantity <= Number(ticket.min_per_order) ? 0 : quantity - 1;
  return quantity === 0 ? Number(ticket.min_per_order) : Math.min(quantity + 1, ticketLimit(ticket));
}
