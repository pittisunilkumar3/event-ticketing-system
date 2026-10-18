# Production deployment

Deployed 15 October 2026 to https://ticket.cinica.org on 177.7.49.2.
Superadmin: https://ticket.cinica.org/superadmin

## Server layout

- Application: `/opt/ticketflow/app`
- Dedicated Node.js 22.23.3 runtime: `/opt/ticketflow/runtime`
- API service: `ticketflow.service`, loopback port 5017
- Dedicated MariaDB service: `ticketflow-db.service`, loopback port 3317
- Database files: `/var/lib/ticketflow-db`
- Database socket: `/run/ticketflow-db/mysql.sock`
- Database configuration: `/etc/ticketflow/mariadb.cnf`
- App configuration: `/opt/ticketflow/app/backend/.env` (root:ticketflow, 0640)
- Uploads: `/opt/ticketflow/app/backend/uploads` (ticketflow owns this directory)
- Nginx site: `/www/server/panel/vhost/nginx/ticket.cinica.org.conf`
- Certificate: `/etc/letsencrypt/live/ticket.cinica.org/`

The existing server-wide database and other websites were not reconfigured.
The app's database user can manage `ticketflow_prod` and its `tf_` organizer databases on the dedicated instance. Organizer sites use `/o/{slug}`; wildcard DNS is not required.

## Credentials and configuration

Fresh database, JWT and encryption secrets were generated on the server. The initial superadmin login is stored in `/root/ticketflow-superadmin-credentials.json` with owner-only access. No production passwords are stored in this repository.

Public branding, policies, social links and the three configured event packages were imported. Sample events, bookings and old login accounts were not imported. The internal legacy workspace is a compatibility record, with no organizer login, events or orders.

SMTP credentials, Razorpay keys/webhook secrets and private customized email templates were not copied. Configure the production SMTP and payment settings in superadmin before accepting payments or sending mail. Built-in email templates are available. No live charge or email-send test was performed.

## Operations

```sh
systemctl status ticketflow ticketflow-db
journalctl -u ticketflow -n 100 --no-pager
systemctl restart ticketflow
/www/server/nginx/sbin/nginx -t
```

Both services are enabled at boot. Certbot has automatic renewal configured; the deploy hook reloads nginx after renewal. Keep the database, uploads and `.env` encryption key backed up together; losing the key prevents reading saved encrypted settings. No off-server backup destination has been configured.

Before replacing application files, take a database dump through the dedicated socket and preserve uploads and `.env`. Build the frontend locally; production serves the built files. When packaging on macOS, exclude resource-fork metadata:

```sh
COPYFILE_DISABLE=1 tar --no-xattrs -czf /tmp/ticketflow-release.tgz \
  --exclude=node_modules --exclude=.env --exclude=backups \
  --exclude=tests --exclude='*.log' --exclude='._*' \
  backend shared frontend/dist
```

Do not rerun `bootstrap-production.py` on an existing deployment or run the demo seeder in production. For updates, use the dedicated runtime and run `node saas/migrate.js` from the backend directory before restarting the API.

## Deployment verification

- Valid HTTPS certificate and HTTP-to-HTTPS redirect.
- Superadmin login verified in the live browser.
- Overview, settings, payment configuration, booking payments, withdrawals, website settings, pages, social links and packages APIs returned success.
- Pricing page shows Starter (3 events / INR 1,000), Growth (10 / INR 3,000), Business (25 / INR 10,000).
- Production contains zero events, zero orders, zero organizer logins and one new superadmin.
- API and database listen only on loopback.

These are deployment smoke checks; they do not establish that paid checkout, email delivery or every organizer workflow has been exercised in production.

## Domain update — 18 October 2026

The primary site is `ticket.cinica.org`. The previous `ticket.cinematicaexpo.com` redirects permanently with paths and query strings preserved. Keep its DNS and certificate renewal active for old links. Both names continue using the same application, accounts and database. Use the new domain for Razorpay webhook URLs and other provider callback settings; these external provider settings are not changed by nginx redirects.

Ticket-specific registration questions require tenant migration `016_ticket_registration_forms.sql`. Existing event questions remain the default until an owner saves separate questions for a ticket type. No historic booking snapshots are rewritten.

The 18 October ticket-fields release backup is `/root/ticketflow-backup-before-ticket-fields-20261018/` on the server (code, private database dump and previous redirect config). Tests passed in disposable databases: registration integration (6 scenarios), payment-flow regression (9 scenarios), registration unit tests and frontend attendee tests. Browser QA saved separate ticket questions and completed a mixed booking; production checks were read-only.

## Organizer-defined attendee fields — 18 October 2026

Registration forms can now define the attendee's full name, email and phone alongside other questions. Each field can be required, optional, conditional or removed independently per ticket type. New empty forms have no fixed attendee contact inputs. Existing saved legacy forms retain their checkout behavior until an organizer saves them through the updated editor, where their former contact fields are editable. The buyer's booking contact remains separate for receipts and payment recovery.

The first completed Full name / Email address / Phone number fields populate the attendee identity, ticket name and optional confirmation recipient. Missing names are labeled “Attendee 1”, etc.; missing attendee emails do not create mail recipients. Validation uses the saved form and visible answers, never client-supplied identity shortcuts. Form versions prevent stale checkouts; historical booking snapshots remain unchanged. The form limit is 43 fields to accommodate conversion of the previous 40-question form plus its three contact fields.

No schema migration or production form data rewrite is required. Rollback backup: `/root/ticketflow-backup-required-fields-20261018/` (previous deployed code/assets and private database dump). Verification: 6 unit tests, 7 registration integration scenarios, attendee/payment/mail regression, frontend rendering/payload assertions, production build, and a local browser booking with required name and optional attendee email/phone left empty. Browser fixtures use disposable databases, not the live organizer account.

## Pass-specific email templates — 18 October 2026

Organizers can create custom CKEditor email designs and choose one independently in each ticket type's **Confirmation email template** selector. An unassigned or inactive custom template falls back to the default booking confirmation. The buyer retains a booking receipt; an assigned custom email is generated separately for every issued ticket and goes to its attendee email, falling back to the buyer when omitted. Editing the default template to include attendee/ticket tokens also enables individual messages.

The editor includes a pass selector for registration-field insertion and sample previews. `{{ticket}}` inserts a personalized ticket block with a valid check-in QR; `{{ticket_qr}}` inserts only the QR; `{{registration_fields}}` inserts all saved answers. Individual fields use `{{field_<field-id>}}`. Subject/body substitutions are escaped, uploaded answers expose filenames only, and inline QR images use CID attachments. This is an email ticket block, not a PDF attachment or a rendering of the pass's print-layout design. Existing booking links still open the normal ticket view.

