import { createContext, useContext } from 'react';
import {TicketDataContext,resolveTicketText} from './ticketVariables';
import catalog from '../../../shared/ticketText.json';

export const TicketTextContext = createContext({ design: {} });
export function ticketTextSource(design, name) {
  const entry = catalog[name];
  return entry.field ? design[entry.field] ?? '' : design.text?.[name] ?? entry.default ?? `{{${entry.token}}}`;
}

// Keep the same text renderer in the editor, issued tickets and email PDFs.
export default function TicketText({ name, children }) {
  const { design, onEdit, extra } = useContext(TicketTextContext);
  const values=useContext(TicketDataContext);
  const entry = catalog[name];
  const source = ticketTextSource(design, name);
  const text = resolveTicketText(entry.field ? design[entry.field] ?? children : source,{...values,...(entry.token?{[entry.token]:children??values[entry.token]}:{})});
  const hidden=!extra&&design.element_adjustments?.['text_'+name]?.hidden;
  if (!onEdit) return <ticket-text aria-hidden={hidden?'true':undefined} style={hidden?{visibility:'hidden'}:undefined} data-ticket-part={`text_${name}`}>{text}</ticket-text>;
  return <ticket-text data-ticket-part={`text_${name}`} className="ticket-editable-text" role="button" tabIndex={0}
    aria-label={`Edit ${entry.label.toLowerCase()}`} title={`Edit ${entry.label.toLowerCase()}`}
    onClick={(event) => onEdit(name, event.currentTarget)} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onEdit(name, event.currentTarget); }
    }}>{text || <span className="ticket-empty-text">{entry.label}</span>}</ticket-text>;
}
