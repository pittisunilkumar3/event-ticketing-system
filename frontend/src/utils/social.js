export const socialNetworks = [
  { key: 'instagram', name: 'Instagram', example: 'https://www.instagram.com/yourbrand' },
  { key: 'facebook', name: 'Facebook', example: 'https://www.facebook.com/yourbrand' },
  { key: 'youtube', name: 'YouTube', example: 'https://www.youtube.com/@yourbrand' },
  { key: 'linkedin', name: 'LinkedIn', example: 'https://www.linkedin.com/company/yourbrand' },
  { key: 'twitter', name: 'X (Twitter)', example: 'https://x.com/yourbrand' },
  { key: 'pinterest', name: 'Pinterest', example: 'https://www.pinterest.com/yourbrand' },
];
export const emptySocialLinks = Object.fromEntries(socialNetworks.map(({ key }) => [key, '']));
export const templateSocialMode = config => config.social_mode ??
  (Object.values(config.social_links || {}).some(Boolean) ? 'custom' : 'brand');
