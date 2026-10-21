import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import TicketVariablePicker,{unknownTicketVariable,TicketFormContext} from './TicketVariablePicker';
import PdfPreview from "./PdfPreview";
import TicketDirectEditor from "./TicketDirectEditor";
import DesignedTicket from "../../components/DesignedTicket";
import { ticketTextSource } from "../../components/TicketText";
import textCatalog from "../../../../shared/ticketText.json";

function withText(config, name, value) {
  const field = textCatalog[name].field;
  return field ? {...config, [field]: value} : {...config, text: {...config.text, [name]: value}};
}
import {
  Field,
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
          width: design.ticket_size?.width || 760,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <DesignedTicket design={design} preview />
      </div>
    </div>
  );
}

export default function TicketDesigner({ data, onUpdate }) {
  const textInput=useRef(null);
  const [previewType,setPreviewType]=useState(String(data.emailTicketTypes?.[0]?.id||'')),[formData,setFormData]=useState({fields:[],sample:null}),[formError,setFormError]=useState('');
  useEffect(()=>{let active=true;setFormData({fields:[],sample:null});setFormError('');if(previewType)api.get('/admin/studio/ticket-fields/'+previewType).then(({data:r})=>{if(active)setFormData(r.data);}).catch(()=>{if(active)setFormError('Registration fields could not load. Reopen this page to try again.');});return()=>{active=false;};},[previewType]);
  const [pdfUrl,setPdfUrl]=useState(''),[pdfBusy,setPdfBusy]=useState(false);
  useEffect(()=>()=>{if(pdfUrl)URL.revokeObjectURL(pdfUrl);},[pdfUrl]);
  async function previewPdf(){
    setPdfBusy(true);setMessage(null);
    try{const response=await api.post('/admin/studio/ticket-preview',{config:selected.config,ticket_type_id:previewType||undefined},{responseType:'blob'});setPdfUrl(URL.createObjectURL(response.data));}
    catch(err){setMessage({text:errorText(err)});}
    finally{setPdfBusy(false);}
  }
  const layouts = data.ticketLayouts || [];
  const [selected, setSelected] = useState(
    data.ticketTemplates[0] || {
      name: "My ticket design",
      kind: "ticket",
      active: true,
      config: { ...data.defaults.ticket, canvas:{height:1000}, layout_blocks:[] },
    },
  );
  const [saved, setSaved] = useState(JSON.stringify(selected));
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading,setUploading]=useState(false);
  const [editingText, setEditingText] = useState(null);
  const [modalOpen,setModalOpen]=useState(false);
  const modal=useRef(null);
  const [past,setPast]=useState([]),[future,setFuture]=useState([]);
  const editConfig=useCallback(next => {
    setMessage(null);
    setPast(p=>[...p,structuredClone(selected.config)].slice(-30));setFuture([]);
    setSelected(s=>({...s,config:typeof next==='function'?next(s.config):next}));
  },[selected.config]);
  function travel(redo=false){
    const source=redo?future:past;if(!source.length)return;
    const next=source[source.length-1];
    if(redo){setPast(p=>[...p,selected.config]);setFuture(source.slice(0,-1));}
    else {setFuture(f=>[...f,selected.config]);setPast(source.slice(0,-1));}
    setSelected(s=>({...s,config:next}));setMessage(null);
  }
  useEffect(()=>{
    if(!modalOpen)return;
    const original=document.body.style.overflow;document.body.style.overflow='hidden';
    modal.current?.showModal();
    return ()=>{document.body.style.overflow=original;};
  },[modalOpen]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const collection = useRef(null);
  const allowChange = useUnsaved(JSON.stringify(selected) !== saved || Boolean(editingText));
  const config = selected.config;
  function select(template) {
    if (saving || uploading || !allowChange()) return;
    setPast([]);setFuture([]);
    setSelected(structuredClone(template));
    setSaved(JSON.stringify(template));
    setMessage(null);
    setEditingText(null);
    setModalOpen(true);
  }
  function closeEditor() {
    if(saving||uploading||!allowChange())return;
    setSelected(JSON.parse(saved));setEditingText(null);setModalOpen(false);
  }
  function create() {
    const name=window.prompt('Name your ticket design','My ticket design');
    if(!name?.trim())return;
    select({
      name: name.trim().slice(0,120),
      kind: "ticket",
      active: true,
      config: { ...data.defaults.ticket, canvas:{height:1000}, layout_blocks:[] },
    });
  }
  async function save(e) {
    e.preventDefault();
    if (editingText || uploading) return;
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
  const textEntry = editingText ? textCatalog[editingText.name] : null;
  const unknownToken = editingText && unknownTicketVariable(editingText.value);
  const textError = unknownToken ? 'Choose a variable from the list.'

    : textEntry?.field === 'brand' && !editingText.value.trim() ? 'Enter a brand name.' : '';
  function closeTextEditor() {
    const target = editingText?.target;
    setEditingText(null);
    requestAnimationFrame(() => target?.focus());
  }
  function applyText(event) {
    event.preventDefault();
    if (textError) return;
    editConfig(current => withText(current, editingText.name, editingText.value));
    closeTextEditor();
  }
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  function changePage(next) {
    setPage(next);
    collection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <TicketFormContext.Provider value={formData}>
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
          disabled={saving||uploading}
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
                disabled={saving||uploading}
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
      {modalOpen&&<dialog ref={modal} className="studio ticket-preview-modal" aria-label="Ticket design preview" onCancel={event=>{event.preventDefault();if(pdfUrl)setPdfUrl('');else if(!pdfBusy)closeEditor();}}>
        <section className="studio-ticket-preview" inert={Boolean(pdfUrl)}>
          <div className="ticket-component-toolbar">
            <strong>{selected.name}</strong>
            <button type="button" className="studio-button" disabled={!past.length||saving||uploading||!!editingText} onClick={()=>travel()}>Undo</button>
            <button type="button" className="studio-button" disabled={!future.length||saving||uploading||!!editingText} onClick={()=>travel(true)}>Redo</button>
            <button type="button" className="studio-button" disabled={saving||uploading||pdfBusy} onClick={closeEditor}>Close preview</button>
            <button type="button" className="studio-button" disabled={pdfBusy||saving||uploading||!!editingText} onClick={previewPdf}>{pdfBusy?'Preparing PDF…':'Preview PDF'}</button>
            <button type="button" className="studio-button primary" disabled={saving||uploading||!!editingText} onClick={save}>{saving?'Saving…':'Save ticket design'}</button>
          </div>
          <Notice message={message} />
          {!!data.emailTicketTypes?.length&&<label className="ticket-preview-type">Preview form <select aria-label="Preview ticket type" value={previewType} onChange={e=>setPreviewType(e.target.value)}>{data.emailTicketTypes.map(t=><option key={t.id} value={t.id}>{t.event_title} · {t.name}</option>)}</select><small>Sample answers · issued tickets use each attendee’s details</small></label>}
          {formError&&<p role="alert">{formError}</p>}
          {editingText && <form className="ticket-text-editor" role="dialog" aria-label={`Edit ${textEntry.label.toLowerCase()}`}
            onSubmit={applyText} onKeyDown={event => {if(event.key === 'Escape') {event.stopPropagation();closeTextEditor();}}}>
            <Field label={textEntry.label}>
              <textarea ref={textInput} autoFocus rows={3} maxLength={textEntry.max || 500} value={editingText.value}
                onChange={event => setEditingText(current => ({...current,value:event.target.value}))} />
            </Field>
            <TicketVariablePicker inputRef={textInput} value={editingText.value} onChange={value=>setEditingText(current=>({...current,value}))}/>
            {textEntry.token && <small>Insert variables for attendee details, or clear the text to leave it blank.</small>}
            {textError && <small role="alert" className="studio-error">{textError}</small>}
            <div className="studio-save-bar">
              {!textEntry.field && <button type="button" className="studio-text-button" onClick={() => setEditingText(current => ({...current,value:textEntry.default ?? `{{${textEntry.token}}}`}))}>Use default</button>}
              <button type="button" className="studio-button" onClick={closeTextEditor}>Cancel</button>
              <button type="submit" className="studio-button primary" disabled={Boolean(textError)}>Apply text</button>
            </div>
          </form>}
          <div className="ticket-preview-surface"><TicketDirectEditor config={editingText ? withText(config,editingText.name,editingText.value):config} onChange={editConfig} onBusy={setUploading} disabled={saving||uploading||Boolean(editingText)}
            onTextEdit={(name,target)=>setEditingText({name,value:ticketTextSource(config,name),target})}/></div>
        </section>
        {pdfUrl&&<div className="ticket-design-pdf studio-pdf-modal" role="dialog" aria-label="Ticket PDF preview" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setPdfUrl('');}}}>
          <header><strong>Ticket PDF preview</strong><a href={pdfUrl} download="ticket-design-preview.pdf">Download PDF</a><button type="button" autoFocus onClick={()=>setPdfUrl('')}>Back to design</button></header>
          <PdfPreview url={pdfUrl}/>
        </div>}
      </dialog>}
    </TicketFormContext.Provider>
  );
}
