import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({plugins:[{name:'credit-test-api',enforce:'pre',load(id){if(id.endsWith('/src/api/client.js'))return 'export default {};';}}],server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
 const {PackageDetails}=await server.ssrLoadModule('/src/saas/PackageDetails.jsx');
 const data={organization:{name:'Test organization',status:'active'},subscription:{latest_purchase:null,purchased_events:0,used_events:0,adjusted_events:3,remaining_events:3,can_create:true,can_publish:true}};
 const render=()=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(PackageDetails,{data})));
 const ready=render();
 assert.match(ready,/Ready to publish/);assert.match(ready,/Superadmin event credits/);assert.match(ready,/href="\/admin\/events\/new"/);
 assert.doesNotMatch(ready,/Package required|paid package is still required/);
 Object.assign(data.subscription,{remaining_events:0,can_create:false,can_publish:false});
 const empty=render();assert.match(empty,/No credits remaining/);assert.doesNotMatch(empty,/href="\/admin\/events\/new"/);
 data.organization.status='suspended';assert.match(render(),/Account suspended/);
 for(const path of ['../src/admin/EventForm.jsx','../src/saas/PackageDetails.jsx']){
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(source,/Credits added manually do not replace a package purchase|A paid package.*required|Event package required/);
 }
 console.log('PASS credit UI: granted credits allow creation, exhausted and suspended states, obsolete purchase requirement removed.');
} finally {await server.close();}
