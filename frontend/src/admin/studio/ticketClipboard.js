// Component data stays in the current editor; ordinary text inputs keep native copy/paste.
export function pasteTicketComponent(config, clipboard, id, sequence = 1) {
  if (!clipboard || (config.extra_elements || []).length >= 36) return null;
  const item = structuredClone(clipboard.item);
  const adjustment = structuredClone(clipboard.adjustment || {});
  item.id = id;
  // Offset inside the ticket, reversing direction near its right/bottom edge.
  const offset=axis=>{
    const bounds=clipboard.offsetBounds?.[axis];
    if(!bounds)return 2*sequence;
    const direction=bounds.max>=2?1:-1;
    return Math.max(bounds.min,Math.min(bounds.max,direction*2*sequence));
  };
  adjustment.x = Math.min(10000, (adjustment.x || 0) + offset('x'));
  adjustment.y = Math.min(10000, (adjustment.y || 0) + offset('y'));
  adjustment.hidden = false;
  return {...config, extra_elements: [...(config.extra_elements || []), item],
    element_adjustments: {...config.element_adjustments, [id]: adjustment}};
}

export function componentKind(id, config) {
  const extra = config.extra_elements?.find(e => e.id === id);
  if (extra) return extra.type;
  if (id?.startsWith('text_')) return 'text';
  if (id === 'section_pass') return 'badge';
  if (id === 'qr') return 'qr';
  if (id === 'divider' || id === 'divider_qr') return 'divider';
  if (['main_logo','banner','banner_inline','banner_art'].includes(id) || id?.startsWith('partner_')) return 'image';
  return null;
}
