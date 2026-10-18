import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import DesignedTicket from "../../components/DesignedTicket";
import {
  Field,
  Toggle,
  ImageField,
  Notice,
  Icon,
  errorText,
  useUnsaved,
} from "./StudioUI";

function TicketThumbnail({ design, category }) {
  const frame = useRef(null);
  const content = useRef(null);
  const [scale, setScale] = useState(0.23);
  useEffect(() => {
    const fit = () => {
      if (!frame.current || !content.current) return;
      const width = content.current.offsetWidth;
      const height = content.current.offsetHeight;
      if (width && height)
        setScale(
          Math.min(
            (frame.current.clientWidth - 32) / width,
            (frame.current.clientHeight - 24) / height,
            0.4,
          ),
        );
    };
    const observer = new ResizeObserver(fit);
    observer.observe(frame.current);
    observer.observe(content.current);
    fit();
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className={"ticket-thumbnail format-" + category.toLowerCase()}
      ref={frame}
      aria-hidden="true"
    >
      <div
        className="ticket-thumbnail-inner ticket-thumbnail-fitted"
        ref={content}
        style={{
          width: category === "Horizontal" ? 660 : 390,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <DesignedTicket design={design} preview />
      </div>
    </div>
  );
}

export default function TicketDesigner({ data, onUpdate }) {
  const layouts = data.ticketLayouts || [];
  const [selected, setSelected] = useState(
    data.ticketTemplates[0] || {
      name: "My ticket design",
      kind: "ticket",
      active: true,
      config: { ...data.defaults.ticket },
    },
  );
  const [saved, setSaved] = useState(JSON.stringify(selected));
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const collection = useRef(null);
  const editor = useRef(null);
  const allowChange = useUnsaved(JSON.stringify(selected) !== saved);
  const config = selected.config;
  const update = (key, value) =>
    setSelected((s) => ({ ...s, config: { ...s.config, [key]: value } }));
  function select(template) {
    if (saving || !allowChange()) return;
    setSelected(structuredClone(template));
    setSaved(JSON.stringify(template));
    setMessage(null);
    editor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function create() {
    select({
      name: "Untitled ticket design",
      kind: "ticket",
      active: true,
      config: { ...data.defaults.ticket },
    });
  }
  function changeLayout(id) {
    const preset = layouts.find((layout) => layout.id === id);
    setSelected((s) => ({
      ...s,
      config: { ...s.config, ...preset?.config, layout: id },
    }));
  }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { data: r } = await api[selected.id ? "put" : "post"](
        `/admin/studio/templates${selected.id ? "/" + selected.id : ""}`,
        selected,
      );
      setSelected(r.data.template);
      setSaved(JSON.stringify(r.data.template));
      onUpdate(r.data.template);
      setMessage({
        type: "success",
        text: "Design saved. Assign it to a ticket type under Events.",
      });
    } catch (err) {
      setMessage({ text: errorText(err) });
    } finally {
      setSaving(false);
    }
  }
  const visible = data.ticketTemplates.filter((t) => {
    const layout = layouts.find((l) => l.id === t.config.layout);
    return (
      (filter === "All" || layout?.category === filter) &&
      `${t.name} ${layout?.description || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  function changePage(next) {
    setPage(next);
    collection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <>
      <div className="studio-heading">
        <div>
          <span className="studio-eyebrow">DESIGN STUDIO / TICKETS</span>
          <h1>Make an entrance.</h1>
          <p>
            {layouts.length} ticket templates. Find your event’s signature
            style.
          </p>
        </div>
        <button
          className="studio-button secondary"
          disabled={saving}
          onClick={create}
        >
          <Icon name="plus" />
          New design
        </button>
      </div>
      <div className="studio-workflow">
        <span>
          <b>01</b> Design your ticket
        </span>
        <i>→</i>
        <Link to="/admin/events">
          <b>02</b> Assign to a ticket type
        </Link>
        <i>→</i>
        <span>
          <b>03</b> Issued with every booking
        </span>
      </div>
      <section
        className="ticket-collection studio-panel"
        id="ticket-collection"
        ref={collection}
        aria-label="Ticket collection"
      >
        <div className="studio-panel-title">
          <Icon name="ticket" />
          <h2>Ticket collection</h2>
          <span>{data.ticketTemplates.length} saved designs</span>
        </div>
        <div className="ticket-collection-tools">
          <div role="group" aria-label="Filter ticket formats">
            {["All", "Horizontal", "Portrait", "Compact"].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <input
            aria-label="Search ticket designs"
            placeholder="Find a design…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="ticket-collection-grid">
          {visible.slice(pageStart, pageStart + pageSize).map((t) => {
            const layout = layouts.find((l) => l.id === t.config.layout);
            return (
              <button
                type="button"
                className={
                  "ticket-collection-card " +
                  (selected.id === t.id ? "selected" : "")
                }
                aria-pressed={selected.id === t.id}
                aria-label={"Customize " + t.name}
                disabled={saving}
                onClick={() => select(t)}
                key={t.id}
              >
                <TicketThumbnail
                  design={t.config}
                  category={layout?.category || "Horizontal"}
                />
                <div className="ticket-collection-caption">
                  <strong>{t.name}</strong>
                  <span>
                    {layout?.category || "Custom"} ·{" "}
                    {t.active ? "Active" : "Archived"}
                  </span>
                  <p>{layout?.description || "Your custom ticket design."}</p>
                </div>
              </button>
            );
          })}
        </div>
        {visible.length > 0 && (
          <nav
            className="ticket-collection-pagination"
            aria-label="Ticket collection pages"
          >
            <span role="status">
              {pageStart + 1}–{Math.min(pageStart + pageSize, visible.length)}{" "}
              of {visible.length} designs
            </span>
            {pageCount > 1 && (
              <div>
                <button
                  type="button"
                  className="studio-button secondary"
                  disabled={currentPage === 1}
                  onClick={() => changePage(currentPage - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  className="studio-button secondary"
                  disabled={currentPage === pageCount}
                  onClick={() => changePage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </nav>
        )}
        {visible.length === 0 && (
          <p className="studio-empty">
            No designs match. Try another format or search.
          </p>
        )}
      </section>
      <div className="ticket-editor-heading" ref={editor}>
        <div>
          <span className="studio-eyebrow">MAKE IT YOURS</span>
          <h2>{selected.name}</h2>
        </div>
        <a href="#ticket-collection">Back to collection ↑</a>
      </div>
      <Notice message={message} />
      <div className="ticket-editor-workspace">
        <form onSubmit={save} className="studio-panel studio-design-controls">
          <div className="studio-panel-title">
            <h2>Design details</h2>
            <span>{selected.id ? "Saved design" : "New design"}</span>
          </div>
          <fieldset
            disabled={saving}
            className="studio-form-body ticket-design-fields"
          >
            <Field
              label="Design name"
              value={selected.name}
              maxLength={120}
              required
              onChange={(e) =>
                setSelected({ ...selected, name: e.target.value })
              }
            />
            <Field label="Layout">
              <select
                value={config.layout}
                onChange={(e) => changeLayout(e.target.value)}
              >
                {["Horizontal", "Portrait", "Compact"].map((category) => (
                  <optgroup label={category} key={category}>
                    {layouts
                      .filter((l) => l.category === category)
                      .map((l) => (
                        <option value={l.id} key={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <div className="studio-two-col">
              <Field label="Accent color">
                <div className="studio-color">
                  <input
                    type="color"
                    aria-label="Accent color"
                    value={config.accent}
                    onChange={(e) => update("accent", e.target.value)}
                  />
                  <code>{config.accent}</code>
                </div>
              </Field>
              <Field label="Background">
                <div className="studio-color">
                  <input
                    type="color"
                    aria-label="Background color"
                    value={config.background}
                    disabled={config.layout === "minimal"}
                    onChange={(e) => update("background", e.target.value)}
                  />
                  <code>
                    {config.layout === "minimal"
                      ? "#ffffff"
                      : config.background}
                  </code>
                </div>
              </Field>
            </div>
            <Field
              label="Brand name"
              value={config.brand}
              required
              maxLength={120}
              onChange={(e) => update("brand", e.target.value)}
            />
            <Field
              label="Eyebrow text"
              value={config.heading}
              maxLength={255}
              onChange={(e) => update("heading", e.target.value)}
            />
            <div className="studio-two-col">
              <ImageField
                label="Logo"
                value={config.logo}
                onChange={(v) => update("logo", v)}
              />
              <ImageField
                label="Banner"
                value={config.banner_image}
                onChange={(v) => update("banner_image", v)}
              />
            </div>
            <Field label="Entry instructions">
              <textarea
                rows={3}
                value={config.footer_text}
                maxLength={1000}
                onChange={(e) => update("footer_text", e.target.value)}
              />
            </Field>
            <Toggle
              label="Show attendee name"
              checked={config.show_attendee}
              onChange={(v) => update("show_attendee", v)}
            />
            <Toggle
              label="Show ticket price"
              checked={config.show_price}
              onChange={(v) => update("show_price", v)}
            />
            <Toggle
              label="Available for new tickets"
              hint="Existing tickets keep their saved design."
              checked={selected.active}
              onChange={(v) => setSelected({ ...selected, active: v })}
            />
            <button className="studio-button primary" disabled={saving}>
              {saving ? "Saving…" : "Save ticket design"}
              <Icon name="check" />
            </button>
          </fieldset>
        </form>
        <section className="studio-ticket-preview">
          <div className="studio-preview-label">
            <span className="studio-live-dot" />
            LIVE PREVIEW <span>Sample booking</span>
          </div>
          <DesignedTicket design={config} preview />
          <p>
            <Icon name="check" size={14} />
            Unique QR codes are generated when tickets are issued.
          </p>
        </section>
      </div>
    </>
  );
}