Migration `017_ticket_email_templates.sql` adds assignment/link columns and immutable email snapshots for reservations, issued tickets and outbox jobs. Payment completion copies the reservation snapshot; template edits after checkout do not change that booking's email. Delivery requires a paid booking. Existing per-recipient uniqueness and explicit retry behavior prevent duplicate enqueueing. Disabling a template before delivery stops queued messages for that template.

Deployed after backup to `/root/ticketflow-backup-ticket-emails-20261018/`, including the prior app, private database dump and previous challenge submission URLs. The supplied Google Form URL was saved to Challengers and Pro Challengers. No custom production template was created or assigned, no email was sent, and the event remains draft with all five passes off sale. Organization SMTP is disabled with no host configured; configure it before email delivery.

Validation: disposable database integration covered tenant isolation, mixed passes, separate guests sharing an address, optional attendee email fallback, dynamic field values, QR attachments, pending payments, repeated payment capture, saved snapshots, disabled-template fallback, edited defaults and explicit delivery retry. Transport and payment provider were simulated. Unit tests cover escaping and token validation; attendee/editor frontend checks and production build passed. Browser QA saved a custom template and a pass assignment and checked the live personalized preview. Production API checks verified both challenge field sets and previews without creating bookings; the new frontend assets return HTTP 200.

## Public event status refresh — 18 October 2026

The organizer event was correctly saved as published, but already-open public pages only fetched events when first mounted. Event home/list/detail pages now refresh on tab focus, visibility return, organizer-scoped cross-tab save notifications and every 30 seconds while visible. Event and ticket-type mutations emit notifications only after a successful save. Superseded requests are aborted and ignored; ticket detail refreshes preserve still-valid quantities and clear the event when it becomes unavailable. Public event API responses use `Cache-Control: no-store`.

Backup: `/root/ticketflow-backup-event-refresh-20261018/app-before.tgz`. No production event statuses, sales switches, bookings or credit balances were changed. Targeted refresh, existing site refresh and ticket-selection tests passed; the production build passed. The broader pre-existing customer-pages suite stops on an unrelated package-button assertion (`Buy Saved Starter` versus `Add 3 events`), so it is not counted as passing for this release.

Browser verification used a disposable API fixture: the same open homepage showed an event after publishing without navigation/reload, and an open detail page changed to unavailable after unpublishing. Live checks confirmed event 1 remains published, the event API is no-store, and the new build is served over HTTPS.

## Platform event catalog and live updates — 18 October 2026

The main `/events` page previously queried only the compatibility workspace database. It now lists published, unarchived events from active organizations using public card fields only, organizer-specific full-navigation links and composite card keys. Search/category/city filters apply across those databases; results are capped at 100, with up to four tenant reads in parallel. Organizer catalogs retain their existing tenant scope.

Public `/events/stream` endpoints send empty invalidation messages after successful organizer event/ticket-type mutations. The platform receives all notices; organizer sites receive their own. Browsers refetch immediately and reconnect automatically; focus and 30-second polling remain fallbacks. Stream responses disable nginx buffering and send 15-second heartbeats. Notifications are in-process for the current single Node service; a future multi-process deployment needs shared pub/sub. No schema or live event data change was needed.

Backup: `/root/ticketflow-backup-public-catalog-20261018/app-before.tgz`. Verification: catalog filtering/projection/link-collision tests, notification scoping/error/cleanup tests, browser refresh and link rendering tests, and frontend build passed. An isolated browser fixture confirmed published events appeared and disappeared immediately through the actual stream without navigation/reload. Live HTTPS checks verified the main listing, search, ₹999 minimum price, organizer destination and unbuffered stream handshake. The browser showed Cinematica Expo 2026 on the main catalog and its link opened the organizer event.

## Hide disabled ticket options — 18 October 2026

Public event responses now exclude inactive ticket types as well as archived ones. The ticket-options renderer also hides inactive/paused types defensively, and selection validation ignores them. Enabled scheduled and sold-out tickets retain their availability labels. Admin records, issued tickets and manually authored event descriptions are unchanged. Existing live update notices remove or restore public options after a sales switch is saved.

Backup: `/root/ticketflow-backup-hide-disabled-passes-20261018/app-before.tgz`. Isolated public API tests covered disabling/re-enabling and archived/scheduled/sold-out behavior; frontend rendering/selection tests and production build passed. Deployment verification compares public IDs against active admin types without changing production ticket data.

## Ticket editor link-field removal — 18 October 2026

Removed the custom-email instructional paragraph and the Submission form link / Guidelines link inputs from the ticket editor at the user's request. The confirmation email-template selector remains. Editor saves omit both URL properties so existing values are preserved; email rendering and saved links are unchanged pending the user's placement instructions. Ticket editor regression assertions and production build passed. Frontend-only backup: `/root/ticketflow-backup-ticket-editor-links-20261018/frontend-before.tgz`.

## Email fields and PDF attachments — 18 October 2026

The organizer email editor now has readable field buttons, pass-specific registration fields, inline ticket/QR previews, an optional personalized ticket PDF, and uploaded PDF attachments with an in-page PDF viewer. The ticket PDF checkbox or `{{ticket_pdf}}` token enables attendee-specific confirmation delivery; `{{ticket}}` inserts the inline ticket, and `{{attachments}}` lists attachment names. Uploaded PDFs are attached regardless of whether their names are inserted into the message. Save the custom template and assign it to the relevant pass.

Uploads are limited to three PDFs, 5 MB each and 10 MB combined. Private immutable files are stored under `backend/private/email-attachments/{organization-id}` and accessed only through authenticated tenant-scoped routes. Include this directory in ongoing backups, alongside the database and encryption key. Files remain available for queued booking snapshots when removed from a later template revision. The service permits writes to the private directory; Nginx serves `.mjs` PDF viewer workers with the JavaScript MIME type. No database migration is required.

Generated PDFs use a standard printable layout with organizer name, email accent color, attendee full name, event details, ticket code, QR and registration answers. They do not reproduce the separate visual ticket-design gallery layouts. The PDF preview is marked invalid for admission. PDFKit and an OFL-licensed Noto Sans font generate the attachment; PDF.js renders previews without relying on a browser PDF plugin.

Backup: `/root/ticketflow-backup-email-attachments-20261018/` (prior app, private database dump, service and Nginx config). Checks passed: 15 targeted unit tests; isolated mixed-pass booking/payment/email integration with captured mail, correct per-attendee ticket PDFs, uploaded bytes, immutable snapshots, retries, invalid-file rejection and cross-tenant access denial; production build; browser field insertion and both PDF preview types. Live login, seven Challenger registration fields, rendered preview and generated PDF passed. Production templates, pass assignments and event sales switches were not changed. No real emails were sent. Organizer SMTP remains disabled with no host configured.

## Selected ticket design in PDF — 18 October 2026

