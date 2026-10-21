const social_links = { facebook: '', instagram: '', linkedin: '', twitter: '', pinterest: '', youtube: '' };
const ticket = {
  layout: 'classic', brand: 'TicketFlow', accent: '#f97316', background: '#111111',
  logo: '', logos: [], banner_image: '', full_banner: false, heading: 'YOUR NEXT GREAT EXPERIENCE',
  footer_text: 'Present this ticket at the entrance. Each QR code admits one guest.',
  show_attendee: true, show_price: true, text: {},
};
const email = {
  format: 2, subject: 'Your booking {{booking_ref}}', title: 'You’re on the guest list.',
  body: '<p>Hi {{customer_name}},</p><p>Your tickets for <strong>{{event_title}}</strong> are ready. We look forward to seeing you.</p>',
  body_2: '<p>Keep your booking reference handy: <strong>{{booking_ref}}</strong></p>',
  logo: '', icon: '', banner_image: '', accent: '#f97316',
  button_name: 'View my tickets', button_url: '{{booking_url}}',
  footer_text: 'Questions about your booking? Contact the event organizer.',
  copyright_text: '© {{year}} {{company_name}}. All rights reserved.',
  attachments: [], attach_ticket_pdf: false,
  page_links: ['privacy-policy', 'terms-and-conditions', 'refund-policy', 'cancellation-policy', 'contact'],
  social_links: { ...social_links }, social_mode: 'brand',
};
const emailEvents = [
  { key: 'booking_confirmed', name: 'Booking confirmed', title: 'You’re on the guest list.', body: email.body },
  { key: 'payment_successful', name: 'Payment successful', title: 'Your payment was successful.', body: '<p>Hi {{customer_name}},</p><p>We received your payment of <strong>{{amount}}</strong> for <strong>{{event_title}}</strong>.</p><p>Your booking reference is <strong>{{booking_ref}}</strong>. Ticket emails are sent separately using the template selected for each pass.</p>', config: {format:9,show_logo:false,logo:'',attach_ticket_pdf:false,button_name:'View booking'} },
  { key: 'booking_cancelled', name: 'Booking cancelled', title: 'Your booking has been cancelled.', body: '<p>Hi {{customer_name}},</p><p>Your booking <strong>{{booking_ref}}</strong> for {{event_title}} has been cancelled. Its tickets are no longer valid.</p>' },
  { key: 'booking_refunded', name: 'Booking refunded', title: 'Your booking is marked as refunded.', body: '<p>Hi {{customer_name}},</p><p>Your booking {{booking_ref}} for {{event_title}} is now marked as refunded. Please contact the organizer for payment details.</p>' },
];
const pages = [
  ['about-us', 'About Us'], ['pricing', 'Tickets & Pricing'],
  ['privacy-policy', 'Privacy Policy'], ['terms-and-conditions', 'Terms & Conditions'],
  ['refund-policy', 'Refund Policy'], ['cancellation-policy', 'Cancellation Policy'], ['contact', 'Contact Us'],
  ['ticket-delivery', 'Ticket Delivery'],
];
const brand = require('../../shared/siteSettings.json');
const smtp = { enabled: false, host: '', port: 587, encryption: 'starttls', username: '', from_name: 'TicketFlow', from_email: '', reply_to: '', password_encrypted: '' };
const placeholders = ['attendee_name','attendee_email','attendee_phone','ticket_type','ticket_code','registration_id','ticket','ticket_qr','ticket_pdf','attachments','registration_fields','submission_url','guidelines_url','customer_name', 'email', 'event_title', 'event_date', 'venue', 'city', 'booking_ref', 'booking_url', 'amount', 'subtotal', 'discount_amount', 'coupon_code', 'tax_amount', 'amount_excluding_tax', 'tax_details', 'ticket_count', 'status', 'company_name', 'support_email', 'year'];
module.exports = { ticket, email, emailEvents, pages, brand, smtp, placeholders, social_links };
