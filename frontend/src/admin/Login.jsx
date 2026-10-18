import {session} from '../saas/context';
import { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import api from '../api/client';
import Icon from '../components/Icon';
import '../pages/customer.css';

export default function Login() {
  const site=useSiteSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [workspaces,setWorkspaces] = useState(null);
  const [workspaceId,setWorkspaceId] = useState('');

  if (session.getItem('admin_token')) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {...form,...(workspaceId?{workspace_id:Number(workspaceId)}:{})});
      if(data.data.workspaces){setWorkspaces(data.data.workspaces);setLoading(false);return;}
      if(!site.is_organizer && !data.data.workspace.is_legacy){
        const slug=data.data.workspace.slug;
        localStorage.setItem('admin_token:'+slug,data.data.token);
        localStorage.setItem('admin_user:'+slug,JSON.stringify(data.data.admin));
        window.location.assign(data.data.workspace.path);
        return;
      }
      session.setItem('admin_token', data.data.token);
      session.setItem('admin_user', JSON.stringify(data.data.admin));
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      setLoading(false);
    }
  }

  return (
    <main className="organizer-login">
      <section className="login-story">
        <Link className="login-brand" to="/" aria-label={`${site.company_name} home`}><span>{site.logo ? <img src={site.logo} alt=""/> : <Icon name="ticket" size={24}/>}</span>{site.company_name}</Link>
        <div className="login-story-content"><p className="customer-eyebrow">THE WORKSPACE BEHIND THE EXPERIENCE</p><h2>Great events.<br/><span>Start with you.</span></h2><p>Your events, ticket designs, and bookings. Everything you need to bring people together.</p></div>
        <p className="login-story-footer">From the first ticket to the final check-in.</p>
      </section>
      <section className="login-panel">
        <div className="login-panel-inner"><span className="customer-icon"><Icon name="grid" size={24}/></span><h1>Welcome back.</h1><p>Sign in to your organizer workspace.</p>
          <form onSubmit={handleSubmit} className="customer-form">
            <label htmlFor="login-email">Email address</label>
            <input id="login-email" type="email" autoComplete="username" required value={form.email} onChange={e => {setForm({...form,email:e.target.value});setWorkspaces(null);setWorkspaceId('');}} placeholder="you@example.com" disabled={loading}/>
            <label htmlFor="login-password">Password</label>
            <div className="login-password-field"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={form.password} onChange={e => {setForm({...form,password:e.target.value});setWorkspaces(null);setWorkspaceId('');}} placeholder="Enter your password" disabled={loading}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button></div>
            {workspaces && <><label htmlFor="login-workspace">Choose your workspace</label><select id="login-workspace" required value={workspaceId} disabled={loading} onChange={e=>setWorkspaceId(e.target.value)}><option value="">Select a workspace</option>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name} ({w.slug})</option>)}</select></>}
            {error && <p className="customer-alert" role="alert">{error}</p>}
            <button className="customer-button" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}<Icon name="arrow" size={18}/></button>
          </form>
          <nav className="login-links" aria-label="Account and website">
            <a href="/signup" className="login-signup-link">Create an organizer account <Icon name="arrow" size={16}/></a>
            <Link to="/" className="login-back-link"><span aria-hidden="true">←</span> Back to website</Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
