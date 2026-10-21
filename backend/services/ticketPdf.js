const fs = require('node:fs/promises');
const path = require('node:path');
const defaults = require('./studioDefaults');
const { renderTicketDocument } = require('../generated/ticketDocument.cjs');
const uploads = path.resolve(__dirname, '../uploads');
let active = 0;

async function imageData(value) {
  if (!value) return '';
  if (/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value) && value.length < 7 * 1024 * 1024) return value;
  const pathname = decodeURIComponent(new URL(value, 'https://ticket.invalid').pathname);
  if (!pathname.startsWith('/uploads/')) throw new Error('Upload the ticket image to this platform before generating its PDF.');
  const filename = await fs.realpath(path.resolve(uploads, pathname.slice(9)));
  if (!filename.startsWith(uploads + path.sep)) throw new Error('Invalid ticket image.');
  const mime = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif' }[path.extname(filename).toLowerCase()];
  if (!mime || (await fs.stat(filename)).size > 5 * 1024 * 1024) throw new Error('Invalid ticket image.');
  return `data:${mime};base64,${(await fs.readFile(filename)).toString('base64')}`;
}
async function ticketPdf(data) {
  if (active >= 2) throw Object.assign(new Error('Ticket previews are busy. Please try again.'), {statusCode:503});
  active++;
  let browser;
  try {
    const design = {...(data.ticket_design || defaults.ticket)};
    design.logo = await imageData(design.logo);
    design.logos = await Promise.all((Array.isArray(design.logos) ? design.logos : []).slice(0, 6).map(imageData));
    design.banner_image = await imageData(design.banner_image);
    design.extra_elements = await Promise.all((design.extra_elements||[]).map(async item=>item.type==='image'?{...item,src:await imageData(item.src)}:item));
    const preview = String(data.ticket_code || '').includes('PREVIEW') || !data.ticket_code;
    const html = renderTicketDocument({design,
      ticket:{id:data.ticket_id,attendee_name:data.attendee_name,attendee_email:data.attendee_email,attendee_phone:data.attendee_phone,registration_answers:data.registration_answers||data.attendee_answers||[], ticket_code:data.ticket_code, type_name:data.ticket_type,price:data.ticket_price,status:data.ticket_status || 'valid'},
      order:{event_title:data.event_title,event_start:data.event_start || data.event_date,venue:data.venue,city:data.city,booking_ref:data.booking_ref,currency:data.currency || design.currency || 'INR',customer_name:data.attendee_name},
      preview});
    const {default:puppeteer} = await import('puppeteer-core');
    const {default:chromium} = await import('@sparticuz/chromium');
    const local = process.env.TICKET_PDF_CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : null);
    browser = await puppeteer.launch({executablePath:local || await chromium.executablePath(),headless:local ? true : 'shell',args:local ? [] : chromium.args,timeout:20000});
    const page = await browser.newPage();
    const pageWidth=Math.round(Math.max(240,Math.min(1600,Number(design.ticket_size?.width)||760)));
    await page.setViewport({width:Math.max(1280,pageWidth),height:1100});
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    // Print only our generated markup and embedded local assets. Never fetch URLs from a design.
    page.on('request',request => { (request.url().startsWith('data:') ? request.continue() : request.abort()).catch(()=>{}); });
    page.setDefaultTimeout(15000);
    await page.emulateMediaType('screen');
    await page.setContent(html,{waitUntil:'load',timeout:15000});
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
    const height = await page.$eval('.ticket-pdf-root',node=>Math.ceil(node.getBoundingClientRect().height));
    if (height > 8000) throw new Error('Ticket design is too tall to print.');
    return Buffer.from(await page.pdf({width:pageWidth+'px',height:height+'px',printBackground:true,margin:{top:0,bottom:0,left:0,right:0},timeout:15000}));
  } finally {
    try { await browser?.close(); } finally { active--; }
  }
}
module.exports = ticketPdf;
