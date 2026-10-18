const defaults = require("../../shared/siteSettings.json");
const v = require("./studioValidation");

function validateSiteSettings(input, current = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    v.fail("Invalid site settings.");
  const value = { ...defaults, ...current, ...input };
  const output = {};
  for (const [key, max, required] of [
    ["company_name", 120, true],
    ["site_title", 160, true],
    ["tagline", 160, false],
    ["hero_title", 160, false],
    ["description", 500, false],
    ["phone", 40, false],
    ["address", 500, false],
    ["country", 100, false],
    ["footer_text", 300, false],
    ["copyright_text", 300, false],
  ])
    output[key] = v.string(value[key], key.replaceAll("_", " "), max, required);
  output.site_url = v.url(value.site_url);
  if (!output.site_url) v.fail("Website URL is required.");
  const origin = new URL(output.site_url);
  if (origin.search || origin.hash || !(origin.pathname === "/" || /^\/o\/[a-z][a-z0-9-]{2,39}$/.test(origin.pathname)))
    v.fail("Use the website origin, without a path or query.");
  output.site_url = origin.origin + (origin.pathname === "/" ? "" : origin.pathname);
  output.support_email = v.emailAddress(value.support_email || "");
  if (!/^#[a-f0-9]{6}$/i.test(value.accent_color)) v.fail("Choose a valid brand color.");
  output.accent_color = value.accent_color;
  output.hero_image = v.url(value.hero_image, { image: true });
  output.logo = v.url(value.logo, { image: true });
  output.favicon = v.url(value.favicon, { image: true });
  return output;
}
// Explicit allowlist: public branding never includes delivery credentials or other settings.
function publicSiteSettings(brand = {}) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      brand[key] ?? fallback,
    ]),
  );
}
module.exports = { validateSiteSettings, publicSiteSettings };
