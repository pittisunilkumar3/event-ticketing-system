import {siteBase} from './saas/context';
import Signup from './saas/Signup';
import Platform from './saas/Platform';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SiteSettingsProvider } from './settings/SiteSettingsContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import './pages/customer.css';
import BrowseEvents from './pages/BrowseEvents';
import EventDetail from './pages/EventDetail';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import MyBookings from './pages/MyBookings';
import { lazy, Suspense, useEffect } from 'react';
const AdminApp = lazy(() => import('./admin/AdminApp'));

import NotFound from './pages/NotFound';
import PolicyPage from './pages/PolicyPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter basename={siteBase || "/"}>
      <SiteSettingsProvider>
      <ScrollToTop />
      <div className="flex min-h-screen flex-col">
        <Routes>
          <Route path="/signup" element={<Signup/>}/>
          <Route path="/superadmin/*" element={<Platform/>}/>
          {/* Admin has its own full-screen layout */}
          <Route path="/admin/*" element={<Suspense fallback={<div className="p-12 text-center">Opening workspace…</div>}><AdminApp /></Suspense>} />

          {/* Customer site */}
          <Route
            path="*"
            element={
              <>
                <Navbar />
                <div className="customer-shell flex-1">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/events" element={<BrowseEvents />} />
                    <Route path="/events/:slug" element={<EventDetail />} />
                    <Route path="/checkout/:slug" element={<Checkout />} />
                    <Route path="/confirmation/:ref" element={<Confirmation />} />
                    <Route path="/my-bookings" element={<MyBookings />} />
                    <Route path="/pages/:slug" element={<PolicyPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
                <Footer />
              </>
            }
          />
        </Routes>
      </div>
      </SiteSettingsProvider>
    </BrowserRouter>
  );
}
