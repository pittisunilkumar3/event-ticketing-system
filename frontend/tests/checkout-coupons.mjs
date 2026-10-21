import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({plugins:[{name:'api-stub',enforce:'pre',load(id){if(id.endsWith('/src/api/client.js'))return 'export default {};';}}],server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {CheckoutPageView}=await server.ssrLoadModule('/src/pages/Checkout.jsx');
 const props={data:{event:{title:'Event',start_datetime:'2035-01-01 12:00:00',venue:'Hall',city:'City'},payment:{configured:true,has_webhook_secret:true}},items:[{id:1,qty:1,type:{name:'General',price:100}},{id:2,qty:1,type:{name:'VIP',price:200}}],count:2,total:260,editLink:'/events/event'};
 const breakdown={scope:'selected',eligible_subtotal_minor:20000,lines:[{ticket_type_id:1,eligible:false,subtotal_minor:10000,discount_minor:0,total_minor:10000},{ticket_type_id:2,eligible:true,subtotal_minor:20000,discount_minor:4000,total_minor:16000}]};
 const quote={coupon:{code:'VIP20'},subtotal_minor:30000,discount_minor:4000,total_minor:26000,breakdown};
 const render=p=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(CheckoutPageView,{...props,...p})));
 const html=render({couponQuote:quote});
 for(const text of ['Coupon does not apply','Coupon savings:','40.00','160.00','260.00','Discount applies only to eligible ticket types.','Eligible ticket subtotal:','200.00'])assert.ok(html.includes(text),text);
 assert.match(html,/<s>₹200.00<\/s>/);assert.doesNotMatch(html,/<s>₹100.00/);
 const all=render({couponQuote:{...quote,breakdown:{...breakdown,scope:'all'}}});assert.match(all,/Discount applies to all tickets in this booking/);
 const pending={order:{booking_ref:'FIXTURE',total_amount:260,subtotal_amount:300,discount_amount:40,coupon_code:'VIP20',coupon_breakdown:JSON.stringify(breakdown)},payment:{status:'created',can_pay:true},attendees:[]};
 const resumed=render({pending});assert.match(resumed,/Coupon savings:/);assert.match(resumed,/160.00/);assert.doesNotMatch(resumed,/Have a coupon code/);
 const old=render({pending:{...pending,order:{...pending.order,coupon_breakdown:null}}});assert.match(old,/260.00/);assert.doesNotMatch(old,/Coupon savings:/);
 console.log('PASS selected/all coupon display, per-ticket savings, excluded tickets, resumed snapshots and legacy reservations');
}finally{await server.close();}
