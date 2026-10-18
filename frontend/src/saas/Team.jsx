import {useEffect,useState} from 'react';
import api from '../api/client';
import Icon from '../components/Icon';
import {useAdminSession} from '../admin/adminSessionContext';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import './team.css';

const emptyForm={name:'',email:'',password:'',role:'staff'};
const roleNames={super_admin:'Owner',staff:'Manager'};
export default function Team(){
 const admin=useAdminSession();
 const site=useSiteSettings();
 const [members,setMembers]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[attempt,setAttempt]=useState(0);
 const [form,setForm]=useState(emptyForm);
 const [removing,setRemoving]=useState(null);
 const load=()=>api.get('/admin/saas/team').then(r=>setMembers(r.data.data.members));
 useEffect(()=>{
  const controller=new AbortController();
  api.get('/admin/saas/team',{signal:controller.signal}).then(r=>setMembers(r.data.data.members)).catch(e=>{if(!controller.signal.aborted)setLoadError(e.response?.data?.message||'Unable to load your team.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[attempt]);
 async function submit(e){
  e.preventDefault();if(busy)return;
  if(new TextEncoder().encode(form.password).length>72){setError('Use a password up to 72 bytes. Some characters use more than one byte.');return;}
  setBusy('add');setError('');setMessage('');
  try {
   await api.post('/admin/saas/team',{...form,name:form.name.trim(),email:form.email.trim()});
   setForm(emptyForm);setMessage('Team member added. Share their sign-in details privately.');
   try{await load();}catch{setLoadError('Member added, but the list could not refresh. Try again to see the latest team.');}
  }catch(e){setError(e.response?.data?.message||'Unable to add this member.');}finally{setBusy('');}
 }
 async function remove(member){
  if(busy)return;setBusy('remove');setError('');setMessage('');
  try{
   await api.delete('/admin/saas/team/'+member.id);setRemoving(null);setMessage(`Access removed for ${member.name}.`);
   setMembers(current=>current.filter(m=>m.id!==member.id));
  }catch(e){setError(e.response?.data?.message||'Unable to remove member.');}finally{setBusy('');}
 }
 return <div className="team-page">
  <header className="team-heading"><div><p className="studio-eyebrow">WORKSPACE / PEOPLE</p><h1>Your team.</h1><p>Bring the right people into <strong>{site.company_name}</strong>. Give each person the access they need.</p></div><span className="team-workspace-tag"><Icon name="users" size={16}/>Organization access</span></header>
  {error&&<p className="studio-notice" role="alert">{error}</p>}{message&&<p className="studio-notice success" role="status">{message}</p>}
  <div className="team-layout">
   <section className="team-panel team-members" aria-labelledby="team-members-title">
    <div className="team-panel-heading"><div><h2 id="team-members-title">Team members {!loading&&!loadError&&<span>{members.length}</span>}</h2><p>Access is limited to this organization.</p></div><Icon name="users" size={22}/></div>
    {loading?<p className="team-empty" role="status">Loading your team…</p>:loadError?<div className="team-empty"><p role="alert">{loadError}</p><button className="studio-button secondary" onClick={()=>{setLoading(true);setLoadError('');setAttempt(n=>n+1);}}>Try again</button></div>:!members.length?<p className="team-empty">No team members found.</p>:<ul className="team-member-list">{members.map(m=>{
     const self=Number(m.id)===Number(admin.id);
     return <li key={m.id} className="team-member"><div className="team-member-main"><span className="team-avatar" aria-hidden="true">{m.name.trim().split(/\s+/).map(word=>word[0]).slice(0,2).join('').toUpperCase()}</span><div className="team-member-info"><h3>{m.name}{self&&<small>You</small>}</h3><p>{m.email}</p><span className={`team-role ${m.role==='super_admin'?'owner':''}`}>{roleNames[m.role]||'No dashboard access'}</span></div>{!self&&<button className="team-remove" type="button" disabled={!!busy} aria-label={`Remove ${m.name}`} onClick={()=>setRemoving(m.id)}>Remove</button>}</div>{removing===m.id&&<div className="team-remove-confirm"><p>Remove {m.name} from this organization? They will lose dashboard access.</p><div><button className="studio-button secondary" disabled={!!busy} onClick={()=>setRemoving(null)}>Keep member</button><button className="studio-button team-danger" disabled={!!busy} onClick={()=>remove(m)}>{busy==='remove'?'Removing…':'Remove access'}</button></div></div>}</li>;
    })}</ul>}
    <div className="team-role-guide"><h3>What each role can access</h3><div><span className="team-role owner">Owner</span><p>Dashboard, events, orders, and check-in, plus team, wallet, package purchases, designs, and organization settings.</p></div><div><span className="team-role">Manager</span><p>Dashboard, events, orders, and check-in. Can view event packages, but cannot purchase them or manage the team and organization settings.</p></div><p className="team-scope-note">Organization roles do not grant access to platform Superadmin.</p></div>
   </section>
   <section className="team-panel team-add" aria-labelledby="team-add-title"><div className="team-panel-heading"><div><h2 id="team-add-title">Add a team member</h2><p>Create their account for this workspace.</p></div><span className="team-add-icon"><Icon name="plus" size={20}/></span></div>
    <form onSubmit={submit}><fieldset disabled={!!busy}>
     <label htmlFor="team-name">Full name</label><input id="team-name" required maxLength={100} autoComplete="off" placeholder="Alex Morgan" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
     <label htmlFor="team-email">Email address</label><input id="team-email" required type="email" maxLength={150} autoComplete="off" placeholder="alex@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
     <label htmlFor="team-password">Initial password</label><input id="team-password" required type="password" minLength={12} maxLength={72} autoComplete="new-password" placeholder="At least 12 characters" aria-describedby="team-password-hint" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><small id="team-password-hint">Share this password privately with your team member.</small>
     <label htmlFor="team-role">Workspace role</label><select id="team-role" value={form.role} aria-describedby="team-role-hint" onChange={e=>setForm({...form,role:e.target.value})}><option value="staff">Manager</option><option value="super_admin">Owner</option></select>
     <p id="team-role-hint" className="team-role-hint">{form.role==='staff'?'Manage day-to-day events, orders, and guest check-in.':'Full organization access, including team management, settings, and billing.'}</p>
     <button className="studio-button primary" type="submit"><Icon name="plus" size={17}/>{busy==='add'?'Adding member…':'Add team member'}</button>
    </fieldset></form>
   </section>
  </div>
 </div>;
}
