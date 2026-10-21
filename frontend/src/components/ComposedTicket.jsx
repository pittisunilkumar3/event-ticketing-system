import {TicketExtras} from './TicketPresentation';
import { QRCodeSVG } from "qrcode.react";
import { formatDate, formatTime, formatCurrency } from "../utils/format";
import "./composedTicket.css";
import TicketLogos from "./TicketLogos";
import TicketText from "./TicketText";

const inkFor = (hex) => {
  const rgb = (hex || "#111111")
    .replace("#", "")
    .match(/.{2}/g)
    .map((v) => parseInt(v, 16));
  return rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 155
    ? "#171717"
    : "#ffffff";
};

export default function ComposedTicket({
  recipe,
  design,
  ticket,
  order,
  preview,
}) {
  const background = design.background || recipe.background;
  const accent = design.accent || recipe.accent;
  const start = order.event_start || (preview ? "2026-12-12 18:00:00" : null);
  const date = start ? new Date(String(start).replace(" ", "T")) : null;
  const status = preview ? "preview" : ticket.status || "valid";
  const serial = preview ? "000042" : String(ticket.id || "").padStart(6, "0");
  const cells = new Set(recipe.areas.split(/[ /]+/));
  const fullBanner = design.full_banner && design.banner_image;
  const areas = fullBanner ? `${recipe.areas.split('/')[0].trim().split(/\s+/).map(() => 'hero').join(' ')}/${recipe.areas}` : recipe.areas;
  const field = (label, value) => (
    <div className={`ct-detail${label === 'attendee_name' ? ' ticket-attendee' : ''}`}>
      <small><TicketText name={{venue:'venue_label',attendee_name:'attendee_label',price:'price_label',booking_ref:'booking_label'}[label]} /></small>
      <strong><TicketText name={label}>{value}</TicketText></strong>
    </div>
  );
  return (
    <article
      className={`designed-ticket ticket-composed ticket-layout-${recipe.id} ct-${recipe.category.toLowerCase()} ct-shell-${recipe.shell} ${status === "cancelled" ? "ticket-void" : ""}`}
      style={{
        "--ct-bg": background,
        "--ct-ink": inkFor(background),
        "--ct-accent": accent,
        "--ct-accent-ink": inkFor(accent),
        "--ct-columns": recipe.columns,
        "--ct-areas": areas
          .split("/")
          .map((row) => `"${row}"`)
          .join(" "),
      }}
    >
      {fullBanner && <img data-ticket-part="banner" className="ticket-full-banner" style={{ gridArea: 'hero' }} src={design.banner_image} alt={`${design.brand || 'Event'} banner`} />}
      {status === "cancelled" && (
        <span className="ticket-void-stamp" aria-hidden="true">
          VOID
        </span>
      )}
      <div className="ct-brand" style={{ gridArea: "b" }}>
        <TicketLogos design={design} />
        <span data-ticket-part="status" className={`ct-status ct-status-${status}`}>
          {preview ? "DESIGN PREVIEW" : status.replace("_", " ").toUpperCase()}
        </span>
      </div>
      <header data-ticket-part="section_header" className="ct-title" style={{ gridArea: "h" }}>
        <p><TicketText name="heading">{design.heading || "YOUR NEXT GREAT EXPERIENCE"}</TicketText></p>
        <h2>
          <TicketText name="event_title">{order.event_title || "Cinematica · An evening of possibilities"}</TicketText>
        </h2>
        {design.banner_image && !fullBanner && !cells.has("a") && (
          <img data-ticket-part="banner_inline" className="ct-inline-banner" src={design.banner_image} alt="" />
        )}
      </header>
      <section
        data-ticket-part="section_details" className="ct-details"
        style={{ gridArea: "m" }}
        aria-label="Booking details"
      >
        {field(
          "venue",
          [order.venue || "Main Exhibition Hall", order.city]
            .filter(Boolean)
            .join(", "),
        )}
        {design.show_attendee !== false &&
          field(
            "attendee_name",
            ticket.attendee_name ||
              order.customer_name ||
              (preview ? "Alex Morgan" : "Guest"),
          )}
        {design.show_price !== false &&
          field(
            "price",
            formatCurrency(design.price ?? ticket.price ?? 60,order.currency || design.currency || (preview?'INR':'USD')),
          )}
        {field("booking_ref", order.booking_ref || "TKT-PREVIEW")}
      </section>
      <aside data-ticket-part="section_qr" className="ct-scan" style={{ gridArea: "q" }}>
        <small><TicketText name="scan_label" /></small>
        <div data-ticket-part="qr" className="ct-qr">
          <QRCodeSVG
            value={
              preview
                ? "PREVIEW-NOT-A-VALID-TICKET"
                : ticket.ticket_code || "INVALID"
            }
            size={96}
            level="M"
            marginSize={1}
            bgColor="#ffffff"
            fgColor="#111111"
          />
        </div>
        <code><TicketText name="ticket_code">{preview ? "PREVIEW ONLY" : ticket.ticket_code}</TicketText></code>
      </aside>
      <div data-ticket-part="section_date" className="ct-date" style={{ gridArea: "d" }}>
        <strong><TicketText name="day">{date ? String(date.getDate()).padStart(2, "0") : "—"}</TicketText></strong>
        <div>
          <span><TicketText name="date">{date ? formatDate(start) : "Date to be confirmed"}</TicketText></span>
          <b><TicketText name="time">{date ? formatTime(start) : "Time to be confirmed"}</TicketText></b>
        </div>
      </div>
      <div data-ticket-part="section_pass" className="ct-type" style={{ gridArea: "t" }}>
        <strong>
          <TicketText name="ticket_type">{design.type_name || ticket.type_name || "VIP Experience"}</TicketText>
        </strong>
        <small><TicketText name="serial">{serial}</TicketText></small>
      </div>
      <footer data-ticket-part="section_footer" className="ct-note" style={{ gridArea: "f" }}>
        <TicketText name="footer">{design.footer_text ||
          "Present this ticket at the entrance. Each QR code admits one guest."}</TicketText>
      </footer>
      {cells.has("a") && (
        <div
          data-ticket-part="section_art" className={`ct-art ct-art-${recipe.motif}`}
          style={{ gridArea: "a" }}
        >
          {design.banner_image && !fullBanner ? (
            <img src={design.banner_image} alt="" />
          ) : (
            <>
              <i />
              <i />
              <i />
              <span>
                <TicketText name="art_text" />
              </span>
            </>
          )}
        </div>
      )}
      {cells.has("a2") && (
        <div
          data-ticket-part="section_art_secondary" className="ct-art ct-art-small"
          style={{ gridArea: "a2" }}
          aria-hidden="true"
        >
          <i />
          <i />
        </div>
      )}
      <TicketExtras design={design} ticket={ticket} order={order} preview={preview}/>
    </article>
  );
}
