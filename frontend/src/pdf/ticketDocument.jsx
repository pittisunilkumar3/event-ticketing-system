import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DesignedTicket from '../components/DesignedTicket';
import studioCss from '../admin/studio/studio.css?raw';
import layoutCss from '../components/ticketLayouts.css?raw';
import compositionCss from '../components/composedTicket.css?raw';

// The email PDF uses the same React component and CSS as issued tickets.
export function renderTicketDocument({ design, ticket, order, preview = false, fontCss = '' }) {
  const markup = renderToStaticMarkup(<main className="ticket-pdf-root">
    <DesignedTicket design={design} ticket={ticket} order={order} preview={preview}/>
    {preview && <p className="pdf-preview-note">PREVIEW ONLY — not valid for entry</p>}
  </main>);
  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '*,*::before,*::after{box-sizing:border-box}*{margin:0;padding:0}html{line-height:1.5;font-family:Inter,Arial,sans-serif;--font-display:"Plus Jakarta Sans",Arial,sans-serif}img,svg{display:block}img{max-width:100%;height:auto}h1,h2,h3,strong{font-weight:700}' +
    fontCss + studioCss + compositionCss + layoutCss +
    'html,body{background:#fff;color:#111;width:816px;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.ticket-pdf-root{width:760px;margin:28px}.designed-ticket{box-shadow:none}.pdf-preview-note{text-align:center;font:12px Arial,sans-serif;margin:16px 0 0;color:#475467}' +
    '</style></head><body>' + markup + '</body></html>';
}
