const { fail, string, emailAddress, url } = require('./studioValidation');
function date(value, label, required = false) {
  if (value == null || value === '') {
    if (required) fail(`${label} is required.`);
    return null;
  }
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value) ||
    Number.isNaN(new Date(value.replace(' ', 'T')).getTime())
  )
    fail(`${label} is invalid.`);
  const [year, month, day, hour, minute, second = 0] = value
    .split(/[- T:]/)
    .map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, second);
  if (
    year < 1000 ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    fail(`${label} is invalid.`);
  return value.replace('T', ' ') + (value.length === 16 ? ':00' : '');
}
function eventFields(input, previous = {}) {
  const data = { ...previous, ...input };
  const out = {};
  for (const [key, max] of Object.entries({
    title: 200,
    description: 60000,
    category: 80,
    venue: 200,
    city: 100,
    summary: 300,
    address: 500,
    organizer_name: 150,
    age_policy: 150,
    highlights: 5000,
    entry_instructions: 5000,
  })) {
    out[key] = string(
      data[key] ?? '',
      key.replaceAll('_', ' '),
      max,
      key === 'title'
    );
  }
  out.organizer_email = emailAddress(data.organizer_email || '');
  out.start_datetime = date(data.start_datetime, 'Start date', true);
  out.end_datetime = date(data.end_datetime, 'End date');
  if (out.end_datetime && out.end_datetime <= out.start_datetime)
    fail('End date must be after start date.');
  out.status = data.status || 'draft';
  if (!['draft', 'published', 'cancelled'].includes(out.status))
    fail('Choose a valid event status.');
  out.banner_image = url(data.banner_image || '', { image: true }) || null;
  if (out.banner_image?.length > 255)
    fail('Banner URL is too long. Please upload the image.');
  return out;
}
function availability(event, type, now = new Date()) {
  if (event.archived_at || event.status !== 'published') return 'unavailable';
  if (
    new Date(
      String(event.end_datetime || event.start_datetime).replace(' ', 'T')
    ) <= now
  )
    return 'ended';
  if (type.archived_at || !Number(type.is_active)) return 'paused';
  if (
    type.sales_start &&
    new Date(String(type.sales_start).replace(' ', 'T')) > now
  )
    return 'scheduled';
  if (
    type.sales_end &&
    new Date(String(type.sales_end).replace(' ', 'T')) <= now
  )
    return 'ended';
  if (type.quantity - type.sold < type.min_per_order) return 'sold_out';
  return 'on_sale';
}
module.exports = { date, eventFields, availability };
