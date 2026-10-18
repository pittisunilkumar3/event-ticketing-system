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
npm run migrate:saas # creates platform and organizer tables
npm run platform-admin # first install only; set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD
npm run dev         # → http://localhost:5001
```

**3. Frontend** (new terminal)
```bash
cd frontend
npm install
npm run dev         # → http://localhost:5173
```

**Organizer signup** → `http://localhost:5173/signup`; then sign in with that organizer’s credentials at `/admin/login`. Superadmin signs in at `/superadmin/login` using the credentials set above. Application databases start without sample events or bookings.

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
Browse → Select tickets → Checkout → Verified Razorpay payment (or free booking) →
Order PAID + QR e-tickets issued → Check-in at venue (code/QR scan)
Admin: cancel/refund → tickets voided → inventory released atomically
```

## 🛠 Useful Commands

```bash
cd backend
npm run migrate:saas # run platform and organizer migrations
npm run test:wallet # isolated test data; never seeds the application database
npm run dev       # API with auto-reload
```

## Organizer design studio

The admin workspace uses a charcoal, warm white and orange theme inspired by Cinematica. Organizer owners can manage:

- **Events:** create an event, then add ticket types using General Admission, VIP, Early Bird, Student, Workshop or Free Pass presets. Each type has its own price, inventory, sale dates and ticket design.
- **Ticket designs:** browse 100 distinct ticket layouts, then customize the layout, colors, logo, banner and footer. The design is saved with each issued ticket, so later edits do not change existing bookings.
- **Email templates:** choose from eleven formats, customize branding and messages with the self-hosted classic CKEditor 4 toolbar and email-safe formatting, insert booking placeholders and preview using sample data. Booking confirmation, cancellation and refund templates connect to automatic delivery. Custom templates support saving, previewing and explicitly sending a test email.
- **Website & branding:** `/admin/website` lets organizer owners manage website name, browser title, tagline, description, public URL, logo, favicon, contact email, phone, address, country and footer text. Saved branding updates the website, admin navigation, login screen and browser metadata. My account keeps profile and password settings separate. Social links, templates and policies are available here; organization email delivery is configured in Organization SMTP.
- **Superadmin → SMTP settings:** configure the platform sender, SMTP server and notification inbox for organization registration, package payments and account updates. Passwords are encrypted with `SETTINGS_ENCRYPTION_KEY` and never returned to the browser. Blank password input keeps the current password. Connection verification does not send mail. Use the visible **Send test email** form to send to a specified recipient using saved credentials, even before enabling automatic notifications.
- **Social media:** the visible Social media links section in Website & branding saves Instagram, Facebook, YouTube, LinkedIn, X and Pinterest independently of SMTP. Saved profiles appear in the website footer and emails set to use brand links. Each email can instead use custom profiles or hide social links; existing template-specific links are preserved. Blank profile fields hide that platform.
- **Policy pages:** write and publish privacy, terms, refund, cancellation and contact pages. They start as empty drafts. Only published pages appear in the public footer and selected email links.
- **Email delivery:** inspect sent, failed and skipped notifications and explicitly retry failed/skipped deliveries.

Run `npm run migrate:saas` on existing installations before opening these pages. The studio creates its default templates and draft pages automatically. Studio APIs check the current database role on every request; managers cannot edit organizer designs or policies, and each organization’s SMTP is restricted to its own account owners. Platform SMTP remains restricted to platform administrators.

SMTP starts disabled. Set your public site URL and SMTP credentials, verify the connection, then use **Send test** with your recipient before enabling automatic delivery. The delivery worker runs with the API. Failed messages require a manual retry. Keep the encryption key backed up; changing it makes existing SMTP passwords unreadable. Tests do not send actual emails.

### Classic content editor

Email and policy editors use the local CKEditor 4 distribution at `frontend/public/ckeditor4`, matching the hostel project's classic toolbar and Moono skin. The shared wrapper supports source editing, fonts and sizes, colors, alignment, lists, tables, image uploads, links, find/replace and fullscreen. The desktop editing area is 450px tall. HTML is sanitized on the server before storage and rendering; executable content is removed.

Superadmin policies use a full-width editor, page selector and explicit draft/publish control. Platform email templates have category tabs, a live preview on the left, and message settings on the right. Logo, icon, banner, copyright, selected published policy links and configured social links are included in both preview and delivery. Image uploads use the signed-in account and platform or organizer upload endpoint. The local editor's license files are retained with its distribution.

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

### Event management and booking

**Ticket design collection:** `/admin/ticket-designs` includes 100 distinct built-in layouts across Horizontal, Portrait and Compact categories, with visual thumbnails, search, format filters, 24 designs per page and live editing. The 80 new layouts each define their own section arrangement in `shared/ticketCompositions.json`; tests reject repeated arrangements regardless of colors or typography. Gallery thumbnails fit the complete ticket. Repetitive style editions are no longer seeded. Existing customized editions and issued ticket snapshots remain supported. Formats include boarding passes, cinema tickets, festival posters, badges, invitations, receipts, sports passes, gallery cards and more. The missing built-ins are added automatically when the studio opens; existing names, customizations, archived settings and issued ticket snapshots are preserved. Each format supports brand text, colors, logos, images, entry instructions and optional attendee/price fields. Save a design, then assign it to an event’s ticket type.

Run `npm run test:tickets` in `frontend` to check rendering, booking fields, QR output, hidden fields and cancelled state for the 100 current layouts and 80 legacy editions. The backend integration suite additionally verifies saving, assigning and issuing each format, and repeat initialization without overwriting customizations.

Run `npm run migrate` in `backend` and restart the API after updating. Migration `007_event_management.sql` adds event details and ticket sales controls while preserving existing data.

- In **Events**, create or edit event artwork, introduction, schedule, venue/address, organizer, admission policy, highlights and entry instructions.
- Open an event’s **Tickets & pricing** tab to add custom ticket names or use presets, including Group Pass and Free Pass. Set each price (INR), capacity, per-booking minimum/maximum, sales dates, display order and ticket design.
- Event **On/Off** controls public visibility. Ticket **Turn on/off** controls an individual ticket’s availability. The API enforces availability and capacity at checkout.
- **Delete** moves events and ticket types into a recoverable archive. Existing bookings and issued tickets remain available. Restored events are drafts; restored ticket types have sales off.
- **Event details** shows the full setup; **Recent bookings** links to orders filtered for that event.
- The customer booking and checkout pages adapt to phones and desktops. Cart selections survive checkout refreshes. Paid bookings use Razorpay checkout; tickets are issued after verified capture. Free bookings confirm immediately.

The integration suite also covers multipart event creation, date validation, stable event links after renaming, pricing and quantity limits, sales schedules, on/off controls, archive/restore and booking preservation.

**My account:** `/admin/account` includes a profile summary, saved role and account dates, profile editing with discard/save controls, and password confirmation with show/hide controls. Profile saves refresh the workspace name and initials. Run `npm --prefix backend run test:account` for focused profile validation checks.


### SaaS event packages and organizer sites

Run `npm run migrate:saas` from `backend` before starting the API. This applies tenant migrations, creates central billing tables and the shared platform settings table, and preserves existing primary-workspace SMTP configuration. New accounts start with zero event credits. Existing published events are grandfathered by migration 008.

- `/signup` creates an organizer, owner account and isolated database. `/o/<slug>` is its branded homepage; `/o/<slug>/admin` is its workspace. `BASE_DOMAIN` optionally enables organizer subdomains, with wildcard DNS/TLS and reverse-proxy configuration supplied by your host. Arbitrary organizer custom-domain mapping is not implemented.
- **Website & branding** controls the homepage headline, image, accent color, name, logo, favicon, description, contact details, social links and footer. The homepage lists that organizer’s upcoming published events. Templates and policies stay with the organizer; personal profile/password controls are in **My account**.
- **Superadmin → SMTP settings** owns shared SMTP configuration and test delivery. **Payment configuration** manages Razorpay test/live keys and the webhook secret for INR event-package purchases. Organizer APIs cannot read SMTP credentials or change delivery configuration. Organizer branding remains editable in their own workspace.
- **Superadmin → Event packages** sets INR prices and event quantities. Packages are prepaid, have no monthly billing or expiry, and start unpublished until a price is set. One credit is consumed atomically on the first publication of an event. Available credits from a verified package purchase or a superadmin adjustment allow event creation, including drafts. Drafts do not deduct credits; repeat publication is free; cancellations/archives do not return credits automatically.
- Package checkout snapshots price and event count. Package checkout adds credits only after captured, verified Razorpay payments; superadmins can separately grant credits through audited adjustments. Signed webhooks and duplicate callbacks are idempotent. **Check payment** in organizer purchase history or superadmin Payments can recover a missed confirmation or lost order response without creating a second order. Refund/dispute notifications are recorded for manual review; no automatic credit reversal is attempted.
- **Superadmin → Organizers** opens a dedicated account page at `/superadmin/organizers/:id` for each organizer. The page includes their profile, events, package payments, credit history, activity and account controls. Direct links survive refresh. All detail queries are scoped to the selected organization and require platform administrator access; no database configuration is returned. Credit adjustments include reasons and idempotent retries. Platform activity records financial and account actions. Platform and organizer sessions are separate; pre-SaaS organizer sessions are rejected with a fresh sign-in prompt.

Configure `PUBLIC_SITE_URL`, `JWT_SECRET` and `SETTINGS_ENCRYPTION_KEY` on the server. Enter Razorpay credentials in **Superadmin → Payment configuration**; secrets are encrypted, blank inputs keep existing secrets for the same key ID, and organizer sessions cannot access them. Existing `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` environment values remain the fallback until settings are saved. Changing the key ID requires its matching secret and is blocked while package payments are pending or under review. Register the webhook at `/api/saas/razorpay/webhook` for `payment.captured` and `order.paid`. Keep secrets out of frontend builds. Use `npm run platform-admin` with the environment inputs shown in `.env.example` to create a platform administrator. There is no default platform password.

Verification: `npm run test:saas` covers isolated signup, tenant permissions, branding/uploads, dashboard data, platform-only settings, purchase snapshots, verified payments, duplicate webhooks, publishing races and payment recovery. It uses disposable local databases and simulated Razorpay responses; it does not test real checkout or send email. `npm run test:integration` covers existing bookings, templates and event lifecycle; `npm run test:account` covers profile updates. Run `npm run build` in `frontend` for the production bundle.

Local limitation: Razorpay credentials are not configured in this workspace, so live payment collection remains disabled. New attendee checkout uses Razorpay in INR, while organizer packages use INR. Configure live credentials and a public webhook to activate real charges. Production rollout also requires hosting, HTTPS, DNS, database backups and real provider verification. Razorpay recovery uses the documented [order receipt lookup and order payments API](https://github.com/razorpay/razorpay-node/blob/master/documents/order.md).


### Organizer sign-in

The main `/admin/login` accepts organizer owners and team members as well as the original workspace account. It verifies the current password in each matching organizer database and opens that workspace. If the same credentials match several workspaces, the form offers a workspace choice after verification. Branded-site login stays restricted to that organizer.

Run `npm run migrate:saas` when upgrading to backfill the email-to-workspace lookup for existing accounts. New accounts, profile email changes and team removal update it in the same database transaction as the account change. Passwords are not copied into the lookup, and tokens are never placed in redirect URLs. Wrong-password errors remain on the login form instead of refreshing it. Run `npm run test:login` in `backend` for isolated main-login, branded-login, workspace-choice and account-change checks.

### Separate platform and organization email delivery

- **Superadmin → Email templates:** six editable notifications cover organization welcome, registration alerts, package receipts, payment alerts, suspension and restoration. Choose editorial welcome, payment receipt or account notice layouts; customize content in classic CKEditor 4 and preview sample data. Delivery history supports explicit retries.
- **Organization → Organization SMTP:** each workspace stores its own encrypted SMTP password, sender and reply-to address. Booking confirmations, cancellations and refunds use only that workspace’s sender and active templates in **Email templates**. The previously saved template library remains at `/admin/email-library`.
- Platform alerts go to the platform notification inbox. Owner messages go to the organization owner. Verified package payments queue messages transactionally and duplicate callbacks do not create duplicate receipts.
- Disabled SMTP or templates produce skipped messages. There is no fallback from an organization to platform SMTP, and migrations do not copy organization credentials to the platform. Existing saved templates are preserved.
- Run `npm run migrate:saas` before restarting the backend. Run `npm run test:mail`, `npm run test:saas`, and `npm run test:integration` for renderer/secret checks and isolated database integration coverage. Delivery tests use a mock SMTP transport and send no actual emails.

### Platform website ownership

Superadmin → **Website & branding** manages the main platform logo, favicon, name, homepage, contact details, footer and social links. **Policies & pages** manages privacy, terms, refunds, cancellation and contact pages; drafts stay private until published. Settings are stored centrally in `platform_settings`, and only authenticated platform administrators can change them. The initial migration copies the existing platform website settings and pages once, preserving later customizations.

Organizers retain **Your website & branding** and **Your policies & pages** for their own `/o/:slug` sites. These never overwrite the platform website. The original workspace can no longer edit global branding or pages. After saving, open pages refresh branding when focused; reload also picks up the saved settings.

Run `cd backend && npm run test:website` for disposable-database checks of platform permissions, logo upload, branding/social isolation, page publication and migration preservation. No existing website content or accounts are changed by the test.

### Event registration form builder

In an event workspace, open **Registration form**. Choose **Event default** or a ticket type in **Questions for**. Each type can inherit the event default or use separate questions. You can also open **Registration fields** directly from a ticket type. Every attendee answers the questions for their own ticket type; mixed bookings retain separate answers and files. Organization owners can add up to 40 questions, reorder them, set widths, require answers, configure choices and show questions based on an earlier choice. Supported fields include short/long text, email, phone, numbers with limits, dates, times, URLs, dropdowns, radio choices, multiple checkboxes, consent, file uploads and section descriptions. The booking contact is collected once. A required attendee name, required email/phone and extra answers are collected separately for every selected ticket.

Use **Save to organization** to create a reusable form; applying it to another event copies its questions without changing existing events. Turn on **Show at checkout** and save to activate a form. Preview accepts sample answers without creating a booking. **Responses** lists completed registrations and exports the current page as CSV. Full answers and private attachment downloads are also available in order details. Edits and removed fields do not change historical response snapshots.

Uploads accept PDF, PNG, JPEG or WebP content, up to 2 MB per file and three upload fields per form. Attachments are stored transactionally in the organizer database and served only through authenticated order routes; public booking lookup does not expose custom answers. Checkout validates the current saved form on the server before reserving tickets. Concurrent form edits and outdated checkout revisions are rejected instead of silently overwriting changes.

Run `npm run migrate:saas` to install the tables in existing workspaces. Run `npm run test:forms` and `npm run test:forms:integration` in `backend` for unit checks and disposable database tests.

### Organization event wallets

Organization owners can open **Finances → Event wallet**, or **View event wallet** from an event. Each event has its own booking balance, including archived events; the organization view combines those balances. Filter by event and payment type, browse paginated transaction history, and open the original booking from each entry. New bookings use INR. Select the historical USD currency filter to view older balances; currencies are never combined. Event package credits remain separate.

Paid bookings add their full order amount to `event_wallet_entries` in the same transaction as the order, tickets, inventory and notification. Confirmed gateway refunds create an opposite entry while retaining the original credit; historical demo cancellations remain accounting reversals. Pending orders create no entries. Unique order/type keys and locked order transitions prevent duplicate reversals. Monetary totals use integer cents during checkout and DECIMAL in the ledger. There is no public or admin endpoint for directly changing balances; wallet reads require the live organization-owner role and use that organization's database.

Live Razorpay captures appear under **Live payments**; Razorpay test captures, historical demos and other unverified records stay separate and cannot be withdrawn. Pending checkout never credits a wallet. The full gross booking amount is credited in the booking currency (INR for new bookings); gateway fees, settlement timing and currency conversion are not deducted automatically.

Migration `010_event_wallets.sql` imports existing **paid** orders once as opening credits; it excludes historical pending/cancelled/refunded orders because their collection history is not known. Run `npm run migrate:saas` before starting the updated server. Run `npm run test:wallet` in `backend` for disposable database checks covering precision, isolation, authorization, atomic rollback, concurrent reversals, opening import and pagination. No real payments or email are sent by the tests.


### Live event payments and withdrawal approval

1. In **Superadmin → Payment configuration**, save the Razorpay key ID, key secret and webhook secret. Match test/live mode to the key. New ticket prices and bookings use INR, as does package billing. Historical orders and pending checkout sessions retain USD. Existing numeric ticket prices are now interpreted as INR for new bookings; review prices before selling. No exchange-rate conversion of past balances is performed.
2. Register the displayed public HTTPS webhook (`/api/saas/razorpay/webhook`) for `payment.captured`, `order.paid`, `refund.processed` and `payment.dispute.created`. Localhost cannot receive provider webhooks. Credentials are encrypted; checkout receives only the public key. The current local workspace has no payment credentials, so paid checkout fails closed until configured.
3. Checkout reserves inventory for 15 minutes and persists the registration answers and ticket-design snapshot. It returns a pending order and opens Razorpay. Browser verification checks the signature, server-fetched captured payment, provider order, exact amount, currency and gateway account. Only then are tickets, the event-wallet credit and the organization's confirmation email committed together. Request references and unique provider IDs prevent repeated creation or fulfillment. Free bookings bypass charging but remain idempotent.
4. The backend reconciles outstanding payments every minute, recovering lost order responses by receipt and missed callbacks by provider lookup. Expired unpaid reservations release inventory. A captured payment arriving after inventory was released goes to **Superadmin → Booking payments** for refund review, with no ticket or wallet credit. Keep the backend running for expiration/reconciliation.
5. Organization owners request withdrawals from an event's available live balance in **Event wallet**. Bank details are encrypted and only masked account endings appear in lists. Pending and approved requests reserve funds; cancellation/rejection releases them. Pending gateway refunds also reduce available funds. Event-row locks serialize withdrawals, captures and refund accounting. Repeated requests and transfer references cannot double debit the ledger.
6. In **Superadmin → Payment configuration → Automatic bank payouts**, configure separate **live RazorpayX** keys, the platform funding account/customer identifier, and a payout webhook secret. Use a public HTTPS `/api/saas/razorpayx/webhook` endpoint; enable payout webhooks including `payout.processed`, `payout.failed`, and `payout.reversed`. Complete RazorpayX onboarding, allowlist the server IP, enable NEFT, and fund the account. Payment collections do not automatically fund RazorpayX; maintain sufficient settled funds plus provider fees/taxes. Enable automatic transfers only when this setup is ready.
7. In **Superadmin → Withdrawals**, **Approve & transfer** durably schedules and immediately submits an INR NEFT payout to the submitted Indian bank account/IFSC. Bank charges are paid by the platform, not subtracted from the requested amount. Requests below ₹1 or with unsupported bank details are rejected. Historical USD requests cannot be automatically paid as INR. The server retries/reconciles every minute with the same payout idempotency key and bank details; uncertain responses retain the hold. Bank `processed` confirmation atomically debits the event wallet once. Failed/rejected/cancelled transfers release the hold; a returned paid transfer adds a compensating wallet credit once. A new request is required after confirmed failure. Once dispatched, application approval cannot be cancelled or manually marked paid. **Check bank transfer** refreshes the provider state; RazorpayX may require its own dashboard approval if you have enabled its approval workflow. The account and webhook secret cannot be replaced while transfers still depend on them (including processed payouts that could be returned); API key secrets can be rotated within the same account. Disabling new approvals does not interrupt existing transfers.

8. For gateway bookings, owner cancellation/refund actions request a full provider refund with a stable `X-Refund-Idempotency` key. The wallet and tickets change only when the provider reports `processed`. A refund after a completed withdrawal may leave a visible negative balance; further requests are blocked. Partial refunds/disputes place the associated booking funds on review hold, require provider/platform review and are not automatically reconciled into this full-refund workflow.

Run `npm run migrate:saas` before starting the updated server. Migrations 011–013 and platform migrations 003–004 add reservations, request references, order currency and durable bank payout records. Run `npm run test:booking-payments` for isolated, mocked-provider coverage of capture verification, duplicate callbacks, cross-organization access, amount/currency mismatches, rollback, expiration/late capture, lost responses, encrypted bank details, withdrawal concurrency, payout retries/returns/failures, USD/INR separation and refunds. No real provider calls or bank transfers are made in these tests. Older design/demo suites use a test-only historical-order fixture; registration tests exercise real free checkout.

Provider references: [Standard checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/) and [idempotent refunds](https://github.com/razorpay/markdown-docs/blob/master/api/refunds/normal-refunds-idempotent.md).

Payout implementation follows the official [bank payout API](https://razorpay.com/docs/api/x/payouts/create/bank-account/) and [payout idempotency guidance](https://razorpay.com/docs/api/x/payout-idempotency/). Integration tests simulate the provider and never move money. Real payouts require merchant activation and a small live verification performed by an authorized operator after configuration.

### Organization-specific Orders view

Orders and dashboards exclude `mock` / `razorpay_test` records by default for every organizer. The explicit **Test & demo** order view remains available for intentional gateway testing. Live/free bookings retain matching filters and pagination; organization routing and JWT checks enforce database isolation. The dashboard reloads database totals every 15 seconds while visible and on focus, shows its last successful update time, and reports failed refreshes. `npm run test:wallet` covers real/test separation and tenant isolation.

### Attendees and individual tickets

Checkout collects the booking contact once, then a required name and required email/phone for each selected ticket. Event registration questions and uploads repeat for each attendee. Each attendee receives a distinct ticket and QR code after free booking or verified payment. Authorized check-in displays the attendee’s saved answers and contact details separately from the booking contact; a second check-in is rejected. Existing tickets keep their original names.

Run `node saas/migrate.js` from the backend to apply migration `014_ticket_attendees.sql` to the existing workspace and organizer databases. Attendee/payment integration checks: `node tests/attendees.integration.js`. Frontend checks: `node tests/checkout-attendees.mjs`.

Booking confirmations use the saved organization email template and SMTP sender. After confirmed payment (or a confirmed free booking), separate emails are queued for the booking contact and each distinct attendee email address. Repeated addresses receive one complete booking confirmation. Each delivery has its own status and retry action; duplicate payment callbacks do not create duplicate email jobs. Migration `015_booking_email_recipients.sql` preserves existing mail history.

Sample seeding is restricted to disposable integration-test database names. On 2026-10-15, the user-requested cleanup removed five sample events, nine mock orders, twenty tickets and related demo records from the existing workspace. A private, Git-ignored backup is retained under `backend/backups/`. Accounts, packages, event credits, branding and reusable templates were preserved.
