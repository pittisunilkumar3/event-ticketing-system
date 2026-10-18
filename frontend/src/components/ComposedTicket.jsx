import { QRCodeSVG } from "qrcode.react";
import { formatDate, formatTime, formatCurrency } from "../utils/format";
import "./composedTicket.css";

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
  const field = (label, value) => (
    <div className={`ct-detail${label === 'GUEST' ? ' ticket-attendee' : ''}`}>
      <small>{label}</small>
      <strong>{value}</strong>
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
        "--ct-areas": recipe.areas
          .split("/")
          .map((row) => `"${row}"`)
          .join(" "),
      }}
    >
      {status === "cancelled" && (
        <span className="ticket-void-stamp" aria-hidden="true">
          VOID
        </span>
      )}
      <div className="ct-brand" style={{ gridArea: "b" }}>
        {design.logo ? (
          <img src={design.logo} alt={design.brand || "TicketFlow"} />
        ) : (
          <strong>
            {design.brand || "TicketFlow"}
            <sup>®</sup>
          </strong>
        )}
        <span className={`ct-status ct-status-${status}`}>
          {preview ? "DESIGN PREVIEW" : status.replace("_", " ").toUpperCase()}
        </span>
      </div>
      <header className="ct-title" style={{ gridArea: "h" }}>
        <p>{design.heading || "YOUR NEXT GREAT EXPERIENCE"}</p>
        <h2>
          {order.event_title || "Cinematica · An evening of possibilities"}
        </h2>
        {design.banner_image && !cells.has("a") && (
          <img className="ct-inline-banner" src={design.banner_image} alt="" />
        )}
      </header>
      <section
        className="ct-details"
        style={{ gridArea: "m" }}
        aria-label="Booking details"
      >
        {field(
          "VENUE",
          [order.venue || "Main Exhibition Hall", order.city]
            .filter(Boolean)
            .join(", "),
        )}
        {design.show_attendee !== false &&
          field(
            "GUEST",
            ticket.attendee_name ||
              order.customer_name ||
              (preview ? "Alex Morgan" : "Guest"),
          )}
        {design.show_price !== false &&
          field(
            "TICKET PRICE",
            formatCurrency(design.price ?? ticket.price ?? 60,order.currency || design.currency || (preview?'INR':'USD')),
          )}
        {field("BOOKING REF", order.booking_ref || "TKT-PREVIEW")}
      </section>
      <aside className="ct-scan" style={{ gridArea: "q" }}>
        <small>SCAN AT ENTRY</small>
        <div className="ct-qr">
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
        <code>{preview ? "PREVIEW ONLY" : ticket.ticket_code}</code>
      </aside>
      <div className="ct-date" style={{ gridArea: "d" }}>
        <strong>{date ? String(date.getDate()).padStart(2, "0") : "—"}</strong>
        <div>
          <span>{date ? formatDate(start) : "Date to be confirmed"}</span>
          <b>{date ? formatTime(start) : "Time to be confirmed"}</b>
        </div>
      </div>
      <div className="ct-type" style={{ gridArea: "t" }}>
        <strong>
          {design.type_name || ticket.type_name || "VIP Experience"}
        </strong>
        <small>Nº {serial}</small>
      </div>
      <footer className="ct-note" style={{ gridArea: "f" }}>
        {design.footer_text ||
          "Present this ticket at the entrance. Each QR code admits one guest."}
      </footer>
      {cells.has("a") && (
        <div
          className={`ct-art ct-art-${recipe.motif}`}
          style={{ gridArea: "a" }}
          aria-hidden="true"
        >
          {design.banner_image ? (
            <img src={design.banner_image} alt="" />
          ) : (
            <>
              <i />
              <i />
              <i />
              <span>
                LIVE
                <br />
                EXPERIENCE
              </span>
            </>
          )}
        </div>
      )}
      {cells.has("a2") && (
        <div
          className="ct-art ct-art-small"
          style={{ gridArea: "a2" }}
          aria-hidden="true"
        >
          <i />
          <i />
        </div>
      )}
    </article>
  );
}
