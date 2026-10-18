import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {default:EventCard}=await server.ssrLoadModule('/src/components/EventCard.jsx');
 const event={id:1,title:'Published Expo',slug:'expo',start_datetime:'2035-12-12 09:00:00',min_price:999,public_path:'/o/alpha/events/expo'};
 const render=e=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(EventCard,{event:e})));
 assert.match(render(event),/href="\/o\/alpha\/events\/expo"/);assert.match(render(event),/₹999/);
 assert.match(render({...event,public_path:undefined}),/href="\/events\/expo"/);
 console.log('PASS platform cards link to organizer event paths; tenant cards retain their local routes and prices.');
}finally{await server.close();}
