import assert from "node:assert/strict";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
const require = createRequire(import.meta.url);
const catalog = require("../../backend/services/ticketLayouts");
const layouts = [
  ...catalog,
  ...require("../../backend/services/legacyTicketLayouts"),
];
const recipes = require("../../shared/ticketCompositions.json");
const defaults = require("../../backend/services/studioDefaults").ticket;
const server = await createServer({
  root: fileURLToPath(new URL("..",import.meta.url)),
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
try {
  const {resizeTicketAxis,scaleTicket}=await server.ssrLoadModule('/src/components/ticketSize.js');
  const original={width:760,height:600};
  const wider=resizeTicketAxis(original,1000,'width');
  assert.equal(wider.width,1000);assert.equal(wider.height,600);
  assert.equal(wider.width/wider.contentWidth,1);assert.equal(wider.referenceWidth,760);
  const taller=resizeTicketAxis(wider,850,'height');
  assert.equal(taller.width,1000);assert.equal(taller.height,850);
  const reduced=scaleTicket(taller,500,425);
  assert.equal(reduced.width,500);assert.equal(reduced.height,425);
  const resized=resizeTicketAxis(reduced,700,'width');
  assert.equal(resized.width,700);assert.equal(resized.height,425);
  assert.equal(resized.width/resized.contentWidth,.5);assert.equal(resized.height/resized.contentHeight,.5);
  const savedSize=require('../../backend/services/studioValidation').template('ticket',{...defaults,ticket_size:resized}).ticket_size;
  assert.deepEqual(savedSize,resized);
  for(const axis of ['width','height'])for(const value of [-100,100000]){
    const bounded=resizeTicketAxis(original,value,axis);
    assert.equal(bounded[axis==='width'?'height':'width'],original[axis==='width'?'height':'width']);
    assert.ok(bounded.width>=240&&bounded.width<=1600&&bounded.height>=240&&bounded.height<=4000);
  }
  console.log('PASS: independent card width/height, proportional corners, saved scale and size bounds.');
  const { default: DesignedTicket } = await server.ssrLoadModule(
    "/src/components/DesignedTicket.jsx",
  );
  const ticket = {
    id: 42,
    ticket_code: "TKT-FORMAT-VERIFICATION-42",
    attendee_name: "Alex Morgan",
    status: "valid",
  };
  const order = {
    event_title: "Cinematica · An evening of possibilities",
    event_start: "2026-12-12 18:00:00",
    venue: "Main Exhibition Hall",
    city: "Hyderabad",
    booking_ref: "TKT-TEST-42",
  };
  const css =
    (await readFile(new URL("../src/components/ticketLayouts.css",import.meta.url), "utf8")) +
    (await readFile(new URL("../src/admin/studio/studio.css",import.meta.url), "utf8"));
  assert.equal(catalog.length, 100);
  assert.equal(layouts.length, 180);
  const cards = [];
  const uniqueDesigns = new Set();
  for (const layout of layouts) {
    const design = {
      ...defaults,
      ...layout.config,
      type_name: "VIP Experience",
      price: 75,
    };
    const rendered = renderToStaticMarkup(
      React.createElement(DesignedTicket, { design, ticket, order }),
    );
    const [base, edition] = layout.id.split("--");
    const recipe = recipes.find((r) => r.id === base);
    if (recipe) {
      assert.ok(rendered.includes("ticket-composed"));
      assert.ok(rendered.includes("--ct-areas:"));
      for (const region of [
        "ct-brand",
        "ct-title",
        "ct-details",
        "ct-scan",
        "ct-date",
        "ct-type",
        "ct-note",
      ])
        assert.ok(rendered.includes(region));
    } else {
      assert.ok(
        css.includes(".ticket-layout-" + base),
        base + " has structural styling",
      );
    }
    assert.ok(rendered.includes("ticket-layout-" + base));
    if (edition) {
      assert.ok(
        css.includes(".ticket-edition-" + edition),
        edition + " has edition styling",
      );
      assert.ok(rendered.includes("ticket-edition-" + edition));
    }
    for (const value of [
      "Alex Morgan",
      "TKT-TEST-42",
      "TKT-FORMAT-VERIFICATION-42",
      "Main Exhibition Hall",
      "$75.00",
      "<svg",
    ])
      assert.ok(rendered.includes(value), layout.id + " preserves " + value);
    uniqueDesigns.add(rendered);
    const fullName = 'Alexandra Maria Catherine Elizabeth Victoria Charlotte Montgomery-Wellington de la Cruz';
    const longNameTicket = renderToStaticMarkup(
      React.createElement(DesignedTicket, {design, ticket: {...ticket, attendee_name: fullName}, order}),
    );
    assert.ok(longNameTicket.includes(fullName), layout.id + ' preserves the full attendee name');
    assert.ok(longNameTicket.includes('ticket-attendee'), layout.id + ' gives the name a dedicated row');
    const privateVersion = renderToStaticMarkup(
      React.createElement(DesignedTicket, {
        design: { ...design, show_attendee: false, show_price: false },
        ticket: { ...ticket, status: "cancelled" },
        order,
      }),
    );
    assert.ok(!privateVersion.includes("Alex Morgan"));
    assert.ok(!privateVersion.includes("$75.00"));
    assert.ok(privateVersion.includes("VOID"));
    const preview = renderToStaticMarkup(
      React.createElement(DesignedTicket, { design, preview: true }),
    );
    assert.ok(preview.includes("PREVIEW ONLY"));
    assert.ok(!preview.includes(ticket.ticket_code));
    assert.ok(preview.includes("Dec 12, 2026"));
    assert.ok(preview.includes("6:00 PM"));
    if (catalog.some((c) => c.id === layout.id))
      cards.push(
        `<section id="${layout.id}"><h2>${layout.name}</h2><p>${layout.category} · ${layout.description}</p>${rendered}</section>`,
      );
  }
  assert.equal(uniqueDesigns.size, 180);
  if (process.env.TICKET_PREVIEW_PATH) {
    const assets = await readdir(new URL("../dist/assets",import.meta.url));
    const styles = (
      await Promise.all(
        assets
          .filter((f) => f.endsWith(".css"))
          .map((f) => readFile(new URL("../dist/assets/" + f,import.meta.url), "utf8")),
      )
    ).join("\n");
    await writeFile(
      process.env.TICKET_PREVIEW_PATH,
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Current and legacy ticket templates</title><style>${styles}\nbody{margin:0;background:#eae6de;color:#282923;font-family:Arial,sans-serif}.catalog{max-width:1440px;margin:auto;padding:32px}.catalog>h1{font-size:38px;margin:0 0 12px}.catalog>p{margin-bottom:28px}.examples{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:36px;align-items:start}.examples>section{min-width:0;scroll-margin-top:20px}.examples>section>h2{font-size:18px;margin-bottom:5px}.examples>section>p{font-size:12px;margin-bottom:15px;color:#70675b}@media(max-width:800px){.catalog{padding:20px}.examples{grid-template-columns:1fr}}</style></head><body><main class="catalog"><h1>Current and legacy ticket layouts.</h1><p>TicketFlow · Ticket design collection</p><div class="examples">${cards.join("")}</div></main></body></html>`,
    );
  }
  console.log(
    "PASS: 100 current and 80 legacy ticket templates render issued data, real QR codes, hidden attendee/price settings, preview labels and cancelled state.",
  );
} finally {
  await server.close();
}
