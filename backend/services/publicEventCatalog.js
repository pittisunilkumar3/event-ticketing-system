const db = require('../config/db');
const Event = require('../models/Event');
const fields = ['id','title','slug','summary','category','venue','city','banner_image','start_datetime','end_datetime','status','min_price'];
async function list(filters={}) {
  const [organizations] = await db.platform.query("SELECT id,slug,db_name,is_legacy FROM organizations WHERE status='active' ORDER BY id");
  const events=[], categories=new Set(), cities=new Set();
  // Bound concurrent tenant reads; only published public card data leaves each tenant.
  for(let start=0;start<organizations.length;start+=4) {
    const results=await Promise.all(organizations.slice(start,start+4).map(org=>db.run(org,async()=>{
      const rows=await Event.findAll({...filters,status:'published',archived:false,limit:100});
      const choices=await Event.distinctFilters();
      return {choices,rows:rows.map(row=>({...Object.fromEntries(fields.map(key=>[key,row[key]])),public_key:org.id+':'+row.id,public_path:(org.is_legacy?'':'/o/'+encodeURIComponent(org.slug))+'/events/'+encodeURIComponent(row.slug)}))};
    })));
    for(const result of results){events.push(...result.rows);result.choices.categories.forEach(c=>categories.add(c));result.choices.cities.forEach(c=>cities.add(c));}
  }
  events.sort((a,b)=>String(b.start_datetime).localeCompare(String(a.start_datetime))||a.public_key.localeCompare(b.public_key));
  return {events:events.slice(0,100),filters:{categories:[...categories].sort(),cities:[...cities].sort()}};
}
// Resolve old/shared platform links without mixing organizer databases. Slugs are
// unique within an organizer only, so never pick an arbitrary cross-tenant match.
async function findBySlug(slug) {
  const [organizations] = await db.platform.query("SELECT id,slug,db_name,is_legacy FROM organizations WHERE status='active' AND is_legacy=FALSE ORDER BY id");
  const matches=[];
  for(let start=0;start<organizations.length;start+=4) {
    const results=await Promise.all(organizations.slice(start,start+4).map(organization=>db.run(organization,async()=>{
      const event=await Event.findBySlug(slug);
      return event?.status==='published' && !event.archived_at ? {organization,event} : null;
    })));
    matches.push(...results.filter(Boolean));
    if(matches.length>1) {
      const error=new Error('More than one organizer uses this event link. Please choose your event from Explore events.');
      error.statusCode=409;
      throw error;
    }
  }
  return matches[0] || null;
}
module.exports={list,findBySlug};
