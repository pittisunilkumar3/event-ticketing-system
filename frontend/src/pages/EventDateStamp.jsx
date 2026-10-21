import {formatEventDates} from '../utils/format';

export default function EventDateStamp({start, end}) {
  const first = new Date(String(start || '').replace(' ', 'T'));
  const last = end ? new Date(String(end).replace(' ', 'T')) : first;
  if (Number.isNaN(first.getTime())) return null;
  const range = !Number.isNaN(last.getTime()) && last > first && first.toDateString() !== last.toDateString();
  const sameMonth = !range || (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear());
  const label = sameMonth ? first.toLocaleDateString('en-GB', {month:'short'}) : 'Event dates';
  const days = sameMonth ? `${first.getDate()}${range ? '–' + last.getDate() : ''}` : formatEventDates(start,end);
  return <a className={'event-date-stamp'+(range?' event-date-stamp-range':'')+(!sameMonth?' event-date-stamp-long':'')} href="#tickets" aria-label={`${formatEventDates(start,end)} — Get tickets`}>
    <small>{label}</small><strong>{days}</strong><span>GET TICKETS ↗</span>
  </a>;
}
