import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({plugins:[{name:'api-stub',enforce:'pre',load(id){if(id.endsWith('/src/api/client.js'))return 'export default {};';}}],server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {CheckoutPageView}=await server.ssrLoadModule('/src/pages/Checkout.jsx');
 const {default:TaxBreakdown}=await server.ssrLoadModule('/src/components/TaxBreakdown.jsx');
 const tax={profiles:[{id:1,price_mode:'exclusive',gstin:'',legal_name:''}],components:[{name:'CGST',rate_bps:900,amount_minor:900,included:false},{name:'SGST',rate_bps:900,amount_minor:900,included:false}],taxable_minor:10000,tax_minor:1800,total_minor:11800,lines:[{ticket_type_id:1,profile_id:1,price_mode:'exclusive',total_minor:11800,tax_minor:1800}]};
 const props={data:{event:{title:'Event',start_datetime:'2035-01-01 12:00:00',venue:'Hall',city:'City'},payment:{configured:true,has_webhook_secret:true,mode:'live'}},items:[{id:1,qty:1,type:{name:'General',price:100}}],count:1,total:118,editLink:'/events/event',baseQuote:{tax}};
 const render=p=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(CheckoutPageView,{...props,...p})));
 const html=render({});for(const text of ['Amount excluding tax','CGST (9%)','SGST (9%)','Amount including tax','100.00','118.00','With tax:','Tax is added to these ticket prices.'])assert.ok(html.includes(text),text);
 const included={...tax,profiles:[{price_mode:'inclusive'}],components:tax.components.map(c=>({...c,included:true}))};
 const inc=renderToStaticMarkup(React.createElement(TaxBreakdown,{value:included}));assert.match(inc,/Tax is included in these ticket prices/);assert.doesNotMatch(inc,/Added to price/);
 const pending={order:{booking_ref:'FIXTURE',total_amount:118,tax_snapshot:JSON.stringify(tax)},payment:{status:'created',can_pay:true},attendees:[]};assert.match(render({pending,baseQuote:null}),/CGST \(9%\)/);
 assert.doesNotMatch(render({baseQuote:null}),/Tax breakdown/);
 const waiting=render({pricingBusy:true,quoteError:'Unable to calculate total'});assert.match(waiting,/<button[^>]*disabled=""[^>]*>Pay securely/);assert.match(waiting,/Retry total/);
 console.log('PASS tax-inclusive/exclusive labels, components, pre-tax/post-tax amounts, saved booking taxes and blocked payment until quote loads');
}finally{await server.close();}