Supersedes the earlier standard PDF layout: both email ticket attachments and email-editor PDF previews now use the same `DesignedTicket` / `ComposedTicket` React components and CSS as issued tickets. Preview resolves the selected pass's active ticket design (or its default); delivery uses each issued ticket's immutable `design_snapshot`. Ticket layout, colors, branding, uploaded imagery, visibility settings, pass name, price and QR are retained. Preview QR codes remain invalid for admission. Existing bookings preserve their original designs when a pass is changed later.

`npm run build` in frontend now also builds the server renderer into `backend/generated/ticketDocument.cjs`; include this generated file in backend deployments. Runtime uses `puppeteer-core` plus packaged `@sparticuz/chromium`, embedded Inter / Plus Jakarta Sans fonts with their OFL licenses, and the shared frontend markup. Ubuntu requires `libnspr4` and `libnss3` (installed). Each render uses an isolated headless process, disables page scripts, blocks outbound resource requests, and embeds platform-uploaded images from local storage. Arbitrary external image URLs are not fetched. Local development can use `TICKET_PDF_CHROME_PATH`; macOS defaults to the installed Google Chrome binary. PDFKit is no longer required. The multipart PDF-upload handler explicitly restores authenticated organizer context after receiving a larger streamed file.

Backup: `/root/ticketflow-backup-selected-design-pdf-20261018/app-before.tgz`. Validation: 18 targeted unit tests, all 100 current plus 80 legacy ticket-rendering assertions, the mixed-pass payment/email integration with real PDF buffers and captured transport, and visual checks of horizontal / portrait generated PDFs. Integration checks distinct selected designs and preserved issued-design snapshots after reassignment. The renderer passed a staged test under the production service user, followed by live API generation for all five passes. No production designs, bookings, template assignments or sales switches were changed, and no real email was sent. All five passes currently have no custom ticket design assigned and therefore use the default classic layout.

## Visible attachment previews — 18 October 2026

The email preview now shows its attachment list above the message instead of beneath a tall iframe. Ticket PDFs and uploaded PDFs appear as separate named buttons with a count; clicking either opens its actual PDF. A template with no attachments explicitly says so. The list follows current edits immediately, including unsaved uploads/removals and the ticket-PDF token; the preview panel scrolls within shorter screens. The user's long-open browser tab was still running the pre-attachment editor; it was refreshed to the current release. Existing saved templates had no attachments or ticket-PDF flag enabled, and no custom template was saved.

Backup: `/root/ticketflow-backup-attachment-preview-20261018/frontend-before.tgz`. The attachment preview component checks, production build, isolated mixed-pass email integration and browser checks passed. Browser QA verified a ticket PDF and uploaded Guidelines.pdf together in the list and opened both. No production attachment was invented/uploaded and no emails were sent.

## Uploaded PDFs on default booking emails — 18 October 2026

Booking confirmed, cancelled and refunded retain PDF upload/remove/preview controls and their attachment list. Ticket-PDF controls and inline ticket/QR insertion buttons are now shown only for custom templates; default empty-state copy points to file upload. Existing template content and attachments are preserved. Fixed the test-email endpoint to generate an inline QR attachment only when the message actually contains a ticket/QR token, matching automatic delivery.

Backup: `/root/ticketflow-backup-default-email-files-20261018/app-before.tgz`. All three default templates passed isolated upload/save/preview/test-send and automatic delivery tests, asserting exactly the uploaded PDF bytes and no generated ticket PDF or QR file. The full mixed-pass payment/email integration, attachment-preview checks and production build passed. No live templates or files were changed and no real emails were sent.

## Ticket PDF for default confirmation — 18 October 2026

Booking confirmed now exposes the ticket-PDF checkbox, actual-design preview and ticket/QR insert fields alongside file uploads. Custom templates retain the same controls; cancellation and refund templates retain uploads only. Enabled the saved Cincathon Expo booking-confirmed template's ticket-PDF option at the user's request. Existing per-pass custom-template assignments remain authoritative. Each attendee using the default confirmation gets a personalized PDF; the buyer also receives the separate booking receipt. SMTP still must be enabled for delivery.

Backup: `/root/ticketflow-backup-confirmation-ticket-pdf-20261018/frontend-before.tgz`. Full isolated email/payment integration passed, including a default confirmation with both uploaded PDF bytes and the attendee's selected-design PDF, plus the separate buyer receipt. Unit checks, attachment preview checks and production build passed. No real emails were sent.

## Registration input hints — 18 October 2026

Registration text, name, email, phone, number, URL and multiline fields now show an automatic placeholder when no custom placeholder is configured. Dropdowns use a field-specific empty prompt. Optional defaults include “(optional)”; organizer-authored placeholders remain authoritative. The same renderer serves checkout and organizer form previews. Legacy attendee contact inputs also gain hints. Visible labels, required attributes, help text, saved forms and answers remain unchanged. Native date/time/file and choice controls retain their native guidance.

Backup: `/root/ticketflow-backup-input-hints-20261018/frontend-before.tgz`. Checkout rendering/payload tests passed, including default hints, custom overrides, required/optional controls and dropdown prompts. Production build passed; public Explorer checkout visually verified after deployment. No booking was created.

## Shared platform event links — 18 October 2026

Fixed `/events/cinematica-expo-2026` returning “Event not found” on the main platform while the organizer event was published. The platform detail endpoint now resolves a unique published, unarchived event from active organizers when there is no published compatibility-workspace match. Every ticket and registration-form read runs in the resolved organizer database. Ambiguous cross-organizer slugs return a choice-directed error instead of selecting an arbitrary organizer; existing scoped catalog links remain unambiguous.

Platform event pages retain the main website presentation. Continue to booking opens the owning organizer's checkout with all selected quantities, and direct platform checkout links resolve to the same scoped checkout before rendering a booking form. Organizer event pages and checkout remain scoped to their own account. There are no booking, payment, event-content or schema changes.

Backup: `/root/ticketflow-backup-platform-event-link-20261018/` contains the previous routing files, frontend build and private database dump. Only the two changed backend files and rebuilt frontend assets/index were deployed; previous hashed assets were retained for existing browser tabs. Regression tests passed for platform resolution, matching organizer details, form/ticket isolation, disabled passes, missing/draft/archived/suspended events, duplicate slugs and legacy URL precedence. Frontend ticket-selection and checkout-destination tests and production build passed. Live API equality checks and browser verification passed: the platform event opens, selecting two Explorer and one Creators pass reaches the organizer's three attendee forms, and the organizer event also reaches checkout. Online payment remains unavailable in the current live configuration; no production booking, email or charge was created during verification.

## Attendee-only checkout and organizer booking details — 18 October 2026

