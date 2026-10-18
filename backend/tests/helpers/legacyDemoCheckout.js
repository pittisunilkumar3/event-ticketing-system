// Test-only fixture for historical demo orders. Never loaded by the application.
if(!/^(ticketflow_test_|tf_wallet_test_|tf_saas_test_)\d+_\d+$/.test(process.env.DB_NAME||''))throw new Error('Legacy demo fixtures require a disposable test database.');
require('../../services/bookingPayments').create=async payload=>({paid:true,...await require('../../models/Order').createWithTickets(payload)});
const tenancy=require('../../saas/tenancy'),limit=tenancy.rateLimit;
// The design suite intentionally books all 100 templates in under a minute.
tenancy.rateLimit=(n,ms)=>n===20?(_req,_res,next)=>next():limit(n,ms);
