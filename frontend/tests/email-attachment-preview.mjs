import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {default:Preview}=await server.ssrLoadModule('/src/admin/studio/EmailAttachmentPreview.jsx');
 const render=props=>renderToStaticMarkup(React.createElement(Preview,{files:[],onPreview(){},...props}));
 assert.match(render({ticketPdf:false}),/No PDFs attached/);
 const defaultEmpty=render({ticketPdf:false,allowTicket:false});assert.match(defaultEmpty,/Upload a file in Attachments/);assert.doesNotMatch(defaultEmpty,/ticket PDF/i);
 const both=render({ticketPdf:true,files:[{id:'a',name:'Challenge guidelines.pdf'}]});
 assert.match(both,/Attachments \(2\)/);assert.match(both,/Ticket PDF/);assert.match(both,/Challenge guidelines.pdf/);assert.match(both,/Selected pass design/);assert.doesNotMatch(both,/No PDFs attached/);
 const fileOnly=render({ticketPdf:false,files:[{id:'a',name:'Guide.pdf'}]});assert.match(fileOnly,/Attachments \(1\)/);assert.doesNotMatch(fileOnly,/Ticket PDF/);
 const busy=render({ticketPdf:true,busy:true});assert.match(busy,/disabled/);
 console.log('PASS visible attachment count, ticket + uploaded PDFs, empty state, and busy previews.');
}finally{await server.close();}
