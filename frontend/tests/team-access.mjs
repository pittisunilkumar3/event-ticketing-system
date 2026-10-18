import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),plugins:[{name:'access-render-stubs',enforce:'pre',load(id){
 if(id.endsWith('/src/api/client.js'))return 'export default {};';
 if(id.endsWith('/src/saas/context.js'))return 'export const session={getItem:()=>null};';
}}],server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
 const {AdminContext,isOrganizationRole}=await server.ssrLoadModule('/src/admin/adminSessionContext.js');
 const {default:AdminLayout}=await server.ssrLoadModule('/src/admin/AdminLayout.jsx');
 const {OwnerAccess}=await server.ssrLoadModule('/src/admin/AdminSession.jsx');
 const render=(role,component)=>renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:['/admin/team']},React.createElement(AdminContext.Provider,{value:{id:1,name:'Example',role}},component)));
 const owner=render('super_admin',React.createElement(AdminLayout));
 const manager=render('staff',React.createElement(AdminLayout));
 for(const path of ['/admin/team','/admin/wallet','/admin/mail-settings','/admin/ticket-designs']) {
  assert.ok(owner.includes(`href="${path}"`),`Owner navigation: ${path}`);
  assert.ok(!manager.includes(`href="${path}"`),`Manager must not see: ${path}`);
 }
 for(const path of ['/admin','/admin/events','/admin/orders','/admin/check-in','/admin/account','/admin/event-packages'])assert.ok(manager.includes(`href="${path}"`));
 const protectedPage=React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(OwnerAccess)},React.createElement(Route,{path:'/admin/team',element:React.createElement('div',null,'Restricted team content')})));
 assert.match(render('super_admin',protectedPage),/Restricted team content/);
 assert.doesNotMatch(render('staff',protectedPage),/Restricted team content/);
 assert.match(render('staff',protectedPage),/Owner access required/);
 for(const role of [null,undefined,'platform','check_in','',{}])assert.equal(isOrganizationRole(role),false);
 assert.equal(isOrganizationRole('staff'),true);assert.equal(isOrganizationRole('super_admin'),true);
 console.log('Team access: Owner and Manager menus, direct restricted routes, shared dashboard links, and unknown-role rejection passed.');
} finally {await server.close();}
