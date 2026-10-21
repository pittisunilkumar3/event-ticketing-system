export function eventMapsUrl(event) {
  const venue = String(event.venue || '').trim();
  const address = String(event.address || '').trim();
  const city = String(event.city || '').trim();
  if (!venue && !address) return null;
  const parts = address ? [address] : [];
  if (venue && !address.toLowerCase().includes(venue.toLowerCase())) parts.unshift(venue);
  if (city && !parts.join(', ').toLowerCase().includes(city.toLowerCase())) parts.push(city);
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(parts.join(', '));
}

export default function EventVenueLink({event}) {
  const href = eventMapsUrl(event);
  const label = event.venue || event.address || 'Venue to be announced';
  return href ? <a className="event-venue-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} — Open in Google Maps`}>{label}</a> : label;
}
