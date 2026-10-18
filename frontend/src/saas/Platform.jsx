import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {useLocation,useNavigate} from 'react-router-dom';
import OrganizerManage from './OrganizerManage';
import Icon from '../components/Icon';
import './saas.css';
import PlatformSettings from './PlatformSettings';
import PaymentSettings from './PaymentSettings';
import PlatformWithdrawals from './PlatformWithdrawals';
import BookingPayments from './BookingPayments';
import PlatformLayout from './PlatformLayout';
import PlatformLogin from './PlatformLogin';
import {Overview,Organizers,Packages,Payments,Activity,PackageEditor} from './PlatformWorkspace';
const PlatformWebsite=lazy(()=>import('../admin/SiteSettings'));
const PlatformPolicies=lazy(()=>import('./PlatformPolicies'));
const PlatformEmails=lazy(()=>import('./PlatformEmails'));
const client=axios.create({baseURL:'/api/platform'});
client.interceptors.request.use(config=>{const token=sessionStorage.getItem('platform_token');if(token)config.headers.Authorization='Bearer '+token;return config;});
const descriptions={'Withdrawals':'Approve organization withdrawals and track bank transfers.','Booking payments':'Track event booking payments and refunds.',Overview:'A clear view of your organizers, events and package revenue.',Organizers:'The people and workspaces bringing events to life.','Event packages':'Flexible event packages. Simple, one-time pricing.',Payments:'Track package purchases and verified payments.',Activity:'A record of what changed, and when.','SMTP settings':'Manage your email connection and send a test email.','Payment configuration':'Configure booking payments and automatic bank payouts.','Email templates':'Edit automated platform emails and preview them before saving.','Website & branding':'Manage your platform’s identity, contact details and social links.','Policies & pages':'Publish and manage the pages on your platform website.'};
const sectionPaths={'Withdrawals':'withdrawals','Booking payments':'booking-payments',Overview:'',Organizers:'organizers','Event packages':'packages',Payments:'payments',Activity:'activity','SMTP settings':'settings','Payment configuration':'payment-configuration','Email templates':'email-templates','Website & branding':'website','Policies & pages':'policies'};
export default function Platform(){
 const location=useLocation(),navigate=useNavigate(),leaveGuard=useRef(null);
 const path=location.pathname.replace(/^\/superadmin\/?/,'').replace(/\/$/,'');
 const organizerId=path.match(/^organizers\/([^/]+)$/)?.[1];
 const tab=organizerId?'Organizers':Object.keys(sectionPaths).find(key=>sectionPaths[key]===path)||'Overview';
 const [token,setToken]=useState(()=>sessionStorage.getItem('platform_token')),[data,setData]=useState(null);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[login,setLogin]=useState({email:'',password:''});
 const [pack,setPack]=useState(null);
 async function load(){const r=await client.get('/overview');setData(r.data.data);}
 useEffect(()=>{if(token)load().catch(e=>{if(e.response?.status===401){sessionStorage.removeItem('platform_token');setToken(null);}setError(e.response?.data?.message||'Unable to load the platform.');});},[token]);
 useEffect(()=>{window.scrollTo(0,0);},[tab,organizerId]);
 async function action(fn,success){setBusy(true);setError('');setMessage('');try{await fn();await load();setMessage(success);}catch(e){setError(e.response?.data?.message||e.message||'This action could not be completed.');}finally{setBusy(false);}}
 async function signIn(e){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await client.post('/login',login);sessionStorage.setItem('platform_token',r.data.data.token);setToken(r.data.data.token);setLogin({email:'',password:''});}catch(e){setError(e.response?.data?.message||'Unable to sign in.');}finally{setBusy(false);}}
 function selectSection(section){if(leaveGuard.current&&!leaveGuard.current())return;setPack(null);setError('');setMessage('');navigate('/superadmin'+(sectionPaths[section]?'/'+sectionPaths[section]:''));}
 function openOrganizer(org){navigate('/superadmin/organizers/'+org.id);setError('');setMessage('');}
 function signOut(){if(leaveGuard.current&&!leaveGuard.current())return;sessionStorage.removeItem('platform_token');setToken(null);setData(null);}
 function createPackage(){setPack({name:'',event_count:3,price:'',active:false});}
 return <PlatformLayout authenticated={Boolean(token)} active={tab} sectionPaths={sectionPaths} onSelect={selectSection} onSignOut={signOut}>{!token?<PlatformLogin login={login} setLogin={setLogin} onSubmit={signIn} busy={busy} error={error}/>:<>
  {!organizerId&&<header className="page-head pw-page-head"><div><span className="eyebrow">Your platform, at a glance</span><h1>{tab}</h1><p className="lede">{descriptions[tab]}</p></div><div className="actions"><button className="secondary pw-refresh" disabled={busy} onClick={()=>action(async()=>{},'Platform refreshed.')}><Icon name="clock" size={15}/>{busy?'Refreshing…':'Refresh'}</button>{tab==='Event packages'&&<button onClick={createPackage}><Icon name="plus" size={16}/>Create package</button>}</div></header>}
  {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice success" role="status">{message}</p>}
  {organizerId?<OrganizerManage key={organizerId} id={organizerId} client={client} leaveGuard={leaveGuard} onBack={()=>selectSection('Organizers')} onUpdated={()=>load().catch(()=>setError('Account updated. Refresh the directory to see the latest totals.'))}/>:!data?<div className="pw-loading" role="status">Loading your platform…</div>:<>
   {tab==='Overview'&&<Overview data={data} onSelect={selectSection} onOrganizer={openOrganizer}/>}
   {tab==='Organizers'&&<Organizers data={data}/>}
   {tab==='Event packages'&&<Packages data={data} onCreate={createPackage} onEdit={p=>setPack({...p,price:p.price_paise?p.price_paise/100:'',active:Boolean(p.active)})}/>}
   {tab==='Payments'&&<Payments data={data} busy={busy} onCheck={p=>action(async()=>{const r=await client.post('/purchases/'+p.id+'/reconcile');if(r.data.data.status!=='paid')throw new Error('Payment is still pending.');},'Payment confirmed and balance updated.')}/>}
   {tab==='Activity'&&<Activity data={data}/>}
   {tab==='Withdrawals'&&<PlatformWithdrawals client={client} refreshKey={data}/>}
   {tab==='Booking payments'&&<BookingPayments client={client} refreshKey={data}/>}
   {tab==='Payment configuration'&&<PaymentSettings client={client} onSaved={()=>load().catch(()=>{})}/>}
   {tab==='SMTP settings'&&<PlatformSettings client={client}/>}
   {tab==='Email templates'&&<Suspense fallback={<p>Opening email studio…</p>}><PlatformEmails client={client} onSettings={()=>selectSection('SMTP settings')}/></Suspense>}
   {tab==='Website & branding'&&<Suspense fallback={<p>Loading platform website…</p>}><PlatformWebsite client={client} platform onNavigate={selectSection}/></Suspense>}
   {tab==='Policies & pages'&&<Suspense fallback={<p>Loading platform pages…</p>}><PlatformPolicies client={client}/></Suspense>}
   {pack&&<PackageEditor initial={pack} onClose={()=>setPack(null)} onSave={async p=>{await client.post('/packages',p);setMessage('Package saved.');try{await load();}catch{setError('Package saved, but the list could not refresh. Please refresh the page.');}}}/>}
  </>}
 </>}</PlatformLayout>;
}
