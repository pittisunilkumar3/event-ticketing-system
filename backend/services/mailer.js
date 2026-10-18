const nodemailer = require('nodemailer');
const crypto = require('node:crypto');
const sanitizeHtml = require('sanitize-html');
const Studio = require('../models/Studio');
const db = require('../config/db');
const { decrypt } = require('./secrets');
const ticketEmails=require('./ticketEmails');
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
  if (!smtp.enabled) throw new Error("Email delivery is disabled.");
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
  const smtp = await Studio.getSetting('smtp');
  if(eventKey==='payment_successful')await Studio.ensureEmailTemplate(eventKey,conn);
  const [templates] = await conn.query('SELECT * FROM design_templates WHERE event_key=?', [eventKey]);
  let enabled = smtp.enabled && templates[0]?.active;
  let confirmedDefault=null;
  const [[order]] = await conn.query('SELECT customer_name,email FROM orders WHERE id=?',[orderId]);
  if (!order) throw new Error('Booking not found for email delivery.');
  // Confirmations are ticket deliveries. Only the separate payment-success
  // event sends a buyer receipt, so assigned pass templates are not duplicated.
  const recipients = eventKey!=='booking_confirmed'&&order.email?.trim()?[{key:'booking',email:order.email.trim().toLowerCase(),name:order.customer_name}]:[];
  // A shared address receives one complete booking email, even if it covers several attendees.
  const seen = new Set(recipients.map(r=>r.email));
  if (eventKey === 'booking_confirmed') {
    const [issued]=await conn.query('SELECT t.id,t.attendee_id,t.attendee_name,t.email_snapshot,a.email FROM tickets t LEFT JOIN order_attendees a ON a.id=t.attendee_id WHERE t.order_id=? ORDER BY t.id',[orderId]);
    confirmedDefault=issued.map(t=>t.email_snapshot?JSON.parse(t.email_snapshot).default_template:null).find(Boolean)||null;
    if(confirmedDefault)enabled=smtp.enabled&&confirmedDefault.active;
    for(const ticket of issued){
      const snap=ticket.email_snapshot?JSON.parse(ticket.email_snapshot):null;
      if(!snap?.personal)continue;
      const recipient=ticket.email?.trim().toLowerCase()||order.email?.trim().toLowerCase()||'';
      const ready=smtp.enabled&&snap.template?.active&&Boolean(recipient);
      await conn.query('INSERT IGNORE INTO mail_outbox(order_id,event_key,recipient_key,recipient_email,recipient_name,ticket_id,template_snapshot,status,error_message) VALUES (?,?,?,?,?,?,?,?,?)',[orderId,eventKey,'ticket:'+ticket.id,recipient,ticket.attendee_name,ticket.id,JSON.stringify(snap),ready?'pending':'skipped',ready?null:!recipient?'No email address was collected for this attendee.':'Email delivery or this template was disabled at booking time.']);
    }
    for (const ticket of issued) {
      if(ticket.email_snapshot&&JSON.parse(ticket.email_snapshot).personal)continue;
      const email=ticket.email?.trim().toLowerCase()||order.email?.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      recipients.push({key:crypto.createHash('sha256').update(email).digest('hex'),email,name:ticket.attendee_name});
    }
  }
  const receiptTemplate=confirmedDefault||(templates[0]?{id:templates[0].id,config:JSON.parse(templates[0].config_json)}:null);
  const receiptSnapshot=['booking_confirmed','payment_successful'].includes(eventKey)&&receiptTemplate?JSON.stringify({template:receiptTemplate}):null;
  for (const recipient of recipients) await conn.query('INSERT IGNORE INTO mail_outbox (order_id,event_key,recipient_key,recipient_email,recipient_name,status,error_message,template_snapshot) VALUES (?,?,?,?,?,?,?,?)',
    [orderId,eventKey,recipient.key,recipient.email,recipient.name,enabled ? 'pending' : 'skipped',enabled ? null : 'Email delivery or this template was disabled at booking time.',receiptSnapshot]);
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
        const snapshot=job.template_snapshot?JSON.parse(job.template_snapshot):null;
        const [templates] = snapshot?.template?.id?await db.query("SELECT * FROM design_templates WHERE id=? AND kind='email' AND active=1",[snapshot.template.id]):await db.query('SELECT * FROM design_templates WHERE event_key=? AND active=1', [job.event_key]);
        if (!templates.length) {
          await db.query("UPDATE mail_outbox SET status='skipped',error_message='Template disabled before delivery.' WHERE id=?",[job.id]); continue;
        }
        const Order = require('../models/Order');
        const order = await Order.findById(job.order_id);
        if (['booking_confirmed','payment_successful'].includes(job.event_key) && order.status !== 'paid') {
          await db.query("UPDATE mail_outbox SET status='skipped',error_message='Booking is no longer paid.' WHERE id=?",[job.id]); continue;
        }
        const [tickets] = await db.query('SELECT t.id,t.ticket_code,t.attendee_name,t.email_snapshot,t.design_snapshot,t.status,tt.price,tt.name type_name,a.email attendee_email,a.phone attendee_phone,a.answers_json FROM tickets t JOIN ticket_types tt ON tt.id=t.ticket_type_id LEFT JOIN order_attendees a ON a.id=t.attendee_id WHERE t.order_id=? ORDER BY t.id',[order.id]);
        const recipientEmail=(job.recipient_email||order.email).trim().toLowerCase();
        const personalTickets=job.ticket_id?tickets.filter(t=>t.id===job.ticket_id):job.recipient_key==='booking'?tickets:tickets.filter(t=>(t.attendee_email?.trim().toLowerCase()||order.email?.trim().toLowerCase())===recipientEmail&&!(t.email_snapshot&&JSON.parse(t.email_snapshot).personal));
        if(job.ticket_id&&personalTickets.length!==1)throw Error('Ticket is missing for personal email.');
        const config=snapshot?.template?.config||JSON.parse(templates[0].config_json);
        const person=job.ticket_id?personalTickets[0]:null;
        const personal=person?ticketEmails.values(person,person.answers_json?JSON.parse(person.answers_json):[],snapshot):{};
        const qr=person&&/{{\s*(ticket|ticket_qr)\s*}}/.test(JSON.stringify(config))?await ticketEmails.qr(person.ticket_code):{};
        const brand = await Studio.getSetting('brand');
        const emailData={
          customer_name: job.recipient_name || order.customer_name, email: job.recipient_email || order.email, event_title: order.event_title,
          event_date: order.event_start, event_start:order.event_start,currency:order.currency, venue: order.venue, city: order.city, booking_ref: order.booking_ref,
          booking_url: brand.site_url.replace(/\/$/,'') + '/confirmation/' + order.booking_ref,
          amount: new Intl.NumberFormat('en-US',{style:'currency',currency:order.currency||'USD'}).format(order.total_amount),
          ticket_count: job.ticket_id?1:tickets.length, status: order.status,
          tickets: personalTickets,
          ...personal,...qr,
        };
        const files=await require('./emailAttachments').build(config,brand,emailData);
        emailData.attachments=[...(emailData.attachments||[]),...files];
        emailData.attachment_names=files.map(f=>f.filename);
        const rendered=renderEmail(config,brand,emailData,await Studio.pages(true),await Studio.getSetting('social_links'));
        const messageId = await send(smtp,job.recipient_email || order.email,rendered,`<ticketflow-${db.current()?.id || 'legacy'}-${job.id}@${new URL(brand.site_url).hostname}>`);
        await db.query("UPDATE mail_outbox SET status='sent',message_id=?,error_message=NULL WHERE id=?",[messageId,job.id]);
      } catch {
        // SMTP errors can contain credentials/provider internals; keep customer-facing logs safe.
        await db.query("UPDATE mail_outbox SET status='failed',error_message='Delivery failed. Verify SMTP settings and recipient, then retry.' WHERE id=?",[job.id]);
      }
    }
  } finally { working = false; }
}
function startWorker() {
  let sweeping=false;
  const timer = setInterval(async () => {
    if(sweeping) return;
    sweeping=true;
    try {
      await require('../saas/platformMail').processOutbox().catch(()=>{});
      const [organizations]=await db.platform.query("SELECT * FROM organizations WHERE status IN ('active','suspended')");
      for(const organization of organizations) await db.run(organization,async()=>{
        await processOutbox().catch(()=>{});
        if(!organization.is_legacy&&organization.status==='active')await require('./organizerMessages').processOutbox().catch(()=>{});
      });
    } catch { /* A migration may still be running. Retry on the next pass. */ }
    finally{sweeping=false;}
  },10000);
  timer.unref();
}
module.exports = { transport, send, enqueue, processOutbox, startWorker };