Removed the separate Booking contact inputs, their copy-to-attendee button and unused styles. Checkout now posts `contact_source: attendee`; the server derives the order contact from the first validated attendee with an email, falling back to the first attendee when no email was collected. Identity comes from the organizer's saved form definitions and submitted answers inside the booking transaction, never client-supplied summary fields. Each attendee retains their own name, contacts, answers, uploads and ticket snapshot. Optional or uncollected contacts remain blank; no recipient is invented and personal email jobs without an address are explicitly skipped. Older clients using separate contacts retain compatibility.

The organizer booking detail now labels the summary Contact details, opens each attendee's saved registration answers by default, and includes phone numbers for pending attendees. Existing orders are not rewritten. Tenant scoping and attachment authorization remain unchanged.

Backup: `/root/ticketflow-backup-attendee-checkout-20261018/app-before.tgz`. Registration integration passed 8 scenarios, including attendee-only bookings, forged summary identity rejection, optional contacts, historical answers, stale forms and cross-organizer denial. The expanded suite waits for the normal booking rate window rather than weakening production limits. Mixed-pass payment/email integration passed, including attendee-derived contacts through reservation/capture, ticket PDFs, uploads and absent-email handling. Frontend checkout/order rendering and payload checks, required-field unit tests and production build passed. Browser QA checked saved individual contacts and expanded answers using disposable local data; live checkout shows only pass-specific attendee inputs. Test fixtures were cleaned up; no production booking or real email was created.

## Organizer event URL — 18 October 2026

The event workspace displays the full organizer-scoped public event URL beneath event actions. Copy link provides success/error feedback; Open event uses the same URL for published, unarchived events. Draft/hidden events retain a shareable address with a publication notice. URLs use the current origin and existing tenant route prefix, and wrap on narrow screens.

Backup: `/root/ticketflow-backup-event-url-20261018/frontend-before.tgz`. Frontend build and diff checks passed. Live browser verified the full Cincathon Expo event URL, successful copy feedback and the correct public event destination. No event data, sales switches or bookings changed.

## Organization website URL on dashboard — 18 October 2026

Each organizer dashboard now displays its full website address below the heading, with Copy link and Open website actions. The address uses the active organization's route prefix and current origin, matching the existing website navigation. URLs wrap on narrow screens; clipboard failures offer manual copying.

Backup: `/root/ticketflow-backup-dashboard-url-20261018/frontend-before.tgz`. Production build and diff checks passed. URL checks covered two distinct organizer slugs and the default host. Live Cincathon Expo dashboard displays its correct website URL and successful clipboard feedback. No database changes.

## Public experience section layout — 18 October 2026

Replaced the narrow plain-text description with full-width structured reading: numbered pass-and-price headings become individual cards, bullet benefits and exclusions become semantic lists, and the saved VIP dinner section receives a distinct panel. Desktop uses two columns; widths below 800px stack cards. Ordinary organizer descriptions remain text paragraphs, and all content is escaped by React. The renderer uses the saved description without changing event content, ticket prices, availability, or bookings.

Backup: `/root/ticketflow-backup-experience-layout-20261018/frontend-before.tgz`. Description rendering checks passed for saved headings, bullets, exclusions, dinner content, ordinary text and HTML escaping. Production build passed. Live browser verified all five Cinematica pass sections and the VIP dinner highlight. Screenshots: `event-experience-cards-live.png` and `event-experience-vip-live.png`.

## Per-event public page themes — 18 October 2026

Added Classic, Cinema, Poster and Editorial themes to Create/Edit event. The visual selector uses the current event banner/title, and full-page previews render the same EventPageView component as the public site, with booking interactions disabled. Use this theme updates the form selection; Save event persists it. Previewing never updates production content. Classic preserves the existing layout; Cinema uses dark/gold colors, Poster shows the complete banner above the details, and Editorial uses a split cover and serif headlines. Responsive rules retain usable cards and booking controls. Event emails and issued-ticket designs are separate.

Migration `018_event_themes.sql` adds `events.page_theme` with Classic as the default. Applied to the platform compatibility workspace and existing active/suspended organizers; new organizers receive it through normal provisioning. Backend validates theme IDs using shared/eventThemes.json, persists them per event and exposes them through existing scoped/public APIs. Partial updates retain the selection. Admin event detail includes the same availability fields as the public route for accurate previews. Existing event-content notifications refresh the selected public layout after saving.

Backup: `/root/ticketflow-backup-event-themes-20261018/app-before.tgz` plus private per-database event snapshots. All four themes passed disposable API tests for defaults, creation, update/reload, public/platform readback, invalid values, authentication, organizer isolation and unchanged ticket availability. Shared renderer tests passed for actual event content, cart totals, hidden tickets and unknown-theme fallback; description and ticket-editor checks and production build passed. Live browser verified Cinema, Editorial and Poster previews, selection via Use this theme, dismissal and Classic remaining saved after reload. No live theme was changed on the user's behalf, bookings created or emails sent. Temporary test databases were cleaned up and the test database service stopped.

## Six additional event themes — 18 October 2026

Added Aurora, Summit, Festival, Gala, Blueprint and Gallery, bringing the shared theme catalog to ten. New styles include centered purple covers, a blue split layout, coral/lilac festival styling, an ivory framed banner, navy/cyan technical styling and a white artwork-focused layout. Each has a matching gallery thumbnail and uses the existing full-page preview and per-event save flow. Existing selections remain unchanged. No schema migration was needed; the API was restarted to load the expanded validation catalog.

Backup: `/root/ticketflow-backup-more-themes-20261018/app-before.tgz`. All ten themes passed shared-renderer and isolated API persistence/public/isolation checks with unchanged ticket data. Production build passed. All six new previews were visually checked using the live event banner and content; no production selection was saved. Test databases were cleaned up and the isolated database service stopped. Preview screenshot: `event-theme-festival-preview.png`.

## Premiere event composition — 18 October 2026

Added Premiere as a new first gallery choice while retaining all ten existing themes in their original relative order. It uses a dedicated shared public/preview hero: full uncropped event artwork beside the headline, an availability-aware pass link, saved starting price and a date/venue/organizer strip. The body has two-column pass cards, a contrasting booking summary and full-width visit details. Narrow layouts stack the hero, cards and facts; absent artwork and unavailable tickets have honest fallbacks. Existing theme markup and selections remain unchanged.

Backup: `/root/ticketflow-backup-premiere-theme-20261018/app-before.tgz`. Shared-renderer tests cover all eleven themes, unchanged old theme IDs, actual event/ticket content, no-art/no-sale fallbacks and cart totals. Isolated API tests passed saving and reading all themes across organizer and public routes, with invalid-input rejection and tenant isolation. Production build passed. Live preview visually verified the complete Cinematica banner, actual event metadata, pass cards and booking panel. No live event theme was selected or saved; no bookings or messages were created. Test databases cleaned up and isolated server stopped. Screenshots: `premiere-event-theme-live.png`, `premiere-ticket-cards-live.png`.

## Four showcase event themes — 18 October 2026

