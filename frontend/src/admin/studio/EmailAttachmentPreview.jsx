export default function EmailAttachmentPreview({ ticketPdf, files, busy, onPreview, allowTicket = true }) {
  const count = files.length + (ticketPdf ? 1 : 0);
  return <section className="studio-preview-attachments" aria-label="Email attachment preview">
    <strong>Attachments{count > 0 ? ` (${count})` : ''}</strong>
    {count === 0 && <p>{allowTicket?'No PDFs attached. Enable the ticket PDF or upload a file in Attachments.':'No PDFs attached. Upload a file in Attachments.'}</p>}
    {ticketPdf && <button type="button" disabled={busy} onClick={() => onPreview()}><span>Ticket PDF</span><small>Selected pass design · Preview</small></button>}
    {files.map(file => <button type="button" key={file.id} disabled={busy} onClick={() => onPreview(file)}><span>{file.name || 'Uploaded PDF'}</span><small>Preview PDF</small></button>)}
  </section>;
}
