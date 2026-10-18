import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
 const {default:Description,descriptionSections}=await server.ssrLoadModule('/src/pages/EventDescription.jsx');
 const saved='Event overview\r\n\r\n1. EXPLORER PASS - ₹999\r\nAccess Includes:\r\n• Expo entry\r\n• Networking\r\nNot Included:\r\n• Workshops\r\nFood: Available for purchase.\r\n2. VIP PASS – ₹9,999\r\n• VIP access\r\nVIP DINNER – 12th DECEMBER 2026\r\n• Speakers\r\nSeparate QR access.';
 assert.equal(descriptionSections(saved).passes.length,2);
 const html=renderToStaticMarkup(React.createElement(Description,{description:saved}));
 for(const text of ['Expo entry','Networking','Workshops','Food: Available for purchase.','₹999','₹9,999','VIP access','Speakers','Separate QR access.'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/<article/g)||[]).length,2);
 assert.match(html,/<ul>/);assert.match(html,/<aside/);assert.match(html,/Not Included/);
 const plain=renderToStaticMarkup(React.createElement(Description,{description:'A different organizer\n<script>alert(1)</script>\n2. Meet the speakers'}));
 assert.doesNotMatch(plain,/<script|<article/);assert.match(plain,/&lt;script&gt;/);assert.match(plain,/2. Meet the speakers/);
 console.log('PASS: saved pass sections, benefits, exclusions, dinner highlight, ordinary text and safe escaping.');
}finally{await server.close();}
