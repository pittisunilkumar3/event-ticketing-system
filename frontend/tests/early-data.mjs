import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('../public/early-data.js',import.meta.url),'utf8');
const consumer=(await readFile(new URL('../src/settings/publicStartup.js',import.meta.url),'utf8')).replace("import api from '../api/client';",'').replaceAll('export ','');
function setup(path,base){
 const calls=[],timers=new Map();let id=0;
 const window={};const setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};
 window.setTimeout=setTimeout;
 const context=vm.createContext({window,location:{pathname:path},Map,Date,AbortController,setTimeout,clearTimeout:id=>timers.delete(id),fetch(url,options){calls.push({url,options});return Promise.resolve({ok:true,json:async()=>({data:{source:url}})});},api:{defaults:{baseURL:base},get(url){calls.push({url,refresh:true});return Promise.resolve({data:'fresh'});}}});
 vm.runInContext(script,context);return {context,window,calls,timers};
}
for(const [path,base,endpoint] of [['/o/alpha-expo/','/api/o/alpha-expo','/events'],['/o/beta-expo/checkout/expo','/api/o/beta-expo','/events/expo'],['/events/expo','/api','/events/expo']]){
 const {context,window,calls}=setup(path,base);assert.equal(calls.length,2);assert.equal(calls[0].url,base+'/site-settings');assert.equal(calls[1].url,base+endpoint);
 for(const {options}of calls){assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert(options.signal);}
 vm.runInContext(consumer+'\nthis.get=getPublicData;this.preload=preloadPublicRoute;',context);
 context.preload(path.includes('checkout')?'/checkout/expo':path==='/events/expo'?path:'/');
 await context.get('/site-settings');await context.get(endpoint);assert.equal(calls.length,2);assert.equal(window.__ticketflowPublicStart,undefined);
 assert.equal((await context.get(endpoint)).data,'fresh');assert.equal(calls.length,3);
}
for(const path of ['/admin','/admin/login','/superadmin','/o/alpha-expo/admin/events/1','/signup','/confirmation/private-ref'])assert.equal(setup(path,'/api').calls.length,0);
const wrong=setup('/o/alpha-expo/','/api/o/beta-expo');vm.runInContext(consumer+'\nthis.get=getPublicData;',wrong.context);assert.equal((await wrong.context.get('/site-settings')).data,'fresh');
console.log('PASS early public data: immediate public-only requests, tenant isolation, no credentials/cache, shared consumption, fresh refreshes.');
