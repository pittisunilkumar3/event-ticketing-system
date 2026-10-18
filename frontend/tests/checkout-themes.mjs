import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
import {readFileSync} from 'node:fs';
import themes from '../../shared/eventThemes.json' with {type:'json'};
const server=await createServer({plugins:[{name:'checkout-api-stub',enforce:'pre',load(id){if(id.endsWith('/src/api/client.js'))return 'export default {};';}}],server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
 const {CheckoutPageView}=await server.ssrLoadModule('/src/pages/Checkout.jsx');
 const {eventThemeId,refreshCheckoutTheme}=await server.ssrLoadModule('/src/pages/eventTheme.js');
 const config={enabled:true,attendee_mode:'fields',title:'Pass registration',fields:[{id:'f_name',type:'name',label:'Full name',required:true,width:12},{id:'f_city',type:'text',label:'City',required:false,width:12}]};
 const items=[{id:1,qty:1,type:{name:'Explorer pass',price:999,registrationForm:{config}}}];
 const data={event:{title:'Saved event',start_datetime:'2030-12-12 09:00:00',venue:'Actual venue',city:'Actual city',banner_image:'/uploads/banner.png'},payment:{configured:true,has_webhook_secret:true,mode:'live'}};
 const props={data,items,people:{'1_0':{answers:{f_name:'Entered attendee',f_city:'Hyderabad'}}},editLink:'/events/saved-event?tickets=1%3A1',total:999,count:1};
 const render=p=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(CheckoutPageView,p)));
 const tokens=readFileSync('src/pages/eventThemeTokens.css','utf8');
 for(const theme of themes){
  const html=render({...props,data:{...data,event:{...data.event,page_theme:theme.id}}});
  assert.ok(html.includes(`checkout-page event-theme-${theme.id}`));
  for(const value of ['Entered attendee','Hyderabad','Explorer pass','Saved event','999.00','Pay securely','Review &amp; confirm','Back to ticket selection'])assert.ok(html.includes(value),theme.id+': '+value);
  assert.ok(html.match(/<input[^>]+name="person_1_0_answer_f_name"[^>]*>/)[0].includes('required=""'));
  if(theme.id!=='classic')assert.ok(tokens.includes('.event-theme-'+theme.id+' {'));
 }
 assert.equal(eventThemeId('invalid'),'classic');assert.equal(eventThemeId(null),'classic');
 const latest={...data,payment:{...data.payment,has_webhook_secret:false},event:{...data.event,page_theme:'pulse',title:'Changed title'},registrationForm:{revision:8}};
 const refreshed=refreshCheckoutTheme(data,latest);
 assert.equal(refreshed.event.page_theme,'pulse');assert.equal(refreshed.event.title,'Saved event');assert.equal(refreshed.payment,latest.payment);assert.equal(refreshed.registrationForm,undefined);
 const unavailable=render({...props,data:refreshed});
 assert.match(unavailable,/Online payments are not available yet/);
 assert.match(unavailable,/<button[^>]*disabled=""[^>]*>Pay securely/);
 const enabled=refreshCheckoutTheme(refreshed,data);
 const available=render({...props,data:enabled});
 assert.doesNotMatch(available,/Online payments are not available yet/);
 assert.doesNotMatch(available,/<button[^>]*disabled=""[^>]*>Pay securely/);
 assert.match(available,/Entered attendee/);
 assert.equal(refreshCheckoutTheme(null,latest),latest);
 const pending={order:{booking_ref:'TEST-ONLY',customer_name:'Saved attendee',email:'attendee@example.test',total_amount:999,currency:'INR'},payment:{status:'expired',can_pay:false},attendees:[{id:1,name:'Saved attendee',type_name:'Explorer pass',position:0,answers:[]}]};
 const reserved=render({...props,pending,data:{...data,event:{...data.event,page_theme:'cinema'}}});
 assert.match(reserved,/Saved attendee/);assert.match(reserved,/Check payment/);assert.match(reserved,/Start a new booking/);assert.doesNotMatch(reserved,/<input/);
 console.log('PASS all 15 checkout themes, payment availability refresh in both directions, preserved form data, real totals, required inputs and pending-payment actions.');
} finally {await server.close();}
