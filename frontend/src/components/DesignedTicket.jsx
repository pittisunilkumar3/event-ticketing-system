import { QRCodeSVG } from "qrcode.react";
import { formatDate, formatTime, formatCurrency } from "../utils/format";
import "./ticketLayouts.css";
import compositions from "../../../shared/ticketCompositions.json";
import ComposedTicket from "./ComposedTicket";
const compositionById = new Map(
  compositions.map((recipe) => [recipe.id, recipe]),
);

function luminance(hex) {
  const rgb = (hex || "#111111")
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((v) => parseInt(v, 16)) || [17, 17, 17];
  return rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
}
const foreground = (hex) => (luminance(hex) > 155 ? "#171717" : "#ffffff");
const serialOf = (ticket) => {
  if (ticket.id != null) return String(ticket.id).padStart(6, "0");
  const digits = String(ticket.ticket_code || "").replace(/\D/g, "");
  return digits ? digits.slice(-6).padStart(6, "0") : "000000";
};

export default function DesignedTicket({
  design = {},
  ticket = {},
  order = {},
  preview = false,
}) {
  const recipe = compositionById.get(design.layout);
  if (recipe)
    return (
      <ComposedTicket
        recipe={recipe}
        design={design}
        ticket={ticket}
        order={order}
        preview={preview}
      />
    );
  const [layout, edition] = (design.layout || "classic").split("--");
  const aurora = layout === "aurora" && !edition;
  const bg =
    layout === "minimal" && !edition
      ? "#ffffff"
      : design.background || "#111111";
  const ink = aurora ? "#ffffff" : foreground(bg);
  const accent = design.accent || "#f97316";
  const statusKey = preview ? "valid" : ticket.status || "valid";
  const cancelled = statusKey === "cancelled";

  const eventStart =
    order.event_start || (preview ? "2026-12-12 18:00:00" : null);
  const when = eventStart
    ? new Date(String(eventStart).replace(" ", "T"))
    : null;
  const day = when ? String(when.getDate()).padStart(2, "0") : "--";
  const mon = when
    ? when.toLocaleString("en-US", { month: "short" }).toUpperCase()
    : "---";
  const serial = preview ? "000042" : serialOf(ticket);

  return (
    <article
      className={`designed-ticket ticket-layout-${layout} ${edition ? `ticket-edition-${edition}` : ""} ${preview ? "ticket-is-preview" : ""} ${cancelled ? "ticket-void" : ""}`}
      style={{
        "--ticket-bg": bg,
        "--ticket-ink": ink,
        "--ticket-accent": accent,
        "--ticket-accent-ink": foreground(accent),
      }}
    >
      <span className="ticket-notch top" aria-hidden />
      <span className="ticket-notch bottom" aria-hidden />
      {cancelled && (
        <span className="ticket-void-stamp" aria-hidden>
          VOID
        </span>
      )}
      <div className="ticket-artwork" aria-hidden="true">
        {design.banner_image && <img src={design.banner_image} alt="" />}
        <span />
        <i />
      </div>

      <div className="ticket-main">
        <header className="ticket-design-header">
          {design.banner_image && (
            <img
              className="ticket-design-banner"
              src={design.banner_image}
              alt=""
            />
          )}
          <div className="ticket-brand-row">
            {design.logo ? (
              <img
                className="ticket-design-logo"
                src={design.logo}
                alt={design.brand || "TicketFlow"}
              />
            ) : (
              <strong>
                {design.brand || "TicketFlow"}
                <span>®</span>
              </strong>
            )}
            <span className={`ticket-status-chip status-${statusKey}`}>
              {preview
                ? "DESIGN PREVIEW"
                : String(statusKey).replace("_", " ").toUpperCase()}
            </span>
          </div>
          <p className="ticket-eyebrow">
            {design.heading || "YOUR NEXT GREAT EXPERIENCE"}
          </p>
          <h2>
            {order.event_title || "Cinematica · An evening of possibilities"}
          </h2>
          <span className="ticket-type-label">
            {design.type_name || ticket.type_name || "VIP Experience"}
          </span>
        </header>

        <div className="ticket-design-content">
          <div className="ticket-date-chip" aria-hidden={!when}>
            <strong>{day}</strong>
            <span>
              {mon}
              {when && <small>{when.getFullYear()}</small>}
            </span>
          </div>
          <div className="ticket-meta-grid">
            <div>
              <small>DOORS OPEN</small>
              <strong>
                {when ? formatTime(eventStart) : "Time to be confirmed"}
              </strong>
            </div>
            <div>
              <small>DATE</small>
              <strong>
                {when ? formatDate(eventStart) : "Date to be confirmed"}
              </strong>
            </div>
            <div>
              <small>VENUE</small>
              <strong>
                {order.venue || "Main Exhibition Hall"}
                {order.city ? `, ${order.city}` : ""}
              </strong>
            </div>
            {design.show_attendee !== false && (
              <div className="ticket-attendee">
                <small>GUEST</small>
                <strong>
                  {ticket.attendee_name || order.customer_name || (preview ? "Alex Morgan" : "Guest")}
                </strong>
              </div>
            )}
            {design.show_price !== false && (
              <div>
                <small>TICKET PRICE</small>
                <strong>
                  {formatCurrency(design.price ?? ticket.price ?? 60,order.currency || design.currency || (preview?'INR':'USD'))}
                </strong>
              </div>
            )}
            <div>
              <small>BOOKING REF</small>
              <strong>{order.booking_ref || "TKT-PREVIEW"}</strong>
            </div>
          </div>
        </div>

        <footer className="ticket-design-footer">
          <p>
            {design.footer_text ||
              "Present this ticket at the entrance. Each QR code admits one guest."}
          </p>
          <span className="ticket-barcode" aria-hidden />
        </footer>
      </div>

      <aside className="ticket-stub">
        <span className="ticket-admit" aria-hidden>
          ADMIT ONE
        </span>
        <div className="ticket-qr">
          <div>
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
        </div>
        <span className="ticket-serial">Nº {serial}</span>
      </aside>
    </article>
  );
}
