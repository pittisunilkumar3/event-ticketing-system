import {ticketSize} from '../components/ticketSize';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DesignedTicket from '../components/DesignedTicket';
import studioCss from '../admin/studio/studio.css?raw';
import layoutCss from '../components/ticketLayouts.css?raw';
import compositionCss from '../components/composedTicket.css?raw';
import presentationCss from '../components/ticketPresentation.css?raw';
import canvasCss from '../components/ticketCanvas.css?raw';

import publicFontCss from '../assets/fonts/fonts.css?raw';
const fontFiles=import.meta.glob('../assets/fonts/*.woff2',{eager:true,query:'?inline',import:'default'});
const embeddedFontCss=publicFontCss.replace(/url\(\.\/([^)]*)\)/g,(_,name)=>`url(${fontFiles['../assets/fonts/'+name]})`);

// The email PDF uses the same React component and CSS as issued tickets.
export function renderTicketDocument({ design, ticket, order, preview = false, fontCss = embeddedFontCss }) {
  const width=ticketSize(design?.ticket_size)?.width||760;
  const markup = renderToStaticMarkup(<main className="ticket-pdf-root">
    <DesignedTicket design={design} ticket={ticket} order={order} preview={preview}/>
  </main>);
  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '*,*::before,*::after{box-sizing:border-box}*{margin:0;padding:0}html{line-height:1.5;font-family:Inter,Arial,sans-serif;--font-display:"Plus Jakarta Sans",Arial,sans-serif}img,svg{display:block}img{max-width:100%;height:auto}h1,h2,h3,strong{font-weight:700}' +
    fontCss + studioCss + compositionCss + layoutCss + canvasCss + presentationCss +
    `html,body{background:#fff;color:#111;width:${width}px;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.ticket-pdf-root{width:${width}px;margin:0}.designed-ticket{box-shadow:none}.pdf-preview-note{text-align:center;font:12px Arial,sans-serif;margin:16px 0 0;color:#475467}` +
    '</style></head><body>' + markup + '</body></html>';
}
