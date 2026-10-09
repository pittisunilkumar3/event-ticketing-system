# 🎟️ TicketFlow — Event Ticketing System

Full-stack event ticketing platform with a **customer booking site** and a **separated REST API backend**.

| Layer | Tech | URL |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind CSS v4 + Recharts | http://localhost:5173 |
| Backend | Node.js + Express (controllers / models / routes / migrations) | http://localhost:5001 |
| Database | MySQL (XAMPP MariaDB) via phpMyAdmin | http://localhost:3306 |

---

## 🚀 Quick Start

**1. Start XAMPP** → make sure **MySQL** is running.

**2. Backend**
```bash
cd backend
npm install
cp .env.example .env  # set database credentials and random secret keys
npm run migrate     # creates ticketing_db + all tables
npm run seed        # sample admin, events, orders
npm run dev         # → http://localhost:5001
```

**3. Frontend** (new terminal)
```bash
cd frontend
npm install
npm run dev         # → http://localhost:5173
```

**Admin login** → `http://localhost:5173/admin/login`
- Email: `admin@ticketing.com`
- Password: `admin123`

---

## 📁 Project Structure

```
tickecting/
├── backend/
│   ├── config/          db.js (MySQL pool)
│   ├── controllers/     auth, event, ticketType, order, ticket, dashboard
│   ├── models/          Admin, Event, TicketType, Order, Ticket
│   ├── routes/          authRoutes, publicRoutes, eventRoutes, ticketTypeRoutes,
│   │                    orderRoutes, ticketRoutes, dashboardRoutes
│   ├── middleware/      auth (JWT), errorHandler, upload (multer)
│   ├── migrations/      001–006 .sql + migrate.js runner
│   ├── seeders/         seed.js
│   ├── uploads/         event banners
│   └── server.js
└── frontend/
    └── src/
        ├── api/         axios client (+ JWT interceptor)
        ├── components/  Navbar, Footer, EventCard, ui (Spinner/Alert/Empty)
        ├── pages/       Home, EventDetail, Checkout, Confirmation, MyBookings
        ├── admin/       AdminApp, Login, AdminLayout, Dashboard, Events,
        │                EventForm, AdminEventDetail, Orders, OrderDetail,
        │                CheckIn, Settings
        └── utils/       formatters, status badges
```

## 🔌 API Overview

**Public (customer)**
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/events` | Browse published events (`?search=&category=&city=`) |
| GET | `/api/events/:slug` | Event detail + ticket availability |
| POST | `/api/orders` | Checkout → creates order + QR tickets (transactional) |
| GET | `/api/bookings/:ref` | Look up booking by reference |

**Admin (JWT `Authorization: Bearer <token>`)**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| GET/PATCH | `/api/auth/me`, `/profile`, `/password` | Account |
| GET/POST/PUT/DELETE | `/api/admin/events` | Events CRUD (banner upload) |
| GET/POST/PUT/DELETE | `/api/admin/ticket-types` | Ticket types CRUD |
| GET | `/api/admin/orders` | Orders (`?status=&event_id=&search=`) |
| PATCH | `/api/admin/orders/:id/cancel` / `refund` | Invalidate + release inventory |
| GET/POST | `/api/admin/tickets/:code`, `/checkin` | Validate & check in |
| GET | `/api/admin/dashboard` | KPIs + chart data |

## 🔄 Booking Flow

```
Browse → Select tickets → Checkout → Mock payment →
Order PAID + QR e-tickets issued → Check-in at venue (code/QR scan)
Admin: cancel/refund → tickets voided → inventory released atomically
```

## 🛠 Useful Commands

```bash
cd backend
npm run migrate   # run pending migrations
npm run seed      # reseed demo data (skips if data exists)
npm run dev       # API with auto-reload
```

## Superadmin design studio

The admin workspace uses a charcoal, warm white and orange theme inspired by Cinematica. Superadmins can manage:

- **Events:** create an event, then add ticket types using General Admission, VIP, Early Bird, Student, Workshop or Free Pass presets. Each type has its own price, inventory, sale dates and ticket design.
- **Ticket designs:** customize classic, minimal or badge layouts, colors, logo, banner and footer. The design is saved with each issued ticket, so later edits do not change existing bookings.
- **Email templates:** choose from eleven formats, customize branding and messages with the reference CKEditor 4 editor (loaded from the official CKEditor 4.20 CDN with an email-safe configuration that keeps inline styles intact), insert booking placeholders and preview using sample data. Booking confirmation, cancellation and refund templates connect to automatic delivery. Custom templates support saving, previewing and explicitly sending a test email.
- **Mail settings:** configure company details, public site URL, sender and SMTP server. Passwords are encrypted with `SETTINGS_ENCRYPTION_KEY` and never returned to the browser. Blank password input keeps the current password. Connection verification does not send mail.
- **Social media:** the visible Social media links section at the top of Brand & SMTP saves Instagram, Facebook, YouTube, LinkedIn, X and Pinterest independently of SMTP. Saved profiles appear in the website footer and emails set to use brand links. Each email can instead use custom profiles or hide social links; existing template-specific links are preserved. Blank profile fields hide that platform.
- **Policy pages:** write and publish privacy, terms, refund, cancellation and contact pages. They start as empty drafts. Only published pages appear in the public footer and selected email links.
- **Email delivery:** inspect sent, failed and skipped notifications and explicitly retry failed/skipped deliveries.

Run `npm run migrate` on existing installations before opening these pages. The studio creates its default templates and draft pages automatically. Studio APIs check the current database role on every request; ordinary admins cannot edit global designs, SMTP or policies.

SMTP starts disabled. Set your public site URL and SMTP credentials, verify the connection, then use **Send test** with your recipient before enabling automatic delivery. The delivery worker runs with the API. Failed messages require a manual retry. Keep the encryption key backed up; changing it makes existing SMTP passwords unreadable. Tests do not send actual emails.

### CKEditor licensing

Email and policy editors use the self-hosted CKEditor 5 packages, with a classic multi-row toolbar modeled on the hostel reference: fonts and sizes, colors, alignment, lists, tables, image uploads, links, find/replace, subscript/superscript, special characters, block outlines, fullscreen and source editing. The editing area is 450px tall on desktop. Privacy Policy opens by default, and all policy pages share the same editor. The reference's unsupported CKEditor 4.4.1 files are not bundled. Script content and unsupported styling are removed by the server. The default editor configuration uses CKEditor's GPL mode. For distribution that does not satisfy the GPL, obtain a suitable self-hosted commercial license and set `VITE_CKEDITOR_LICENSE_KEY` in `frontend/.env.local` before building. This configuration does not change this repository's license. See [CKEditor licensing](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-key-and-activation.html).

### Verification

```bash
cd backend
npm test                  # rendering, sanitization and encryption
npm run test:integration  # isolated database, removed when the run completes
cd ../frontend
npm run build
npm run lint
```

Integration tests require a local database account able to create/drop a temporary database. They cover role enforcement, ticket issuance and snapshots, concurrent cancellation, template persistence, SMTP secret handling and policy publishing.
