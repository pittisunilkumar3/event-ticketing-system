export default function Icon({ name = 'ticket', size = 20 }) {
  const paths = {
    users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M13 7a4 4 0 11-8 0 4 4 0 018 0M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    'credit-card': 'M3 4h18v16H3zM3 9h18M7 15h3',
    clock: 'M22 12a10 10 0 11-20 0 10 10 0 0120 0M12 6v6l4 2',
    printer: 'M6 9V3h12v6M6 18H3V9h18v9h-3M6 14h12v7H6zM17 12h1',
    search: 'M21 21l-5-5M18 10a8 8 0 11-16 0 8 8 0 0116 0',
    pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1116 0zM15 10a3 3 0 11-6 0 3 3 0 016 0',
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
