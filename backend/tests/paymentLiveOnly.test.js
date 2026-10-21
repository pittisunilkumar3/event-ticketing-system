const {test}=require('node:test'),assert=require('node:assert/strict');
const settings=require('../saas/paymentSettings'),payments=require('../saas/payments');
require('node:test').after(()=>require('../config/db').end());
test('production live-only policy blocks test settings and provider orders, while preserving historical operations',async()=>{
 const previous=process.env.RAZORPAY_LIVE_ONLY,originalFetch=global.fetch;
 const testConfig={key_id:'rzp_test_fixture',key_secret:'fixture',webhook_secret:'fixture'},liveConfig={...testConfig,key_id:'rzp_live_fixture'};
 try{
  process.env.RAZORPAY_LIVE_ONLY='true';
  assert.equal(settings.safe(testConfig).configured,false);assert.equal(settings.safe(liveConfig).configured,true);assert.equal(settings.safe(liveConfig).live_only,true);
  assert.throws(()=>settings.assertLiveCheckout(testConfig),/live payments only/);settings.assertLiveCheckout(liveConfig);
  await assert.rejects(()=>settings.save({mode:'test',key_id:testConfig.key_id}),/locked to live/);
  let requests=0;global.fetch=async()=>{requests++;return {ok:true,json:async()=>({id:'fixture'})};};
  await assert.rejects(()=>payments.razorpay('orders',{amount:100},testConfig),/live payments only/);assert.equal(requests,0);
  await payments.razorpay('orders',{amount:100},liveConfig);assert.equal(requests,1);
  await payments.razorpay('payments/previous',null,testConfig);assert.equal(requests,2);
  await payments.razorpay('payments/previous/refund',{amount:100},testConfig);assert.equal(requests,3);
  process.env.RAZORPAY_LIVE_ONLY='false';assert.equal(settings.safe(testConfig).configured,true);settings.assertLiveCheckout(testConfig);
 }finally{global.fetch=originalFetch;if(previous===undefined)delete process.env.RAZORPAY_LIVE_ONLY;else process.env.RAZORPAY_LIVE_ONLY=previous;}
});
