const {test,after}=require('node:test'),assert=require('node:assert/strict');
const taxes=require('../services/taxes');after(()=>require('../config/db').end());
const profile=mode=>({id:1,revision:1,name:'GST',price_mode:mode,ticket_type_ids:[],components:[{kind:'CGST',name:'CGST',rate_bps:900},{kind:'SGST',name:'SGST',rate_bps:900}],legal_name:'',gstin:''});
const item=price=>[{ticketType:{id:1,price},qty:1}];
test('inclusive and exclusive amounts, integer rounding and tax component reconciliation',()=>{
 const exclusive=taxes.compute([profile('exclusive')],item(100),{});assert.equal(exclusive.taxable_minor,10000);assert.equal(exclusive.tax_minor,1800);assert.equal(exclusive.total_minor,11800);
 const inclusive=taxes.compute([profile('inclusive')],item(118),{});assert.equal(inclusive.taxable_minor,10000);assert.equal(inclusive.tax_minor,1800);assert.equal(inclusive.total_minor,11800);
 for(let cents=1;cents<1000;cents++)for(const mode of ['inclusive','exclusive']){const r=taxes.compute([profile(mode)],item((cents/100).toFixed(2)),{});assert.equal(r.taxable_minor+r.tax_minor,r.total_minor);assert.equal(r.components.reduce((sum,c)=>sum+c.amount_minor,0),r.tax_minor);assert.ok(r.taxable_minor>=0);if(mode==='inclusive')assert.equal(r.total_minor,cents);}
});
test('unmatched profiles do not apply, full coupon removes tax and invalid scope is rejected',()=>{
 const unmatched={...profile('exclusive'),ticket_type_ids:[2]};assert.equal(taxes.compute([unmatched],item(100),{}).tax_minor,0);
 const free=taxes.compute([profile('inclusive')],item(118),{breakdown:{lines:[{ticket_type_id:1,discount_minor:11800}]}});assert.equal(free.total_minor,0);assert.equal(free.tax_minor,0);
 assert.throws(()=>taxes.fields({name:'Invalid',event_id:1,price_mode:'exclusive',enabled:false,ticket_type_ids:[],ticket_scope:'invalid'}),/Choose all tickets/);
 assert.throws(()=>taxes.compute([profile('exclusive'),profile('inclusive')],item(100),{}),/overlap/);
});
