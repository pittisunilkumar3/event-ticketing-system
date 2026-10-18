// A platform event can belong to another organizer. A full navigation boots
// that organizer's API/session context before any reservation is submitted.
export function checkoutDestination(data, slug, cart) {
  return (data.checkout_path || '/checkout/' + encodeURIComponent(slug)) +
    '?tickets=' + encodeURIComponent(cart);
}
