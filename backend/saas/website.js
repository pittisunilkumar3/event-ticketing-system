const db=require('../config/db');
const defaults=require('../services/studioDefaults');
const v=require('../services/studioValidation');
const {validateSiteSettings,publicSiteSettings}=require('../services/siteSettings');
const pageDefaults=()=>defaults.pages.map(([slug,title])=>({slug,title,body:'',published:false}));
// Make newly supported pages editable on existing installations without
// replacing their saved content or publishing empty pages.
const withPageDefaults=current=>[
 ...pageDefaults().map(page=>({...page,...current.find(saved=>saved.slug===page.slug)})),
 ...current.filter(page=>!defaults.pages.some(([slug])=>slug===page.slug)),
];
async function initialize(conn){
 const [settings]=await conn.query("SELECT setting_key,value_json FROM system_settings WHERE setting_key IN ('brand','social_links')");
 const existing=Object.fromEntries(settings.map(row=>[row.setting_key,JSON.parse(row.value_json)]));
 const [pages]=await conn.query('SELECT slug,title,body,published,updated_at FROM content_pages');
 for(const [key,value] of [['website_brand',{...defaults.brand,...existing.brand}],['website_social',existing.social_links||defaults.social_links],['website_pages',pageDefaults().map(p=>({...p,...pages.find(saved=>saved.slug===p.slug)}))]])
  await conn.query('INSERT IGNORE INTO platform_settings(name,value_json) VALUES (?,?)',[key,JSON.stringify(value)]);
}
async function get(name,fallback){const [[row]]=await db.platform.query('SELECT value_json FROM platform_settings WHERE name=?',[name]);return row?JSON.parse(row.value_json):fallback;}
const brand=async()=>publicSiteSettings(await get('website_brand',defaults.brand));
const social=async()=>v.socialLinks(await get('website_social',defaults.social_links));
async function pages(publishedOnly=false){return withPageDefaults(await get('website_pages',pageDefaults())).map(p=>({...p,published:Boolean(p.published)})).filter(p=>!publishedOnly||p.published);}
async function update(key,fallback,transform,actor,details={}){
 const conn=await db.platform.getConnection();
 try{await conn.beginTransaction();
  await conn.query('INSERT IGNORE INTO platform_settings(name,value_json) VALUES (?,?)',[key,JSON.stringify(fallback)]);
  const [[row]]=await conn.query('SELECT value_json FROM platform_settings WHERE name=? FOR UPDATE',[key]);
  const value=transform(JSON.parse(row.value_json));
  await conn.query('UPDATE platform_settings SET value_json=? WHERE name=?',[JSON.stringify(value),key]);
  await conn.query('INSERT INTO platform_audit(actor_id,action,details_json) VALUES (?,?,?)',[actor,key+'.save',JSON.stringify(details)]);
  await conn.commit();return value;
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
const saveBrand=(input,actor)=>update('website_brand',defaults.brand,current=>validateSiteSettings({...input,site_url:(process.env.PUBLIC_SITE_URL||'http://localhost:5173').replace(/\/$/,'')},current),actor);
const saveSocial=(input,actor)=>update('website_social',defaults.social_links,()=>v.socialLinks(input),actor);
async function savePage(slug,input,actor){
 if(!defaults.pages.some(([key])=>key===slug))v.fail('Page not found.',404);
 const title=v.string(input.title,'Page title',120,true),body=v.html(v.string(input.body,'Page content',150000)),published=input.published===true;
 if(published&&!body.replace(/<[^>]*>/g,'').trim())v.fail('Write page content before publishing.');
 const result=await update('website_pages',pageDefaults(),current=>withPageDefaults(current).map(p=>p.slug===slug?{slug,title,body,published,updated_at:new Date().toISOString()}:p),actor,{slug,published});
 return result.find(p=>p.slug===slug);
}
module.exports={initialize,brand,social,pages,saveBrand,saveSocial,savePage};
