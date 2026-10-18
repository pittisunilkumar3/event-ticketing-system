import themes from '../../../shared/eventThemes.json';
import './eventThemeTokens.css';

export const eventThemeId = value => themes.some(theme => theme.id === value) ? value : 'classic';

// Refresh availability as well as appearance without replacing the registration
// form, selected ticket prices, or a separately stored pending reservation.
export const refreshCheckoutTheme = (current, latest) => current ? {
  ...current,
  payment: latest.payment,
  event: {...current.event, page_theme:latest.event.page_theme},
} : latest;
