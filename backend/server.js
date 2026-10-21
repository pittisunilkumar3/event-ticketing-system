const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'loopback') app.set('trust proxy', 'loopback');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const {resolveTenant,rateLimit}=require('./saas/tenancy');
const saas=require('./saas/routes');
// Razorpay signatures cover the original bytes; register before JSON parsing.
app.post('/api/saas/razorpay/webhook',express.raw({type:'application/json',limit:'1mb'}),require('./saas/payments').webhook);
app.post('/api/saas/razorpayx/webhook',express.raw({type:'application/json',limit:'1mb'}),require('./services/bankPayouts').webhook);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'),{dotfiles:'deny'}));
app.get('/', (req, res) => res.json({success:true,message:'TicketFlow API',version:'2.0.0'}));
app.use('/api/saas',saas.publicRouter);
app.use('/api/platform',saas.platform);
const tenant=express.Router();
tenant.use(resolveTenant);
tenant.use(require('./services/eventUpdates').afterMutation);
tenant.get('/organization',(req,res)=>res.json({success:true,data:{name:req.organization.name,slug:req.organization.slug,status:req.organization.status,is_legacy:Boolean(req.organization.is_legacy),site_url:req.siteUrl}}));
tenant.use('/auth',rateLimit(60,15*60000),require('./routes/authRoutes'));
tenant.use('/admin/saas',saas.organizer);
tenant.use('/admin/dashboard', require('./routes/dashboardRoutes'));
tenant.use('/admin/registration-forms', require('./routes/registrationFormRoutes'));
tenant.use('/admin/events', require('./routes/eventRoutes'));
tenant.use('/admin/ticket-types', require('./routes/ticketTypeRoutes'));
tenant.use('/admin/wallet', require('./routes/walletRoutes'));
tenant.use('/admin/coupons', require('./routes/couponRoutes'));
tenant.use('/admin/taxes', require('./routes/taxRoutes'));
tenant.use('/admin/orders', require('./routes/orderRoutes'));
tenant.use('/admin/tickets', require('./routes/ticketRoutes'));
tenant.use('/admin/studio', require('./routes/studioRoutes'));
tenant.use('/admin/messages', require('./routes/organizerMessageRoutes'));
tenant.use('/admin/email-templates', require('./routes/emailTemplateRoutes'));
tenant.use(require('./routes/publicRoutes'));
// Pass an explicit, validated organization slug into the shared router.
app.use('/api/o/:organizationSlug',(req,res,next)=>{req.organizationSlug=req.params.organizationSlug;next();},tenant);
app.use('/api',tenant);

app.use(notFound);
app.use(errorHandler);
const PORT=process.env.PORT || 5001;
if (require.main === module) {
  require('./services/mailer').startWorker();
  require('./services/bookingPayments').startWorker();
  require('./services/bankPayouts').startWorker();
  app.listen(PORT,process.env.HOST || '127.0.0.1',()=>console.log(`TicketFlow API running on port ${PORT}`));
}
module.exports=app;
