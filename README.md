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
│   ├── migrations/      001–005 .sql + migrate.js runner
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
