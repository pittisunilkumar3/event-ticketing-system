# TicketFlow source review — 23 October 2026

## Source baseline

Repository: https://github.com/pittisunilkumar3/event-ticketing-system

Reviewed baseline: `6def1da` (22 October 2026). Local workspace: `/Users/sunil/Desktop/tickect`.

Compared the deployed source under `/opt/ticketflow/app` with the repository by file contents, excluding dependencies, builds, secrets, uploads, private files and generated files. No new server-only source files were found. Application implementation files and shared configuration matched. The server copies of `backend/package.json`, two ticket-email tests and `deployment/README.md` were older subsets of the repository; two font license files and `walletRoutes.js` differed only in whitespace. Retained the newer repository versions rather than reverting them.

The live frontend index SHA-256 was `f3498ce494e9077b1872a4b9f2483a680b452c6a5fc6111da2bad5ecd02a13ad`, matching the 22 October deployment record. This checks the index, not every deployed bundle.

## Server and application map

- Public site: https://ticket.cinica.org. Read-only check returned HTTP 200.
- `ticketflow.service` and `ticketflow-db.service` were active. The loopback API on port 5017 returned its success response.
- Nginx serves the frontend and proxies the API. The dedicated MariaDB instance uses port 3317; deployment details are in `deployment/README.md`.
- Frontend: React 19, Vite and Tailwind. `frontend/src/pages` contains customer browsing, checkout and confirmation; `frontend/src/admin` contains organizer management and the ticket/email studio; `frontend/src/saas` contains platform administration.
- API: Express entry point `backend/server.js`, routes, controllers, models and services. `/api/platform` serves platform administration; `/api/o/:organizationSlug` scopes organizer requests.
- Tenancy: `backend/saas/tenancy.js` resolves organizations; `backend/config/db.js` uses AsyncLocalStorage to select their database pools. Platform and organizer migrations are separate.
- Booking/payment behavior lives in order controllers and the booking-payment, pricing, tax, coupon and wallet services. Razorpay webhook routes preserve raw request bodies for signature validation.
- Tickets share frontend rendering, shared JSON definitions and backend PDF generation. The frontend build also generates `backend/generated/ticketDocument.cjs`.
- Email, booking-payment and payout workers start with the API. Local development must use local configuration and isolated data.

## Local verification

Installed both dependency lockfiles. Frontend production build and ticket-PDF bundle build passed. All 88 backend unit tests passed with temporary localhost test servers. Ticket geometry and clipboard checks passed; layout checks rendered 100 current and 80 legacy designs.

The frontend build reported a large-bundle warning. Dependency installation reported one moderate backend vulnerability; dependency versions were not changed during this source review.

Production databases, credentials, attendee records, uploaded content and private attachments were not copied. No production service was restarted or application data changed. Database integration tests and a fully configured local booking environment were not established in this review. Follow the root README to create an isolated local database and environment before exercising booking, payment or mail workflows.

The code baseline was already on GitHub; this review adds documentation only, with no application behavior changes.
