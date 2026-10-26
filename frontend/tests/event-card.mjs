import assert from 'node:assert/strict';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
 const {default:EventCard}=await server.ssrLoadModule('/src/components/EventCard.jsx');
 const event={id:1,slug:'expo',title:'Expo',start_datetime:'2026-12-12 09:00:00',end_datetime:'2026-12-13 18:00:00',schedule_text:'Saturday timings: 9AM–6PM\nSunday timings: 10AM–6PM'};
 const render=e=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(EventCard,{event:e})));
 const html=render(event);
 assert.ok(html.includes(event.schedule_text));
 assert.match(html,/white-space:pre-line/);
 assert.doesNotMatch(html,/&lt;span|event\.schedule_text|formatTime\(|\$<span/);
 assert.match(render({...event,schedule_text:''}),/9:00 AM/);
 assert.match(render({...event,start_datetime:null}),/Date to be announced/);
 console.log('PASS event card: daily hours, fallback time, missing date, no leaked source');
} finally {await server.close();}
