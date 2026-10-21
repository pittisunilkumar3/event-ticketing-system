import {TicketDataContext,ticketVariables} from './ticketVariables';
import { QRCodeSVG } from "qrcode.react";
import { formatDate, formatTime, formatCurrency } from "../utils/format";
import "./ticketLayouts.css";
import compositions from "../../../shared/ticketCompositions.json";
import ComposedTicket from "./ComposedTicket";
import TicketLogos from "./TicketLogos";
import TicketText, { TicketTextContext } from "./TicketText";
import TicketCanvas from "./TicketCanvas";
import TicketPresentation, {TicketExtras} from "./TicketPresentation";
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

export default function DesignedTicket(props) {
  return <TicketDataContext.Provider value={ticketVariables(props)}><TicketPresentation {...props} design={props.design||{}}><TicketTextContext.Provider value={{design: props.design || {}, onEdit: props.onTextEdit}}>
    {Array.isArray(props.design?.layout_blocks)?<TicketCanvas {...props}/>:<TicketLayout {...props} />}
  </TicketTextContext.Provider></TicketPresentation></TicketDataContext.Provider>;
}

function TicketLayout({
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
      <span data-ticket-part="notch_top" className="ticket-notch top" aria-hidden />
      <span data-ticket-part="notch_bottom" className="ticket-notch bottom" aria-hidden />
      {cancelled && (
        <span className="ticket-void-stamp" aria-hidden>
          VOID
        </span>
      )}
      <div className="ticket-artwork" aria-hidden="true">
        {design.banner_image && !design.full_banner && <img data-ticket-part="banner_art" src={design.banner_image} alt="" />}
        <span />
        <i />
      </div>

      <div className="ticket-main">
        {design.full_banner && design.banner_image && <img data-ticket-part="banner" className="ticket-full-banner" src={design.banner_image} alt={`${design.brand || 'Event'} banner`} />}
        <header data-ticket-part="section_header" className="ticket-design-header">
          {design.banner_image && !design.full_banner && (
            <img
              data-ticket-part="banner_inline" className="ticket-design-banner"
              src={design.banner_image}
              alt=""
            />
          )}
          <div className="ticket-brand-row">
            <TicketLogos design={design} />
            <span data-ticket-part="status" className={`ticket-status-chip status-${statusKey}`}>
              {preview
                ? "DESIGN PREVIEW"
                : String(statusKey).replace("_", " ").toUpperCase()}
            </span>
          </div>
          <p className="ticket-eyebrow">
            <TicketText name="heading">{design.heading || "YOUR NEXT GREAT EXPERIENCE"}</TicketText>
          </p>
          <h2>
            <TicketText name="event_title">{order.event_title || "Cinematica · An evening of possibilities"}</TicketText>
          </h2>
          <span data-ticket-part="section_pass" className="ticket-type-label">
            <TicketText name="ticket_type">{design.type_name || ticket.type_name || "VIP Experience"}</TicketText>
          </span>
        </header>

        <div data-ticket-part="section_details" className="ticket-design-content">
          <span data-ticket-part="divider" className="ticket-content-divider" aria-label="Dotted divider" />
          <div data-ticket-part="section_date" className="ticket-date-chip" aria-hidden={!when}>
            <strong><TicketText name="day">{day}</TicketText></strong>
            <span>
              <TicketText name="month">{mon}</TicketText>
              {when && <small><TicketText name="year">{when.getFullYear()}</TicketText></small>}
            </span>
          </div>
          <div className="ticket-meta-grid">
            <div>
              <small><TicketText name="time_label" /></small>
              <strong>
                <TicketText name="time">{when ? formatTime(eventStart) : "Time to be confirmed"}</TicketText>
              </strong>
            </div>
            <div>
              <small><TicketText name="date_label" /></small>
              <strong>
                <TicketText name="date">{when ? formatDate(eventStart) : "Date to be confirmed"}</TicketText>
              </strong>
            </div>
            <div>
              <small><TicketText name="venue_label" /></small>
              <strong>
                <TicketText name="venue">{[order.venue || "Main Exhibition Hall", order.city].filter(Boolean).join(', ')}</TicketText>
              </strong>
            </div>
            {design.show_attendee !== false && (
              <div className="ticket-attendee">
                <small><TicketText name="attendee_label" /></small>
                <strong>
                  <TicketText name="attendee_name">{ticket.attendee_name || order.customer_name || (preview ? "Alex Morgan" : "Guest")}</TicketText>
                </strong>
              </div>
            )}
            {design.show_price !== false && (
              <div>
                <small><TicketText name="price_label" /></small>
                <strong>
                  <TicketText name="price">{formatCurrency(design.price ?? ticket.price ?? 60,order.currency || design.currency || (preview?'INR':'USD'))}</TicketText>
                </strong>
              </div>
            )}
            <div>
              <small><TicketText name="booking_label" /></small>
              <strong><TicketText name="booking_ref">{order.booking_ref || "TKT-PREVIEW"}</TicketText></strong>
            </div>
          </div>
        </div>

        <footer data-ticket-part="section_footer" className="ticket-design-footer">
          <p>
            <TicketText name="footer">{design.footer_text ||
              "Present this ticket at the entrance. Each QR code admits one guest."}</TicketText>
          </p>
          <span data-ticket-part="barcode" className="ticket-barcode" aria-hidden />
        </footer>
      </div>

      <aside data-ticket-part="section_qr" className="ticket-stub">
        <span data-ticket-part="divider_qr" className="ticket-stub-divider" aria-label="QR divider"/>
        <span className="ticket-admit">
          <TicketText name="admit_label" />
        </span>
        <div className="ticket-qr">
          <div data-ticket-part="qr">
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
        </div>
        <span className="ticket-serial"><TicketText name="serial">{serial}</TicketText></span>
      </aside>
      <TicketExtras design={design} ticket={ticket} order={order} preview={preview}/>
    </article>
  );
}
