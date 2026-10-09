const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');
const Studio = require('../models/Studio');
const db = require('../config/db');
const { decrypt } = require('./secrets');
const { renderEmail } = require('./emailRenderer');
function transport(smtp) {
  if (!smtp.host || !smtp.from_email) throw new Error('Save your SMTP host and sender email first.');
  return nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.encryption === 'tls', requireTLS: smtp.encryption === 'starttls',
    auth: smtp.username ? { user: smtp.username, pass: decrypt(smtp.password_encrypted) } : undefined,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  });
}
async function send(smtp, to, rendered, messageId) {
  const t = transport(smtp);
  try {
    const result = await t.sendMail({
      from: { name: smtp.from_name, address: smtp.from_email }, to: { address: to },
      replyTo: smtp.reply_to || undefined, ...rendered, messageId,
      text: sanitizeHtml(rendered.html.replace(/<\/(p|h1|div|tr)>/g,'\n'),{allowedTags:[],allowedAttributes:{}}),
    });
    if (!result.accepted?.length || result.rejected?.length) throw new Error('SMTP server rejected the recipient.');
    return result.messageId;
  } finally { t.close(); }
}
async function enqueue(conn, orderId, eventKey) {
  const smtp = await Studio.getSetting('smtp',conn);
  const [templates] = await conn.query('SELECT active FROM design_templates WHERE event_key=?', [eventKey]);
  const enabled = smtp.enabled && templates[0]?.active;
  await conn.query('INSERT IGNORE INTO mail_outbox (order_id,event_key,status,error_message) VALUES (?,?,?,?)',
    [orderId,eventKey,enabled ? 'pending' : 'skipped',enabled ? null : 'Email delivery or this template was disabled at booking time.']);
}
let working = false;
async function processOutbox() {
  if (working) return;
  working = true;
  try {
    const smtp = await Studio.getSetting('smtp');
    if (!smtp.enabled) return;
    // An interrupted send has an uncertain outcome. Require an explicit retry rather than silently sending twice.
    await db.query("UPDATE mail_outbox SET status='failed',error_message='Delivery interrupted. Check the recipient before retrying.' WHERE status='sending' AND updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)");
    const [jobs] = await db.query("SELECT * FROM mail_outbox WHERE status='pending' ORDER BY id LIMIT 5");
    for (const job of jobs) {
      const [claim] = await db.query("UPDATE mail_outbox SET status='sending',attempts=attempts+1 WHERE id=? AND status='pending'", [job.id]);
      if (!claim.affectedRows) continue;
      try {
        const [templates] = await db.query('SELECT * FROM design_templates WHERE event_key=? AND active=1', [job.event_key]);
        if (!templates.length) {
          await db.query("UPDATE mail_outbox SET status='skipped',error_message='Template disabled before delivery.' WHERE id=?",[job.id]); continue;
        }
        const Order = require('../models/Order');
        const order = await Order.findById(job.order_id);
        if (job.event_key === 'booking_confirmed' && order.status !== 'paid') {
          await db.query("UPDATE mail_outbox SET status='skipped',error_message='Booking is no longer paid.' WHERE id=?",[job.id]); continue;
        }
        const [counts] = await db.query('SELECT COUNT(*) AS n FROM tickets WHERE order_id=?',[order.id]);
        const brand = await Studio.getSetting('brand');
        const rendered = renderEmail(JSON.parse(templates[0].config_json),brand,{
          customer_name: order.customer_name, email: order.email, event_title: order.event_title,
          event_date: order.event_start, venue: order.venue, city: order.city, booking_ref: order.booking_ref,
          booking_url: brand.site_url.replace(/\/$/,'') + '/confirmation/' + order.booking_ref,
          amount: new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(order.total_amount),
          ticket_count: counts[0].n, status: order.status,
        }, await Studio.pages(true), await Studio.getSetting('social_links'));
        const messageId = await send(smtp,order.email,rendered,`<ticketflow-${job.id}@${new URL(brand.site_url).hostname}>`);
        await db.query("UPDATE mail_outbox SET status='sent',message_id=?,error_message=NULL WHERE id=?",[messageId,job.id]);
      } catch {
        // SMTP errors can contain credentials/provider internals; keep customer-facing logs safe.
        await db.query("UPDATE mail_outbox SET status='failed',error_message='Delivery failed. Verify SMTP settings and recipient, then retry.' WHERE id=?",[job.id]);
      }
    }
  } finally { working = false; }
}
function startWorker() {
  const timer = setInterval(() => processOutbox().catch(() => {}),10000);
  timer.unref();
}
module.exports = { transport, send, enqueue, processOutbox, startWorker };
