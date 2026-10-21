import {createContext} from 'react';
import {formatDate,formatTime,formatCurrency} from '../utils/format';
export const TicketDataContext=createContext({});
export function ticketVariables({design={},ticket={},order={},preview=false}){
 const start=order.event_start||(preview?'2026-12-12 18:00:00':null),date=start?new Date(String(start).replace(' ','T')):null;
 const answers=ticket.registration_answers||ticket.attendee_answers||[];
 const fields=Object.fromEntries(answers.filter(a=>/^f_[a-zA-Z0-9_-]+$/.test(a.id)).map(a=>['field_'+a.id,a.type==='file'?a.value?.name||'':Array.isArray(a.value)?a.value.join(', '):typeof a.value==='boolean'?(a.value?'Yes':'No'):String(a.value??'')]));
 return {...fields,attendee_email:ticket.attendee_email||'',attendee_phone:ticket.attendee_phone||'',event_title:order.event_title||(preview?'Cinematica · An evening of possibilities':''),ticket_type:design.type_name||ticket.type_name||(preview?'VIP Experience':''),attendee_name:ticket.attendee_name||order.customer_name||(preview?'Alex Morgan':'Guest'),venue:[order.venue||(preview?'Main Exhibition Hall':''),order.city].filter(Boolean).join(', '),price:formatCurrency(design.price??ticket.price??(preview?60:0),order.currency||design.currency||'INR'),booking_ref:order.booking_ref||(preview?'TKT-PREVIEW':''),ticket_code:preview?'TCK-PREVIEW-000042':ticket.ticket_code||'',serial:preview?'000042':String(ticket.id||0).padStart(6,'0'),date:start?formatDate(start):'Date to be confirmed',time:start?formatTime(start):'Time to be confirmed',day:date?String(date.getDate()).padStart(2,'0'):'—',month:date?date.toLocaleString('en-US',{month:'short'}).toUpperCase():'—',year:date?String(date.getFullYear()):''};
}
export function resolveTicketText(source,values){return String(source??'').replace(/{{\s*([a-zA-Z0-9_-]+)\s*}}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]??''):/^field_f_[a-zA-Z0-9_-]+$/.test(key)?'':match);}
