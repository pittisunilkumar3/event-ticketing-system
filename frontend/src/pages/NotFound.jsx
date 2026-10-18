import { Link } from 'react-router-dom';
import CustomerState from '../components/CustomerState';

export default function NotFound() {
  return <CustomerState eyebrow="404 · PAGE NOT FOUND" title="A little off the beaten path." description="This page may have moved, or the link may be incorrect. Let’s find your next great experience." action="Explore events"><Link className="customer-text-link" to="/my-bookings">Looking for your tickets?</Link></CustomerState>;
}
