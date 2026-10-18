import {useState} from 'react';
import Icon from '../components/Icon';
import {useSiteSettings} from '../settings/SiteSettingsContext';
import './platformLogin.css';

export default function PlatformLogin({login, setLogin, onSubmit, busy, error}) {
  const site = useSiteSettings();
  const [showPassword, setShowPassword] = useState(false);

  return <main className="platform-login">
    <section className="platform-login-story" aria-labelledby="platform-story-title">
      <a className="platform-login-brand" href="/" aria-label={`${site.company_name} home`}>
        <span>{site.logo ? <img src={site.logo} alt=""/> : <Icon name="ticket" size={25}/>}</span>
        {site.company_name}
      </a>
      <div className="platform-login-story-body">
        <p className="platform-login-eyebrow">THE BIG PICTURE STARTS HERE</p>
        <h2 id="platform-story-title">One platform.<br/><span>Every possibility.</span></h2>
        <p>A single workspace for the people, packages, and experiences that power your platform.</p>
        <div className="platform-login-features">
          <div><Icon name="users" size={20}/><span>Organizers</span><small>Support every workspace</small></div>
          <div><Icon name="ticket" size={20}/><span>Event packages</span><small>Give great events room to grow</small></div>
          <div><Icon name="credit-card" size={20}/><span>Payments</span><small>Keep every purchase in view</small></div>
        </div>
      </div>
      <p className="platform-login-story-footer">Behind every great event, a connected platform.</p>
    </section>
    <section className="platform-login-panel" aria-labelledby="platform-login-title">
      <div className="platform-login-form-wrap">
        <span className="platform-login-symbol"><Icon name="grid" size={24}/></span>
        <p className="platform-login-eyebrow">SUPERADMIN WORKSPACE</p>
        <h1 id="platform-login-title">Welcome back.</h1>
        <p className="platform-login-intro">Sign in to manage your platform.</p>
        <form onSubmit={onSubmit} aria-busy={busy}>
          <label htmlFor="platform-email">Email address</label>
          <input id="platform-email" name="email" type="email" required autoComplete="username" placeholder="you@example.com" disabled={busy} value={login.email} onChange={e => setLogin({...login, email:e.target.value})}/>
          <label htmlFor="platform-password">Password</label>
          <div className="platform-login-password">
            <input id="platform-password" name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Enter your password" disabled={busy} value={login.password} onChange={e => setLogin({...login, password:e.target.value})}/>
            <button type="button" disabled={busy} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} aria-controls="platform-password" onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          {error && <p className="platform-login-error" role="alert">{error}</p>}
          <button className="platform-login-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to superadmin'}<Icon name="arrow" size={18}/></button>
        </form>
        <nav className="platform-login-links" aria-label="Other sign-in options">
          <p>Managing your own events? <a href="/admin/login">Organizer sign in <span aria-hidden="true">↗</span></a></p>
          <a className="platform-login-back" href="/"><span aria-hidden="true">←</span> Back to website</a>
        </nav>
      </div>
    </section>
  </main>;
}
