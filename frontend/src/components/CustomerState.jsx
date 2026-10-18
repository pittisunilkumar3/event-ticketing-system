import { Link } from 'react-router-dom';
import Icon from './Icon';

export default function CustomerState({ loading = false, eyebrow = 'LET’S GET YOU BACK ON TRACK', title, description, to = '/events', action = 'Browse events', icon = 'ticket', children }) {
  return (
    <main className="customer-page customer-state-page">
      <div className="customer-state" role={loading ? 'status' : undefined} aria-live={loading ? 'polite' : undefined}>
        <span className={`customer-state-icon ${loading ? 'is-loading' : ''}`}><Icon name={icon} size={30}/></span>
        <p className="customer-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="customer-description">{description}</p>}
        {!loading && <div className="customer-actions"><Link className="customer-button" to={to}>{action}<Icon name="arrow" size={18}/></Link>{children}</div>}
      </div>
    </main>
  );
}