Added Marquee, Atelier, Horizon and Pulse, bringing the catalog to fifteen while preserving all eleven previous IDs and their relative order. A shared ShowcaseHero renders real event metadata and availability-aware links in four compositions: oversized orange masthead with side guide, burgundy framed invitation, centered blue artwork cover with inset details, and lime poster grid. Each has coordinated pass styling and a matching admin thumbnail. Missing artwork and unavailable tickets use explicit fallbacks; responsive rules stack the layouts. Horizon reserves space beneath the image so its details panel never covers banner content.

Backup: `/root/ticketflow-backup-showcase-themes-20261018/app-before.tgz`. All fifteen themes passed renderer and disposable API persistence/public-route/isolation checks, preserving actual ticket availability and cart totals. Production build passed. Live previews visually checked all four themes with Cinematica's saved banner and content, plus Pulse ticket controls. Classic remained the saved selection; no live event was updated, bookings created or emails sent. Temporary databases cleaned up and isolated database service stopped. Screenshots: `event-theme-marquee-live.png`, `event-theme-atelier-live.png`, `event-theme-horizon-live.png`, `event-theme-pulse-live.png`.

## Checkout follows the event theme — 18 October 2026

Checkout now resolves the saved event theme from the same shared catalog as the public event page. Extracted the fourteen non-Classic palettes into eventThemeTokens.css so both pages share colors. Added checkout-specific styles for headings, attendee inputs and placeholders, focus indicators, cards, payment controls and the booking summary across all fifteen choices; Classic retains its original appearance. Event banner images remain fully visible. The existing event-change stream and focus/polling refresh update only the theme while checkout is open, preserving form definitions, entered attendee values, cart and pending payment data.

Backup: `/root/ticketflow-backup-checkout-theme-20261018/app-before.tgz`. Checkout-theme tests cover all fifteen choices, unknown-theme fallback, required fields, saved values, totals, theme-only refresh and pending-payment actions. Existing attendee and event-theme tests and the production build passed. Targeted lint reported only existing effect/dependency warnings. Live browser verified Cinema styling, editable attendee inputs, placeholders, full banner, and the Explorer Pass total of INR 999; entered text remained after background refresh. No production booking, payment or theme change was submitted. Screenshot: `checkout-cinema-theme-live.png`.

## Organizer SMTP and complete email-template checks — 18 October 2026

Configured Cincathon Expo's supplied Gmail SMTP account using port 465 with TLS/SSL and encrypted password storage. Verified authentication before enabling organizer delivery. Platform SMTP settings were not changed.

On explicit request, sent 22 marked test messages to the user's designated recipient: one SMTP test, three saved booking notifications, five unsaved custom drafts (one per pass), and thirteen entries from the older email library. All 22 were accepted by the SMTP server; no send failed. Confirmed-booking preview generated a ticket PDF. Each custom draft exercised pass registration placeholders, inline ticket QR, generated ticket PDF and an uploaded test PDF. Preview PDFs passed signature/size checks. No custom template or pass assignment was saved, no booking/payment was created, and the temporary uploaded test PDF was removed. Saved Studio templates were identical before and after. SMTP acceptance does not independently confirm inbox placement.

Found and fixed older-library test sends that left subject placeholders unresolved and lacked a test prefix. Subject fields now resolve, subjects are prefixed [TEST], recipients are validated, and errors refer to organizer SMTP settings. Focused email-library and SMTP tests passed (5 tests). Backup: `/root/ticketflow-backup-email-test-20261018/emailTemplateController.js`. Detailed private server report: `/root/ticketflow-email-delivery-check-20261018.json`.

## Cinematica Expo organizer name and address correction — 18 October 2026

Renamed live organizer ID 2 from Cincathon Expo (`cincathon-expo`) to Cinematica Expo (`cinematica-expo`). Its canonical website is https://ticket.cinica.org/o/cinematica-expo. The existing event already has the correct title, Cinematica Expo 2026, and keeps its `cinematica-expo-2026` slug. Updated organizer website title/company name/site URL, SMTP display name, and the 100 ticket design brand labels that exactly matched the old organizer name. Organizer ID, database, login credentials, SMTP credentials, five passes, and remaining two event credits are unchanged.

Live Nginx now returns 308 redirects from `/o/cincathon-expo` and `/api/o/cincathon-expo` to the corresponding new paths, preserving suffixes, query strings and HTTP methods. Keep these redirects in future server configuration updates. Existing `/uploads/cincathon-expo/` asset paths remain valid and are deliberately not renamed. Server-only backup of changed database rows and prior Nginx configuration: `/root/ticketflow-backup-organizer-rename-2026-10-18T16-40-39-015Z/`. An `organization.renamed` audit entry records the correction.

Validation: Nginx configuration check and reload passed; old home/admin/checkout/API redirects preserve destinations and query strings; login through the old API path resolves the renamed workspace; authenticated branding/SMTP readback, public event/title, logo and favicon checks passed. No booking or email was created.

Browser verification also found the event's independent `organizer_name` still contained Cincathon Expo. Backed up that field to `event-organizer-before.json` in the same server backup directory and corrected it to Cinematica Expo, so the public “Curated by” section matches the organizer branding.

## Public business and policy pages — 18 October 2026

Published eight database-backed pages on the main domain and Cinematica Expo organizer site: About Us, Tickets & Pricing, Privacy Policy, Terms & Conditions, Refund Policy, Cancellation Policy, Contact Us and Ticket Delivery. Replaced the organizer's one-line placeholder privacy text and the previously empty platform pages. Source copy: `deployment/content/cinematica-pages.cjs`; subsequent edits belong in the corresponding superadmin/organizer policy editor, not in frontend constants.

The owner confirmed CINICA Creators Council, its T-Hub office address and info@cinica.org as public business/support details, and delegated refund wording. Published attendee-ticket terms allow full refunds for unused tickets cancelled before event start, organizer cancellations and qualifying rescheduling requests. Review target is five working days, initiation within five working days after approval, then normally 7–10 working days for the bank/provider. These are merchant operating commitments; Razorpay does not dictate the cancellation deadline. Organizer event-credit packages are explicitly separate. No payment, refund, booking or email was performed by this release.

Added About Us, Tickets & Pricing and Ticket Delivery to the existing supported-page catalogue. Platform page reads/saves merge missing default page types into older installations without overwriting saved content or publishing blank pages. Existing CKEditor, footer links, checkout page links and email link controls continue using their existing database-backed workflow. Root branding identifies CINICA Creators Council; organizer branding remains Cinematica Expo with the operator in its footer. No support phone was supplied, so none was invented.

Also applied owner-confirmed banner details to event 1: 12–13 December 2026, T-Hub, Hyderabad, India. The banner supplies no clock times, so existing start 06:00 and end 18:00 were retained and explicitly reported to the owner as requiring confirmation.

