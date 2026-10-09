import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import EventDetail from './pages/EventDetail';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import MyBookings from './pages/MyBookings';
import { lazy, Suspense } from 'react';
const AdminApp = lazy(() => import('./admin/AdminApp'));

import NotFound from './pages/NotFound';
import PolicyPage from './pages/PolicyPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Routes>
          {/* Admin has its own full-screen layout */}
          <Route path="/admin/*" element={<Suspense fallback={<div className="p-12 text-center">Opening workspace…</div>}><AdminApp /></Suspense>} />

          {/* Customer site */}
          <Route
            path="*"
            element={
              <>
                <Navbar />
                <div className="flex-1">
                  <Routes>
                    <Route path="/" element={<Home />} />
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
    </BrowserRouter>
  );
}
