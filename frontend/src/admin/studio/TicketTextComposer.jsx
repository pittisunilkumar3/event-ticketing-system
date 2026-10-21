import {useRef,useState} from 'react';
import TicketVariablePicker,{unknownTicketVariable} from './TicketVariablePicker';
export default function TicketTextComposer({value,onApply,onClose}){
 const [text,setText]=useState(value),input=useRef(null),invalid=unknownTicketVariable(text);
 return <form className="ticket-custom-text-editor" aria-label="Edit custom text" onSubmit={e=>{e.preventDefault();if(!invalid)onApply(text);}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}>
  <header><strong>Edit text</strong><button type="button" aria-label="Close text editor" onClick={onClose}>×</button></header>
  <textarea ref={input} autoFocus aria-label="Ticket text" rows="4" maxLength="1000" value={text} onChange={e=>setText(e.target.value)}/>
  <TicketVariablePicker inputRef={input} value={text} onChange={setText}/>
  <p>Variables use each guest’s actual booking details.</p>{invalid&&<p role="alert">Choose a variable from the list.</p>}
  <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={invalid}>Apply text</button></footer>
 </form>;
}