Server backup: `/root/ticketflow-backup-public-policies-20261018/` (previous two backend files, changed policy/brand rows, and event row). Deployed only the two backend files and content source, then restarted `ticketflow`. Tests: isolated platform website integration, including missing-page upgrade, draft/publish/unpublish, sanitization and tenant isolation; all 12 studio unit tests; live readback of all 16 public pages, scoped internal links, brand/address/email and organizer editor visibility. Browser verified public privacy text, footer navigation and organizer contact information. Isolated test database stopped. Razorpay browser status after publication: **Under review**, estimated update **24–48 hours**, not approved yet. Normal refund timing reference: https://razorpay.com/docs/payments/refunds/normal/ (checked 18 October 2026).

## Platform versus event policy separation — 18 October 2026

Corrected the preceding release's content scope: although storage and authorization were separate, the same event-oriented copy had been published to both sites. Platform copy now comes from `deployment/content/platform-pages.cjs`; Cinematica Expo copy comes from `deployment/content/cinematica-pages.cjs`, which rejects non-organizer paths to prevent accidental root publication. All eight pairs of public documents now differ.

Root pages cover the ticketing platform, organizer accounts, event-credit packages, software delivery, platform privacy and billing support. Organizer pages cover Cinematica Expo attendee data, ticket terms, cancellation/refunds and delivery. Event pricing no longer includes organizer package marketing. Titles make the distinction explicit (Platform Privacy Policy versus Event Privacy Policy). Existing event refund entitlements are preserved; no new universal attendee refund rule is imposed by the platform. Platform copy does not invent a package refund eligibility window: it directs package requests to the original purchase terms and support. Root site title/description/hero/footer identify the platform rather than a single event; the confirmed legal operator/contact details remain.

Server backup: `/root/ticketflow-backup-policy-separation-2026-10-18T17-32-05-104Z/before.json`. Changed platform website pages/brand and five Cinematica Expo page rows only. No backend logic, frontend bundle, other organizer, booking, payment or event schedule was changed. Validation: all eight page pairs differ; public links remain within their respective scope; organizer editor returns event pages; the organizer token receives 403 from platform policy management. Existing policy integration tests from the preceding release also cover independent draft/publish/unpublish and tenant isolation.

## Organizer mobile layout and public loading — 18 October 2026

Investigated the owner's 360px-wide phone screenshots. The header wrapped into two rows inside a fixed 70px height, while global public-page rules truncated the organizer name. Organizer headers now use a natural two-row height on mobile, keep the full name, and align navigation within the border. Reduced mobile hero type/spacing so upcoming events appear sooner. Desktop layouts remain intact.

Removed two loading delays: initial public event data now starts alongside branding and is consumed once (subsequent updates always fetch fresh data), and the first SSE ready notification no longer aborts/restarts the already-running request. Reconnects and change events still refresh. Public startup requests have a 15-second timeout with existing retry UI. Platform administration, signup and ticket confirmation renderers are lazy-loaded. Entry CSS decreased from about 224 KB to 151 KB raw; frontend production build passed.

Optimized this organizer's existing 1920px logo/favicon into 192px/48px PNG derivatives. Combined size fell from 2,464,536 bytes to 32,408 bytes (98.7% smaller). Original uploads are retained. Only organization ID 2 brand.logo and brand.favicon paths changed, guarded against concurrent user changes. New assets are under uploads/cincathon-expo/{logo,favicon}-web-20261018.png. No event, policy, ticket availability, SMTP or payment data changed.

Backup: /root/ticketflow-backup-public-mobile-20261018/frontend-before.tgz and brand-before.json. Published frontend source/dist only plus two optimized assets; retained old hashed assets for open tabs; no backend restart needed. Live entry: index-CUTQr-QA.js, index-CFBci5p-.css.

Validation: public-startup tests cover one-time request sharing, fresh updates, event/checkout routes, cancellation, error/retry, expiry, public-only scope and timeout; event/site refresh tests passed, including initial-ready suppression and reconnect refresh; all 15 event and checkout theme tests passed. Live browser verified full organizer name and non-overlapping header at 360x640, mobile footer/logo, desktop homepage, live event card, event selection and checkout fields/INR 999 total. No booking or email submitted. Mobile evidence: organizer-mobile-fixed.png. Cold-load speed on the owner's cellular network was not independently measured.

## Further public-page performance improvements — 18 October 2026

Added route-level loading for homepage, event listing/detail, checkout, booking lookup and policy pages. The current route's chunk starts immediately alongside branding, with a local Suspense boundary retaining the header/footer during navigation. Shared entry CSS fell from 151,470 to approximately 81,990 bytes (46% smaller); page styles download only where needed. Initial React/core JavaScript is approximately 327 KB raw plus the selected route instead of 390 KB for all public flows.

A small inline, dependency-free startup script starts site-settings and the initial published event GET during HTML parsing, before React downloads. It is inserted after charset/viewport metadata. Requests are explicitly public-only, omit credentials, bypass response caching, expire after 15 seconds, and are consumed once only when their organizer API scope matches. Existing refreshes fetch fresh data; registration/checkout authorization and validation remain server-side. Admin, signup, confirmation and unknown paths do not prefetch. The test suite covers scope isolation, no credentials/cache, duplicate prevention and fresh subsequent requests.

Self-hosted the existing Inter and Plus Jakarta Sans variable WOFF2 subsets, retaining font-display:swap and their OFL licenses under src/assets/fonts. Removed the page-level Google Fonts CSS dependency. Optimized event 1's original 1200x630 PNG (510,377 bytes) to WebP (72,102 bytes, 86% smaller), visually inspected the complete banner, and changed only banner_image with an expected-old-path guard. Original image retained. Versioned optimized logo/favicon/banner assets now carry one-year immutable client caching; API data is not cached by these rules.

Backup: /root/ticketflow-backup-fast-loading-20261018/{frontend-before.tgz,nginx-before.conf,event-before.json}. Frontend deployed with old hashed assets retained. Nginx configuration test/reload passed; backend did not restart. Current entry index-C3A38SRJ.js and index-BDWG6alk.css. Verified live WebP/fonts return HTTP 200 with expected sizes/cache headers, correct event readback, and checkout rendering with saved attendee fields/INR 999 total. Production build, early-data/public-startup tests, event/site refresh tests, all 15 event/checkout theme tests and diff whitespace check passed; targeted lint reported three existing context-export/effect dependency warnings. No booking, payment or email was submitted. Evidence: checkout-fast-loading-live.png. Byte-size reductions are measured; actual cellular load time depends on the visitor's network/device.

## Shared Razorpay test account — 18 October 2026

