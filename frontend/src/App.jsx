import {siteBase} from './saas/context';

import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SiteSettingsProvider } from './settings/SiteSettingsContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

import './pages/customer.css';
import './pages/landing.css';

import { lazy, Suspense, useEffect } from 'react';
// Start the current page chunk while its public data is loading.
const publicPath = window.location.pathname.slice(siteBase.length) || '/';
function publicPage(pattern, load) {
  const first = pattern.test(publicPath) ? load() : null;
  first?.catch(() => {});
  return lazy(() => first || load());
}
const Home = publicPage(/^\/$/, () => import('./pages/Home'));
const BrowseEvents = publicPage(/^\/events\/?$/, () => import('./pages/BrowseEvents'));
const EventDetail = publicPage(/^\/events\/[^/]+\/?$/, () => import('./pages/EventDetail'));
const Checkout = publicPage(/^\/checkout\/[^/]+\/?$/, () => import('./pages/Checkout'));
const MyBookings = publicPage(/^\/my-bookings\/?$/, () => import('./pages/MyBookings'));
const PolicyPage = publicPage(/^\/pages\/[^/]+\/?$/, () => import('./pages/PolicyPage'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const Platform = lazy(() => import('./saas/Platform'));
const Signup = lazy(() => import('./saas/Signup'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const openingPage = <main className="site-opening" role="status">Opening page…</main>;

import NotFound from './pages/NotFound';

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
        <Suspense fallback={openingPage}><Routes>
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
                  <Suspense fallback={<div className="p-8" role="status">Loading page…</div>}><Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/events" element={<BrowseEvents />} />
                    <Route path="/events/:slug" element={<EventDetail />} />
                    <Route path="/checkout/:slug" element={<Checkout />} />
                    <Route path="/confirmation/:ref" element={<Confirmation />} />
                    <Route path="/my-bookings" element={<MyBookings />} />
                    <Route path="/pages/:slug" element={<PolicyPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes></Suspense>
                </div>
                <Footer />
              </>
            }
          />
        </Routes></Suspense>
      </div>
      </SiteSettingsProvider>
    </BrowserRouter>
  );
}
