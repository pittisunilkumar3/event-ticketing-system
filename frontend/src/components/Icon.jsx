export default function Icon({ name = 'ticket', size = 20 }) {
  const paths = {
    ticket: 'M4 5h16v4a3 3 0 000 6v4H4v-4a3 3 0 000-6V5z M15 5v14',
    mail: 'M3 5h18v14H3z M3 6l9 7 9-7',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    page: 'M6 3h8l4 4v14H6z M14 3v5h4M9 12h6M9 16h6',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    calendar: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16',
    check: 'M5 12l4 4L19 6',
    arrow: 'M5 12h14M14 7l5 5-5 5',
    plus: 'M12 5v14M5 12h14',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM15 12a3 3 0 11-6 0 3 3 0 016 0',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.ticket} /></svg>;
}