At the owner's explicit direction, configured the supplied Razorpay TEST account centrally for all ticket bookings and organizer event-package purchases. Validated credentials with a read-only Razorpay orders request before saving, then authenticated again from the production server after encrypted readback. Used paymentSettings.save so existing payment locks, validation and audit logging apply. No live mode, real charge, booking, payment order or email was created. Private backup: /root/ticketflow-backup-razorpay-test-20261018/payment-before.json. Secrets are encrypted in platform_settings and intentionally omitted from this record. Razorpay webhook secret/subscription is still unconfigured; API authentication alone does not verify webhook delivery or a complete checkout payment.

## Cinematica email logo and banner — 18 October 2026

Added the saved organizer logo and event banner to the three existing automated email designs (booking confirmed, cancelled and refunded). Each was previously layout 2 with blank imagery; selected existing layout 8 (banner first, logo, message) so both images actually render, rather than setting an unused banner field. Preserved message copy, subject, active status, links, attachments and ticket-PDF settings. Confirmation retains attach_ticket_pdf=true; cancellation/refund do not attach tickets. No custom saved email designs existed at this time.

Logo uses the saved 192px PNG. Created an email-compatible 1200x630 JPEG derivative of the original banner (177,200 bytes), uploaded at /uploads/cincathon-expo/banner-email-20261018.jpg. Original and website WebP remain intact. Updated only organization ID 2 design_templates rows 1–3 within a transaction, with inventory and old-image/layout guards. Private backup and generated previews: /root/ticketflow-backup-email-brand-20261018/. Verified saved JSON readback and exactly one logo/banner in each rendered email. Banner HTTP 200; visually checked the booking template using sample preview values. Screenshot: email-logo-banner-preview.png. No email sent, booking created, application code changed or service restarted.

## Email preview refresh and organizer logo removal — 18 October 2026

Confirmed the owner had cleared confirmation.logo, but renderEmail's automatic website-logo fallback brought it back. Added optional show_logo state preserved by validation and respected by the renderer. Removing an image now clears logo and sets show_logo=false; uploading a replacement re-enables it. Older templates without the flag keep their existing behavior. New custom drafts inherit an explicitly disabled logo from the organization's confirmation template.

Updated only Cinematica Expo's three saved email configs to logo='' and show_logo=false; retained current copy/layout, banner, active state, PDF attachments and website branding. Superadmin and other organizers' rows were not updated. Private backup: /root/ticketflow-backup-email-preview-20261018/{app-before.tgz,templates-before.json}.

Preview endpoint optionally returns all eleven layouts using the canonical server renderer; format selection uses these returned layouts immediately without another request. Other edits refresh after 150ms instead of 400ms. Added a 15-second request timeout, explicit aborted-response checks, and template/pass context matching so old responses cannot overwrite newer drafts or show a different template's preview. Preview/save never sends email.

Validation: all 13 studio unit tests plus a new preview-endpoint test passed; frontend preview tests cover debounce, immediate layout selection, stale/cancelled responses, timeout, failure and cleanup; production build passed. Isolated browser editor using the actual React component, CKEditor and renderer verified unsaved title/source-body changes and switching format 8 to 1. Evidence: email-preview-live-edit-check.png. Private credential transfer for a live editor login was blocked by automatic approval review; no credentials were copied, and verification used the isolated editor plus production database/renderer readback instead. Production readback confirmed zero rendered logos in all three saved designs, retained banners and confirmation ticket PDF, and unchanged website logo. Backend restarted successfully. Targeted lint reported two existing effect-state warnings. No email, booking or payment was created.


## Checkout payment readiness — 19 October 2026

Diagnosed the public checkout block: central test API credentials are saved but has_webhook_secret=false. Confirmed the Razorpay Test dashboard has no webhook configured. Prepared https://ticket.cinica.org/api/saas/razorpay/webhook with payment.captured, order.paid, refund.processed and payment.dispute.created in the existing browser; creation is pending owner secret entry/submission. The same secret must be saved in superadmin Payment configuration. No dummy secret, bypass, test booking or charge was created.

Fixed checkout background refresh to adopt current payment availability while preserving event/form/ticket snapshots and separately held attendee input/pending reservations. Regression covers enable/disable changes and all 15 themes; content-refresh tests and production build pass. Published frontend with backup /root/ticketflow-backup-checkout-payment-20261019/frontend-before.tgz; service remains active. Payment checkout remains blocked until real webhook configuration is completed.


## Booking confirmation PDF and logo correction — 19 October 2026

The buyer receipt previously replaced the saved default confirmation with studioDefaults.email whenever PDF attachment was enabled. This dropped attachments and show_logo=false, restoring the website logo. Preserved the receipt configuration; personal-only body tokens still use booking-level copy while retaining branding, uploaded files, and PDF settings. PDF attachment building now supports all recipient-scoped tickets with their immutable selected-design snapshots, and deduplicates codes. Merely selecting PDF attachment (or ticket_pdf token) no longer creates a separate default personal message to the same address. Assigned custom emails keep their per-ticket delivery behavior.

All 16 ticket email/studio unit tests and the complete disposable-tenant ticketEmails integration suite pass, including actual PDF generation, two-ticket single-email delivery, uploaded files, custom templates, tenant isolation, pre-payment no-send and capture idempotency. Published the three service files; service active. Backup: /root/ticketflow-backup-confirmation-pdf-20261019/. Set logo empty and show_logo=false on Cinematica organization 2's four saved email designs; confirmation retains attach_ticket_pdf=true. Superadmin and other organizers remain unchanged. Existing sent mail and issued-ticket snapshots remain historical. No corrected email was sent automatically.


## Separate payment-success and ticket emails — 19 October 2026

Replaced the extra generic buyer booking confirmation with a separate editable organizer payment_successful template. Verified capture enqueues exactly one payment receipt for the buyer plus the pass-selected ticket emails, within the same transaction and existing idempotency checks. Default pass emails are grouped by attendee address; custom/personal templates remain per ticket. Custom assignments do not also receive the default confirmation. Free registrations only send ticket emails. Missing attendee email falls back to the booking contact where provided.

Added Payment successful to organizer Booking notifications with editable CKEditor content, preview and existing PDF-upload/test controls; default is logo-free and has no ticket PDF, since ticket attachments remain in the selected pass email. Existing default confirmation remains available as the default ticket email. Updated the ticket selector and editor help to explain these responsibilities. Lazy template initialization preserves saved configurations; explicitly seeded the missing template for Cinematica org 2. No existing emails resent, real payments made, or bookings created.

Validation: all 16 unit tests and disposable-tenant ticket-email integration suite passed. Verified mixed pass templates, no sends before capture, one payment receipt with matching total, no duplicate jobs after concurrent captures, editable payment template preview, PDF designs/uploads, hidden logo, default fallback and recipient scoping. Frontend build passed. Published with backup /root/ticketflow-backup-payment-email-20261019/app-before.tgz.

### 2026-10-19 — Email delivery matches the selected design

