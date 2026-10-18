import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
// These are presentation tests; API calls and browser-only tenant setup are excluded.
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [{ name: 'customer-render-api-stub', enforce: 'pre', load(id) { if (id.endsWith('/src/api/client.js')) return 'export default {};'; } }],
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
});
const render = element => renderToStaticMarkup(React.createElement(MemoryRouter, null, element));
try {
  const { BookingReceipt } = await server.ssrLoadModule('/src/pages/Confirmation.jsx');
  const { PublishedEventList } = await server.ssrLoadModule('/src/pages/Home.jsx');
  const { PackageDetails } = await server.ssrLoadModule('/src/saas/PackageDetails.jsx');
  const { default:PackageOptions } = await server.ssrLoadModule('/src/saas/PackageOptions.jsx');
  const optionsData={organization:{event_balance:3,status:'active'},subscription:{latest_purchase:null},payments_ready:true,packages:[{id:1,name:'Saved Starter',event_count:3,price_paise:100000}]};
  const optionsHtml=(data=optionsData,owner=true)=>render(React.createElement(PackageOptions,{data,owner,busy:null,onBuy:()=>{}}));
  assert.match(optionsHtml(),/Saved Starter/);assert.match(optionsHtml(),/₹1,000\.00/);assert.match(optionsHtml(),/6 events remaining/);assert.match(optionsHtml(),/Buy Saved Starter/);
  assert.match(optionsHtml({...optionsData,subscription:{latest_purchase:{id:'paid-purchase'}}}),/Add 3 events/);
  assert.match(optionsHtml({...optionsData,payments_ready:false}),/disabled=""[^>]*>Payments unavailable/);
  assert.match(optionsHtml(optionsData,false),/Owner purchase only/);
  assert.match(optionsHtml({...optionsData,packages:[]}),/No event packages are available yet/);
  const packageData={organization:{name:'Saved organizer',status:'active'},subscription:{purchased_events:0,used_events:0,adjusted_events:3,remaining_events:3,latest_purchase:null,can_publish:true}};
  const packageHtml=data=>render(React.createElement(PackageDetails,{data,compact:true}));
  assert.match(packageHtml(packageData),/No package purchased/);
  assert.match(packageHtml(packageData),/added by the superadmin/);
  assert.match(packageHtml(packageData),/href="\/admin\/event-packages"/);
  assert.doesNotMatch(packageHtml(packageData),/Latest purchase/);
  const purchasedData={...packageData,subscription:{...packageData.subscription,purchased_events:10,remaining_events:0,used_events:13,can_publish:false,latest_purchase:{package_name:'Saved package',event_count:10,amount_paise:125000,currency:'INR',paid_at:'2026-10-14T09:00:00Z'}}};
  assert.match(packageHtml(purchasedData),/Saved package/);
  assert.match(packageHtml(purchasedData),/No credits remaining/);
  assert.match(packageHtml(purchasedData),/1,250\.00/);
  assert.doesNotMatch(packageHtml(purchasedData),/No package purchased|Ready to publish/);
  const feed=events=>render(React.createElement(PublishedEventList,{events,loading:false,error:''}));
  assert.match(feed([]),/No events published yet/);
  assert.doesNotMatch(feed([]),/1,248|986|842|Design Futures|Sample data/);
  const persisted={id:7,slug:'saved-event',title:'Database event title',start_datetime:'2030-11-01 10:00:00',venue:'Saved venue',city:'Saved city'};
  assert.match(feed([persisted]),/Database event title/);assert.match(feed([persisted]),/href="\/events\/saved-event"/);
  assert.doesNotMatch(feed([persisted]),/No events published yet/);
  assert.match(render(React.createElement(PublishedEventList,{events:[],error:'Database unavailable',loading:false})),/Database unavailable/);
  const homeSource=await readFile(new URL('../src/pages/Home.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(homeSource,/previewViews|Design Futures|320 \/ 400|Sample data|1,248/);

  const { PolicyDocument } = await server.ssrLoadModule('/src/pages/PolicyPage.jsx');
  const { default: NotFound } = await server.ssrLoadModule('/src/pages/NotFound.jsx');
  const { default: MyBookings } = await server.ssrLoadModule('/src/pages/MyBookings.jsx');
  const { default: Navbar } = await server.ssrLoadModule('/src/components/Navbar.jsx');
  const { default: Footer } = await server.ssrLoadModule('/src/components/Footer.jsx');
  const order = { booking_ref: 'TKT-TEST-ONLY', event_title: 'Example event', event_start: '2026-11-23 09:00:00', venue: 'Example venue', city: 'Example city', total_amount: '49.99' };
  const ticket = { id: 1, ticket_code: 'QA-ONLY-NOT-FOR-ENTRY', status: 'valid', ticket_type_name: 'General admission', design: { layout: 'minimal' } };
  const receipt = (status, fresh = false, tickets = [ticket]) => render(React.createElement(BookingReceipt, { booking: { order: { ...order, status }, tickets }, justBooked: fresh }));
  assert.match(receipt('paid', true), /Your next experience is booked/);
  assert.match(receipt('paid'), /Your booking, all in one place/);
  assert.doesNotMatch(receipt('paid'), /Your next experience is booked/);
  for (const status of ['cancelled', 'refunded']) {
    const html = receipt(status, true);
    assert.match(html, new RegExp(`This booking was ${status}`));
    assert.match(html, /no longer valid for entry/);
    assert.match(html, /ticket-void/);
    assert.doesNotMatch(html, /Your next experience is booked|YOU’RE ON THE LIST/);
  }
  const pending = receipt('pending', true, []);
  assert.match(pending, /Your booking is pending/);
  assert.match(pending, /No tickets have been issued/);
  assert.doesNotMatch(pending, /Print \/ Save PDF|Your next experience is booked/);
  assert.match(receipt('unknown', true), /Unconfirmed/);
  assert.doesNotMatch(receipt('unknown', true), /Your next experience is booked/);
  const policy = render(React.createElement(PolicyDocument, { page: { title: 'Privacy policy', updated_at: '2026-10-13 12:00:00', body: '<h2>Your information</h2><p>Example policy.</p><ul><li>Example item</li></ul><table><tbody><tr><td>Example cell</td></tr></tbody></table>' } }));
  assert.match(policy, /Your information/);
  assert.match(policy, /October 13, 2026/);
  assert.match(policy, /<table>/);
  if (process.argv.includes('--preview')) {
    const html = body => `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Customer page layout check — sample data</title>${['index.css','admin/studio/studio.css','components/ticketLayouts.css','components/composedTicket.css','pages/landing.css','pages/customer.css'].map(file => `<link rel="stylesheet" href="/src/${file}">`).join('')}</head><body>${body}</body></html>`;
    const lookup = renderToStaticMarkup(React.createElement(MemoryRouter, {initialEntries:['/my-bookings']}, React.createElement(React.Fragment, null, React.createElement(Navbar), React.createElement(MyBookings), React.createElement(Footer))));
    for (const [name, body] of [['receipt', receipt('paid', true)], ['cancelled', receipt('cancelled', true)], ['policy', policy], ['lookup', lookup]]) {
      await writeFile(new URL(`../public/__customer-qa-${name}.html`, import.meta.url), html(body));
    }
  }
  const missingDate = render(React.createElement(PolicyDocument, { page: { title: 'Terms', body: '<p>Example</p>' } }));
  assert.doesNotMatch(missingDate, /Last updated|Invalid Date/);
  assert.match(render(React.createElement(NotFound)), /href="\/events"/);
  for (const file of ['MyBookings.jsx', 'Confirmation.jsx', 'PolicyPage.jsx', 'NotFound.jsx']) {
    const source = await readFile(new URL(`../src/pages/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /GlowOrbs|from-indigo-500|to-fuchsia-500|Booking Confirmed!/);
  }
  console.log('Customer pages: booking statuses, voided tickets, empty bookings, policy content, recovery links, and legacy-style checks passed.');
} finally { await server.close(); }
