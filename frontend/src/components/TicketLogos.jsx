import TicketText from './TicketText';
export default function TicketLogos({ design = {} }) {
  const logos = [...new Set((design.logos || []).filter(Boolean))].slice(0, 6);
  const style = design.logo_style || {};
  return <div data-ticket-part="section_logos" className="ticket-logo-group" aria-label="Event logos" style={{
    '--logo-size': `${style.size ?? 44}px`, gap: `${style.gap ?? 8}px`,
    justifyContent: {left:'flex-start',center:'center',right:'flex-end'}[style.align || 'left'],
    marginTop: style.margin_top || 0, marginBottom: style.margin_bottom || 0,
  }}>
    {design.logo ? <img data-ticket-part="main_logo" className="ticket-main-logo" src={design.logo} alt={design.brand || 'Event logo'} />
      : <strong><TicketText name="brand">{design.brand || 'TicketFlow'}</TicketText></strong>}
    {logos.map((src,index) => <img data-ticket-part={`partner_${index}`} className="ticket-partner-logo" key={src} src={src} alt={`Event partner ${index + 1}`} />)}
  </div>;
}
