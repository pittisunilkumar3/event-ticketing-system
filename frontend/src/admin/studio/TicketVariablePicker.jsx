import {createContext,useContext} from 'react';
export const TicketFormContext=createContext({fields:[],sample:null});
import catalog from '../../../../shared/ticketText.json';
export const ticketVariables=Object.entries(catalog).filter(([,entry])=>entry.token);
export function unknownTicketVariable(value){return [...value.matchAll(/{{\s*([^{}]+?)\s*}}/g)].some(([,key])=>!ticketVariables.some(([,entry])=>entry.token===key)&&!/^field_f_[a-zA-Z0-9_-]+$/.test(key)&&!['attendee_email','attendee_phone'].includes(key));}
export default function TicketVariablePicker({inputRef,value,onChange}){
 const {fields}=useContext(TicketFormContext);
 function insert(token){if(!token)return;const node=inputRef.current,start=node?.selectionStart??value.length,end=node?.selectionEnd??start,text=`{{${token}}}`;onChange(value.slice(0,start)+text+value.slice(end));requestAnimationFrame(()=>{node?.focus();node?.setSelectionRange(start+text.length,start+text.length);});}
 return <label className="ticket-variable-picker">Insert variable<select aria-label="Insert variable" value="" onChange={e=>insert(e.target.value)}><option value="">Choose a booking detail…</option>{ticketVariables.map(([key,entry])=><option key={key} value={entry.token}>{entry.label}</option>)}<option value="attendee_email">Attendee email</option><option value="attendee_phone">Attendee phone</option>{fields.length>0&&<optgroup label="Registration form">{fields.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>}</select></label>;
}
