import {useEffect, useState} from 'react';
import {Link, Navigate, Outlet, useLocation} from 'react-router-dom';
import api from '../api/client';
import {session} from '../saas/context';

import {AdminContext, useAdminSession, isOrganizationRole} from './adminSessionContext';

export default function AdminSession() {
  const location=useLocation();
  const token=session.getItem('admin_token');
  const [state,setState]=useState({admin:null,error:'',checkedPath:null});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!token)return;
    let alive=true,revision=0;
    const controller=new AbortController();
    const load=async()=>{
      const request=++revision;
      try {
        const {data}=await api.get('/auth/me',{signal:controller.signal,timeout:15000});
        if(!alive||request!==revision)return;
        const admin=data.data.admin;
        setState({admin,error:isOrganizationRole(admin.role)?'':'This account does not have access to the organization dashboard.',checkedPath:location.pathname});
        try {session.setItem('admin_user',JSON.stringify(admin));} catch { /* The current profile remains available in memory. */ }
      } catch(error) {
        if(alive&&request===revision)setState({admin:null,error:error.response?.data?.message||'Unable to check your access. Please try again.',checkedPath:location.pathname});
      }
    };
    load();window.addEventListener('focus',load);window.addEventListener('admin-profile-updated',load);
    return()=>{alive=false;controller.abort();window.removeEventListener('focus',load);window.removeEventListener('admin-profile-updated',load);};
  },[token,location.pathname,attempt]);
  if(!token)return <Navigate to="/admin/login" state={{from:location.pathname}} replace/>;
  if(state.checkedPath!==location.pathname)return <p className="p-8 text-slate-600" role="status">Checking workspace access…</p>;
  if(state.error)return <div className="p-8 text-slate-700"><p role="alert">{state.error}</p><button className="studio-button secondary mt-4" onClick={()=>setAttempt(n=>n+1)}>Try again</button> <Link to="/">Back to website</Link></div>;
  return <AdminContext.Provider value={state.admin}><Outlet/></AdminContext.Provider>;
}

export function OwnerAccess() {
  const admin=useAdminSession();
  if(admin?.role!=='super_admin')return <section className="studio-panel p-6"><h1 className="text-xl font-semibold">Owner access required</h1><p className="my-3 text-slate-600">Your Manager role includes the dashboard, events, orders, and guest check-in.</p><Link className="studio-button secondary" to="/admin">Back to dashboard</Link></section>;
  return <Outlet/>;
}