Removed the automatically appended booking summary, attendee-ticket table and duplicate booking link from `emailRenderer`; removed the delivery-only flag from `mailer`. Default and custom emails now render the same selected layout as the editor preview. Explicit layout 6/9 summaries, configured footer, placeholders and PDF attachments remain intact.

Verified 18 unit/preview tests and the disposable tenant payment-email integration suite. Deployed the two service files, backed up under `/root/ticketflow-backup-email-design-20261019`, and restarted `ticketflow` successfully. Live render of test booking TKT-651DAA57 matched preview HTML exactly, contained no appended section or logo, and generated a valid 222287-byte ticket PDF; no additional email sent. All five Cinematica passes currently select the default Booking confirmed email; custom template 4537 is unassigned. Existing sent emails are unchanged.

### 2026-10-19 — Remove automatic order tables from every organizer email layout

Removed the remaining built-in order tables from formats 6 and 9 (including Payment successful), and updated their editor labels. Explicitly authored body tables and field placeholders remain supported. Formats 5/6 retain their saved IDs with equivalent message-only layouts. All 19 unit/preview tests, the disposable booking/payment-email integration suite and frontend production build passed.

Deployed renderer and frontend with backup `/root/ticketflow-backup-no-email-table-20261019/before.tgz`; service active. Live readback verified all five Cinematica email templates contain no automatic booking table. Completed new test booking TKT-AF7659AD (Explorer Pass, INR 999) through Razorpay test netbanking after cancelling a stalled test-card OTP attempt; captured=true. Both `Payment successful: TKT-AF7659AD` and `Booking confirmed: TKT-AF7659AD` sent once to the authorized test recipient, with no auto table or logo; ticket email retains its PDF attachment. Evidence: no-table-payment-confirmed.png. No real charge.

### 2026-10-19 — Organizer Email bookers

Added owner-only `/admin/email-bookers` and tenant-scoped `/admin/messages` endpoints. Organizers select an event, search confirmed booking contacts, select up to 500 deduplicated addresses, compose a CKEditor message with supported event/name fields, review the actual recipient list and personalized preview, and explicitly send. Only authored content is rendered; no logo, booking table or ticket attachment is added. This feature is for booking-related updates, not general marketing.

Migration 019 adds tenant-local message/recipient queues with immutable rendered copies, idempotent request keys, status history, cancellation and explicit retry. Organization SMTP is used; automated booking emails get priority. Delivery is paced to at most one contact per 10 seconds per organizer, rechecks confirmed bookings, pauses a batch on SMTP failure, and does not automatically retry interrupted/uncertain sends. Provider daily limits still apply. Legacy/platform access and other-tenant tokens are rejected.

Validation: disposable integration suite passed owner/staff/tenant permissions, recipient eligibility and deduplication, safe preview, concurrent request idempotency, priority/throttle, cancellation before send, SMTP pause/retry, queued cancellation and disabled SMTP. Existing 19 email tests and production build passed. New page lint has three effect-state advisory warnings, no errors. Live browser verified CKEditor, personalized preview and three existing test bookings grouped into one contact. No live messages queued or sent. Deployed backend/schema and isolated frontend build (excluding unrelated concurrent Orders work), backup `/root/ticketflow-backup-booker-emails-20261019/before.tgz`. Service active.

## Individual-ticket booking view and export — 19 October 2026

Orders now has By order and Individual tickets views. The latter shows one issued ticket per row with its attendee name, recorded email/phone, pass, event, booking reference/status, check-in state and booking date. View ticket opens the existing issued-ticket preview; booking references open the original order. Pending reservations without issued tickets remain in the order view. Legacy tickets do not present the buyer's contact details as attendee contact information.

The authenticated organizer report supports real/test separation, attendee/contact/ticket/reference search, event/pass, booking status, ticket status and inclusive booking-date filters. Filters and view selection are URL-backed. Export CSV includes every matching ticket (not only the visible page), booking contact and registration answers, with UTF-8, quoted multiline values and spreadsheet-formula protection. Export reads a consistent tenant snapshot in 1,000-row batches. Report/options/export endpoints use the existing current-role/organization checks and private no-store responses; no schema change is needed.

Backup: `/root/ticketflow-backup-individual-tickets-20261019/` contains the prior order router, frontend build and private database dump. Deployed only the order-router mount, two new report modules and the frontend build. Built from a source snapshot verified to reproduce the previous live index hash, including the already-deployed Email bookers feature; retained old hashed assets. No production bookings, attendees, payment settings or emails were changed.

Validation: filter/CSV unit checks, isolated two-tenant integration covering three attendees in one order, authorization, real/test separation, search, pass/status/date filters, pagination, historical/legacy records, empty exports, CSV formula safety and all 1,003 test tickets across multiple batches passed. Frontend report and existing order-preview checks plus production build passed. Live authenticated report/export and anonymous-access-denial checks passed. Browser checks verified view switching, attendee/event/pass filters, the selected attendee's actual ticket preview, and a downloaded CSV containing exactly the filtered attendee and registration answers. Current live data has zero real tickets and three test tickets. The temporary local test database was stopped after verification.

### 2026-10-19 — Email bookers spacing and ticket filters

Added consistent field/panel spacing. Ticket types appear after an event is selected; All ticket types includes confirmed booking contacts across that event, and individual pass filters require a valid/checked-in issued ticket. Select all resolves every matching contact (including beyond the 500 displayed), deduplicated by email. Preview binds the recipient set; if it changes before send, the organizer must review again. Migration 020 preserves the selected pass for the delivery-time eligibility check. Changing event, ticket or search clears selection and preview. No customer email is sent by filtering or previewing.

Disposable SMTP-mocked integration tests cover ticket/event isolation, search, cancelled passes, repeat bookings, 501 recipients beyond the display limit, and stale-preview rejection. Production build passed. Deployment preserves the separately released Individual tickets report.

Published with backup `/root/ticketflow-backup-email-filters-20261019/before.tgz`; migration 020 applied to both workspaces and service active. Live browser verified ticket filter hidden until event selection, five event-specific passes, select-all/clear, automatic clearing on pass change, Explorer contact and empty VIP results, and corrected field spacing. No live messages were queued or sent.

### 2026-10-19 — Customer-selection modal

Email bookers now keeps the main page compact with an event selector, selected count/filter summary and Select/Edit customers button. A native modal contains pass/search filters, Select all and individual contacts in a scrollable list, with a persistent Done footer. Closing or pressing Escape retains the selection. Native dialog focus containment and background scroll lock keep keyboard interaction in the picker. Existing tenant/recipient/preview/send behavior is unchanged. Frontend build passed; frontend-only deployment backed up at `/root/ticketflow-backup-email-modal-20261019/frontend-before.tgz`.

Live verification passed opening the picker, Select all, Done preserving the selected count, reopening and Escape returning keyboard focus to Select customers. Screenshot: `organizer-customer-modal-live.png`. No email was queued or sent.
