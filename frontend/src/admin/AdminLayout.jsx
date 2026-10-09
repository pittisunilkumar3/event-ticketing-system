import { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';

/* Reference design: 218px deep-green gradient sidebar, compact nav with
   bright-green active border, section headings, bottom account card,
   sidebar art, and a compact 50px white header. */

const menu = [
  {
    to: '/admin',
    label: 'Dashboard',
    end: true,
    icon: (
      <svg className="h-[19px] w-[19px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/admin/events',
    label: 'Events',
    icon: (
      <svg className="h-[19px] w-[19px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: '/admin/orders',
    label: 'Orders',
    icon: (
      <svg className="h-[19px] w-[19px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 5h6m-6 4h6m-6 4h4" />
      </svg>
    ),
  },
  {
    to: '/admin/check-in',
    label: 'Check-in',
    icon: (
      <svg className="h-[19px] w-[19px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const accountMenu = [
  {
    to: '/admin/settings',
    label: 'Settings',
    icon: (
      <svg className="h-[19px] w-[19px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function pageTitle(pathname) {
  if (pathname === '/admin' || pathname === '/admin/') return 'Dashboard';
  if (pathname === '/admin/events') return 'Events';
  if (pathname === '/admin/events/new') return 'Create Event';
  if (/^\/admin\/events\/\d+\/edit$/.test(pathname)) return 'Edit Event';
  if (/^\/admin\/events\/\d+$/.test(pathname)) return 'Event Details';
  if (pathname === '/admin/orders') return 'Orders';
  if (/^\/admin\/orders\/\d+/.test(pathname)) return 'Order Details';
  if (pathname === '/admin/check-in') return 'Ticket Check-in';
  if (pathname === '/admin/settings') return 'Settings';
  return 'Admin Panel';
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const admin = JSON.parse(localStorage.getItem('admin_user') || '{}');
  const initials = (admin.name || 'A')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  function logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  }

  const linkCls = ({ isActive }) =>
    `flex min-h-[34px] items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 text-[11px] font-medium transition-all duration-200 ${
      isActive
        ? 'border-l-[#8b5cf6] bg-[linear-gradient(100deg,#6366f1_0%,#4f46e5_100%)] font-bold text-white shadow-[0_2px_7px_#001d2215]'
        : 'border-l-transparent text-[#e0e7ff]/70 hover:bg-white/[0.04] hover:text-white'
    }`;

  const sidebar = (
    <aside
      id="panel-sidebar"
      className="fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col text-white transition-transform duration-300 lg:w-[218px] lg:translate-x-0"
      style={{ background: 'linear-gradient(145deg,#1e1b4b 0%,#191642 55%,#14122e 100%)' }}
    >
      {/* Brand */}
      <div className="flex min-h-[64px] flex-shrink-0 items-center gap-3 border-b border-white/[0.07] px-[14px] py-4">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(130deg,#4f46e5,#312e81)] text-xl ring-1 ring-white/15">
          🎟️
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[13px] font-bold text-[#eef2ff]">TicketFlow</h1>
          <p className="text-[10px] leading-4 text-[#a5b0d6]">Management Panel</p>
        </div>
        <button className="p-1 text-white/50 hover:text-white lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="side-nav mt-2 min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-[10px] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
        {menu.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkCls} onClick={() => setSidebarOpen(false)}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}

        <div className="px-3 pb-1 pt-4">
          <p className="text-[8px] font-bold uppercase tracking-[1.5px] text-[#a5b0d6]">Account</p>
          <div className="mt-1.5 border-t border-white/10" />
        </div>

        {accountMenu.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkCls} onClick={() => setSidebarOpen(false)}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Account card — pinned bottom */}
      <div className="relative z-[1] mx-3 mb-2 mt-3 rounded-[13px] border border-white/[0.08] bg-[#312e8166] p-2.5">
        <div className="mb-1 flex items-center gap-2.5 px-0.5 py-1">
          <div className="flex h-[33px] w-[33px] flex-shrink-0 items-center justify-center rounded-full border-2 border-[#deeee6] bg-[#f3fffb] text-[11px] font-bold text-[#173e34]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold leading-[15px] text-white">{admin.name}</p>
            <p className="truncate text-[9px] leading-[14px] text-[#bdd8cc]">{admin.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex min-h-[31px] w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-[11px] font-medium text-[#e0e7ff]/70 transition hover:bg-white/10 hover:text-white"
        >
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>

      {/* Sidebar art */}
      <div aria-hidden="true" className="relative hidden select-none overflow-hidden pb-2 lg:block">
        <svg className="absolute -left-1 bottom-0 h-[74px] w-[150px] opacity-60" viewBox="0 0 150 74" fill="none">
          <path
            d="M10 64a8 8 0 018-8h100a8 8 0 018 8v0a0 0 0 010 0H10a0 0 0 010 0v0z"
            stroke="#6b7bc4"
            strokeWidth="1.2"
          />
          <path
            d="M28 30a10 10 0 0110-10h74a10 10 0 0110 10v16a6 6 0 00-6 6 6 6 0 006 6v0a10 10 0 01-10 8H38a10 10 0 01-10-10 6 6 0 000-12z"
            stroke="#6b7bc4"
            strokeWidth="1.2"
            transform="translate(-14 -8)"
          />
          <line x1="86" y1="24" x2="86" y2="58" stroke="#6b7bc4" strokeWidth="1.2" strokeDasharray="3 3" />
        </svg>
        <p
          className="absolute bottom-3 left-4 text-[15px] italic leading-tight text-[#a5b4fc]"
          style={{ fontFamily: 'cursive', transform: 'rotate(-6deg)', textShadow: '0 1px 0 #001c20' }}
        >
          Better Events.
          <br />
          Brighter Nights.
        </p>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#f4f5fd]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {sidebar}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[218px]">
        {/* Compact header */}
        <header className="sticky top-0 z-30 flex h-[50px] min-h-[50px] items-center gap-3 border-b border-[#e8e9f5] bg-white/90 px-4 backdrop-blur-xl sm:px-5">
          <button
            className="p-1.5 text-gray-500 hover:text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h2 className="truncate text-[13px] font-bold capitalize tracking-[-0.15px] text-[#1e1b4b]">
            {pageTitle(pathname)}
          </h2>

          <div className="ml-auto flex items-center">
            <Link
              to="/"
              className="mr-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#4c5a8a] transition hover:bg-gray-100 hover:text-gray-900"
              title="View website"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 0c2 1.5 2 6.5 0 9m0-9c-2 1.5-2 6.5 0 9m9-4.5H3" />
              </svg>
              <span className="hidden sm:inline">View website</span>
            </Link>

            {/* Profile */}
            <div className="flex items-center gap-2.5 border-l border-[#e7e9f5] py-1 pl-3">
              <div className="flex h-[31px] w-[31px] items-center justify-center rounded-[11px] bg-[linear-gradient(130deg,#4f46e5,#312e81)] text-[11px] font-bold text-white shadow-sm">
                {initials}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-[10px] font-bold leading-4 text-[#1e1b4b]">{admin.name}</p>
                <p className="text-[9px] leading-3 text-[#6b7aa8]">{admin.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
