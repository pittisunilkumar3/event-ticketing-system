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
