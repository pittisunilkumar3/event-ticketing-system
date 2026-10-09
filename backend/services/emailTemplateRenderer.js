const Studio = require('../models/Studio');

/**
 * Server-side email renderer — faithful port of the hostel reference
 * project's emailTemplateService.generateTemplateHTML() with all 11
 * format templates, shared CSS, privacy/social footer builders and
 * {{placeholder}} replacement.
 */

// ─── Shared CSS & Footer (matches reference project exactly) ─────────
const SHARED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap');
  body {
    margin: 0;
    font-family: 'Roboto', sans-serif;
    font-size: 13px;
    line-height: 21px;
    color: #737883;
    background-color: #e9ecef;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  h1,h2,h3,h4,h5,h6 { color: #334257; }
  * { box-sizing: border-box; }
  :root { --base: #ffa726; }
  .main-table {
    width: 500px;
    background: #FFFFFF;
    margin: 0 auto;
    padding: 40px;
  }
  .main-table-td {}
  img { max-width: 100%; }
  .cmn-btn{
    background: var(--base);
    color: #fff;
    padding: 8px 20px;
    display: inline-block;
    text-decoration: none;
  }
  .mb-1 { margin-bottom: 5px; }
  .mb-2 { margin-bottom: 10px; }
  .mb-3 { margin-bottom: 15px; }
  .mb-4 { margin-bottom: 20px; }
  .mb-5 { margin-bottom: 25px; }
  hr {
    border-color: rgba(0, 170, 109, 0.3);
    margin: 16px 0;
  }
  .border-top {
    border-top: 1px solid rgba(0, 170, 109, 0.3);
    padding: 15px 0 10px;
    display: block;
  }
  .d-block { display: block; }
  .privacy {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
  }
  .privacy a {
    text-decoration: none;
    color: #334257;
    position: relative;
    margin-left: auto;
    margin-right: auto;
  }
  .privacy a span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #334257;
    display: inline-block;
    margin: 0 7px;
  }
  .social {
    margin: 15px 0 8px;
    display: block;
  }
  .copyright{
    text-align: center;
    display: block;
  }
  div { display: block; }
  a { text-decoration: none; }
  .text-base {
    color: var(--base);
    font-weight: 700;
  }
  .text-center { text-align: center; }
  .w-100 { width: 100%; }
  .bg-section { background: #E3F5F1; }
  table.bg-section { color: #334257; }
  .p-10 { padding: 10px; }
  table.bg-section tr th,
  table.bg-section tr td { padding: 5px; }
  .mail-img-1 {
    width: 140px;
    height: 60px;
    object-fit: contain;
  }
  .mail-img-2 {
    width: 130px;
    height: 45px;
    object-fit: contain;
  }
  .mail-img-3 {
    width: 100%;
    height: 172px;
    object-fit: cover;
  }
  .social img { width: 24px; }
`;

// ─── Image URL resolution (absolute for email clients) ───────────────

/**
 * "" / null → fallback; external URL → as-is; relative `/uploads/…` →
 * `${assetBase}/uploads/…`. assetBase = brand.site_url (the public origin
 * that proxies /uploads to this backend).
 */
function resolveImageUrl(ref, assetBase, fallback = '') {
  if (!ref) return fallback;
  if (/^https?:\/\//i.test(ref)) {
    // Rebase legacy localhost uploads onto the public asset base
    if (/localhost|127\.0\.0\.1/.test(ref) && assetBase) {
      const m = ref.match(/\/uploads\/[^"'\s)]+/i);
      if (m) return `${assetBase}${m[0]}`;
    }
    return ref;
  }
  return assetBase ? `${assetBase}${ref}` : ref;
}

// ─── Build privacy links HTML ────────────────────────────────────────

function buildPrivacyHtml(template, cmsSlugs, baseUrl) {
  const cmsUrl = (slug) => (baseUrl ? `${baseUrl}/pages/${slug}` : `#/pages/${slug}`);
  const contactUrl = baseUrl ? `${baseUrl}/contact` : '#/contact';

  const links = [];
  if (Number(template.privacy)) {
    const slug = cmsSlugs['privacy policy'] || 'privacy-policy';
    links.push(`<a href="${cmsUrl(slug)}" style="display:inline-block">Privacy Policy</a>`);
  }
  if (Number(template.refund)) {
    const slug = cmsSlugs['refund policy'] || 'refund-policy';
    links.push(`<a href="${cmsUrl(slug)}" style="display:inline-block"><span></span>Refund Policy</a>`);
  }
  if (Number(template.cancelation)) {
    const slug = cmsSlugs['cancellation policy'] || 'cancellation-policy';
    links.push(`<a href="${cmsUrl(slug)}" style="display:inline-block"><span></span>Cancellation Policy</a>`);
  }
  if (Number(template.contact)) {
    links.push(`<a href="${contactUrl}" style="display:inline-block"><span></span>Contact Us</a>`);
  }

  return links.length ? `<span class="privacy">${links.join('')}</span>` : '';
}

// ─── Build social media icons HTML ───────────────────────────────────

function buildSocialHtml(template, socialMap) {
  const socialIconMap = {
    facebook: 'https://img.icons8.com/color/24/facebook.png',
    instagram: 'https://img.icons8.com/color/24/instagram.png',
    twitter: 'https://img.icons8.com/color/24/twitter.png',
    linkedin: 'https://img.icons8.com/color/24/linkedin.png',
    pinterest: 'https://img.icons8.com/color/24/pinterest.png',
  };

  const platforms = ['facebook', 'instagram', 'twitter', 'linkedin', 'pinterest'];
  const icons = [];

  for (const platform of platforms) {
    if (Number(template[platform])) {
      const link = socialMap[platform] || '#';
      const icon = socialIconMap[platform];
      icons.push(`<a href="${link}" target="_blank" style="margin:0 5px;text-decoration:none"><img src="${icon}" alt="${platform}" /></a>`);
    }
  }

  return icons.length ? `<span class="social" style="text-align:center">${icons.join('')}</span>` : '';
}

// ─── Build button HTML ───────────────────────────────────────────────

function buildButtonHtml(template) {
  if (!template.button_url || !template.button_name) return '';
  return `<span class="d-block text-center" style="margin-top:16px">
    <a href="${template.button_url || '#'}" class="cmn-btn">${template.button_name || 'Submit'}</a>
  </span>`;
}

// ─── Build footer section (privacy + social + copyright) ─────────────

function buildFooterSection(template, socialMap, cmsSlugs, baseUrl, copyrightText) {
  const privacyHtml = buildPrivacyHtml(template, cmsSlugs, baseUrl);
  const socialHtml = buildSocialHtml(template, socialMap);

  return `
    <tr>
      <td>
        ${privacyHtml}
        ${socialHtml}
        <span class="copyright" id="mail-copyright">${copyrightText}</span>
      </td>
    </tr>`;
}

// ─── Format templates 1–11 ───────────────────────────────────────────

const pageHead = (title, extraCss = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${extraCss || SHARED_CSS}</style>
</head>`;

const thanksBlock = (footerText, companyName) => `
          <hr>
          <div class="mb-2" id="mail-footer">${footerText}</div>
          <div>Thanks &amp; Regards,</div>
          <div class="mb-4">${companyName}</div>`;

function formatTemplate1(ctx) {
  const { logoUrl, bannerUrl, btnHtml, footerSection, title, body, footerText, companyName } = ctx;
  return `${pageHead(title)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          <img class="mail-img-1" id="logoViewer" src="${logoUrl}" alt="logo" onerror="this.style.display='none'">
          <h2 id="mail-title" class="mt-2">${title}</h2>
          <div class="mb-1" id="mail-body">${body}</div>
          ${bannerUrl ? `<img class="mb-2 mail-img-3" id="bannerViewer" src="${bannerUrl}" alt="banner" onerror="this.style.display='none'">` : ''}
          ${btnHtml}${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
    </tbody>
  </table>
</body>
</html>`;
}

function formatTemplate2(ctx) {
  const { logoUrl, btnHtml, footerSection, title, body, footerText, companyName } = ctx;
  return `${pageHead(title)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          <img class="mail-img-1" id="logoViewer" src="${logoUrl}" alt="logo" onerror="this.style.display='none'">
          <h2 id="mail-title" class="mt-2">${title}</h2>
          <div class="mb-1" id="mail-body">${body}</div>
          ${btnHtml}${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
    </tbody>
  </table>
</body>
</html>`;
}

function formatTemplate3(ctx) {
  const { logoUrl, btnHtml, footerSection, title, body, footerText, companyName } = ctx;
  const extra = `
    .order-table { padding: 10px; background: #fff; }
    .order-table tr td { vertical-align: top; }
    .order-table .subtitle { margin: 0; margin-bottom: 10px; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .bg-section-2 { background: #F8F9FB; }
    .p-1 { padding: 5px; }
    .p-2 { padding: 10px; }
    .px-3 { padding-inline: 15px; }
    .mb-0 { margin-bottom: 0; }
    .m-0 { margin: 0; }
    .font-medium { font-weight: 500; }
    .font-bold { font-weight: 700; }
    .mt-0 { margin-top: 0; }
  `;
  return `${pageHead(title, SHARED_CSS + extra)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          <h2 class="mb-3" id="mail-title">${title}</h2>
          <div class="mb-1" id="mail-body">${body}</div>
          ${btnHtml}
          <table class="bg-section p-10 w-100">
            <tbody>
              <tr>
                <td class="p-10">
                  <span class="d-block text-center">
                    <img class="mb-2 mail-img-2" src="${logoUrl}" alt="logo" onerror="this.style.display='none'">
                    <h3 class="mb-3 mt-0">Order Info</h3>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
    </tbody>
  </table>
</body>
</html>`;
}

function formatTemplate4(ctx) {
  const { iconUrl, btnHtml, footerSection, title, body, footerText, companyName, code } = ctx;
  return `${pageHead(title)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          <div class="text-center">
            <img class="mail-img-2" id="iconViewer" src="${iconUrl}" alt="icon" onerror="this.style.display='none'">
            <h2 id="mail-title" class="mt-2">${title}</h2>
            <div class="mb-1" id="mail-body">${body}</div>
            ${code ? `<h2 style="font-size:26px;margin:0;letter-spacing:4px">${code}</h2>` : ''}
          </div>
          ${btnHtml}${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
    </tbody>
  </table>
</body>
</html>`;
}

function formatTemplate5(ctx) {
  const { iconUrl, logoUrl, bannerUrl, btnHtml, footerSection, title, body, footerText, companyName } = ctx;
  return `${pageHead(title)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          ${bannerUrl ? `<img class="mail-img-3" id="bannerViewer" src="${bannerUrl}" alt="banner" style="width:100%;height:auto;max-height:200px;object-fit:cover;display:block;margin:0 0 12px" onerror="this.style.display='none'">` : ''}
          <div class="text-center">
            <img class="mail-img-2" id="iconViewer" src="${iconUrl}" alt="icon" onerror="this.style.display='none'">
            <h2 id="mail-title" class="mt-2">${title}</h2>
            <div class="mb-2" id="mail-body">${body}</div>
          </div>
          ${btnHtml}${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
      ${logoUrl ? `<tr><td style="text-align:center;padding-top:10px"><img class="mail-img-1" id="logoViewer" src="${logoUrl}" alt="logo" style="width:100px;max-width:100%;height:auto;display:inline-block" onerror="this.style.display='none'"></td></tr>` : ''}
    </tbody>
  </table>
</body>
</html>`;
}

function formatTemplate6(ctx) {
  const { iconUrl, btnHtml, footerSection, title, body, footerText, companyName, transactionId, time, amount } = ctx;
  return `${pageHead(title)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          <div class="text-center">
            <img class="mail-img-2" id="iconViewer" src="${iconUrl}" alt="icon" onerror="this.style.display='none'">
            <h2 id="mail-title" class="mt-2">${title}</h2>
            <div class="mb-2" id="mail-body">${body}</div>
          </div>
          <table class="bg-section p-10 w-100 text-center">
            <thead>
              <tr>
                <th>SL</th>
                <th>Transaction ID</th>
                <th>Time</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>${transactionId}</td>
                <td>${time}</td>
                <td>${amount}</td>
              </tr>
            </tbody>
          </table>
          ${btnHtml}${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
    </tbody>
  </table>
</body>
</html>`;
}

function formatTemplate7(ctx) {
  const { logoUrl, bannerUrl, footerSection, title, body, footerText, companyName } = ctx;
  return `${pageHead(title)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          <img class="mail-img-1" id="logoViewer" src="${logoUrl}" alt="logo" onerror="this.style.display='none'">
          <h2 id="mail-title" class="mt-2">${title}</h2>
          <div class="mb-1" id="mail-body">${body}</div>
          ${bannerUrl ? `<img class="mb-2 mail-img-3" id="bannerViewer" src="${bannerUrl}" alt="banner" onerror="this.style.display='none'">` : ''}${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
    </tbody>
  </table>
</body>
</html>`;
}

function formatTemplate8(ctx) {
  const { logoUrl, bannerUrl, btnHtml, footerSection, title, body, footerText, companyName } = ctx;
  return `${pageHead(title)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          <img class="mail-img-1" id="logoViewer" src="${logoUrl}" alt="logo" onerror="this.style.display='none'">
          <h2 id="mail-title" class="mt-2">${title}</h2>
          <div class="mb-1" id="mail-body">${body}</div>
          ${bannerUrl ? `<img class="mb-2 mail-img-3" id="bannerViewer" src="${bannerUrl}" alt="banner" onerror="this.style.display='none'">` : ''}
          ${btnHtml}${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
    </tbody>
  </table>
</body>
</html>`;
}

function formatTemplate9(ctx) {
  const { logoUrl, footerSection, title, body, footerText, companyName } = ctx;
  const extra = `
    .order-table { padding: 10px; background: #fff; }
    .order-table tr td { vertical-align: top; }
    .order-table .subtitle { margin: 0; margin-bottom: 10px; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .bg-section-2 { background: #F8F9FB; }
    .p-1 { padding: 5px; }
    .p-2 { padding: 10px; }
    .px-3 { padding-inline: 15px; }
    .mb-0 { margin-bottom: 0; }
    .m-0 { margin: 0; }
    .mt-0 { margin-top: 0; }
  `;
  return `${pageHead(title, SHARED_CSS + extra)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          <h2 class="mb-3" id="mail-title">${title}</h2>
          <div class="mb-1" id="mail-body">${body}</div>
          <table class="bg-section p-10 w-100">
            <tbody>
              <tr>
                <td class="p-10">
                  <span class="d-block text-center">
                    <img class="mb-2 mail-img-2" src="${logoUrl}" alt="logo" onerror="this.style.display='none'">
                    <h3 class="mb-3 mt-0">Order Info</h3>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
    </tbody>
  </table>
</body>
</html>`;
}

function formatTemplate10(ctx) {
  const { iconUrl, bannerUrl, btnHtml, footerSection, title, body, body2, footerText, companyName, email, password } = ctx;
  const credentialsHtml = email || password
    ? `
    <div class="mb-1">
      Your account credentials:
      ${email ? `<h6>Email: ${email}</h6>` : ''}
      ${password ? `<h6>Password: ${password}</h6>` : ''}
    </div>`
    : '';
  const body2Html = body2 ? `<div class="mb-1" id="mail-body2">${body2}</div>` : '';

  return `${pageHead(title)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          <img class="mail-img-1" id="iconViewer" src="${iconUrl}" alt="icon" onerror="this.style.display='none'">
          <h2 id="mail-title" class="mt-2">${title}</h2>
          <div class="mb-1" id="mail-body">${body}</div>
          ${bannerUrl ? `<img class="mb-2 mail-img-3" id="bannerViewer" src="${bannerUrl}" alt="banner" onerror="this.style.display='none'">` : ''}
          ${btnHtml}
          ${credentialsHtml}
          ${body2Html}${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
    </tbody>
  </table>
</body>
</html>`;
}

function formatTemplate11(ctx) {
  const { iconUrl, btnHtml, footerSection, title, body, footerText, companyName } = ctx;
  return `${pageHead(title)}<body style="background-color:#e9ecef;padding:15px">
  <table class="main-table">
    <tbody>
      <tr>
        <td class="main-table-td">
          <div class="text-center">
            <img class="mail-img-2" id="iconViewer" src="${iconUrl}" alt="icon" onerror="this.style.display='none'">
            <h2 id="mail-title" class="mt-2 mb-2">${title}</h2>
          </div>
          <div class="mb-2" id="mail-body">${body}</div>
          ${btnHtml}${thanksBlock(footerText, companyName)}
        </td>
      </tr>
      ${footerSection}
    </tbody>
  </table>
</body>
</html>`;
}

// ─── Main HTML Template Generation ───────────────────────────────────

/**
 * Renders the final email HTML for a template row.
 * Reads brand / social links / CMS pages from the studio settings.
 */
async function generateTemplateHTML(template, replacements = {}) {
  const brand = await Studio.getSetting('brand');
  const assetBase = (brand && brand.site_url ? brand.site_url : '').replace(/\/$/, '');
  const companyName = (brand && brand.company_name) || 'TicketFlow';

  // Process fields with {{variable}} replacements
  const replaceVars = (text) => {
    let out = text || '';
    for (const [key, value] of Object.entries(replacements)) {
      out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    }
    return out;
  };

  const title = replaceVars(template.title) || 'Notification';
  const body = replaceVars(template.body);
  const body2 = replaceVars(template.body_2);
  let footerText = replaceVars(template.footer_text) ||
    "Please contact us for any queries, we're always happy to help.";
  let copyrightText = replaceVars(template.copyright_text) ||
    `Copyright ${new Date().getFullYear()} ${companyName}. All rights reserved.`;
  const buttonUrl = replaceVars(template.button_url);

  // Real URLs from the database
  const [dbSocials, pages] = await Promise.all([
    Studio.getSetting('social_links').catch(() => ({})),
    Studio.pages(true).catch(() => []),
  ]);

  const socialMap = {};
  for (const [name, link] of Object.entries(dbSocials || {})) {
    if (link) socialMap[name.toLowerCase().trim()] = link;
  }

  const cmsSlugs = {};
  for (const p of pages || []) {
    cmsSlugs[String(p.title).toLowerCase().trim()] = p.slug;
  }

  const tpl = { ...template, button_url: buttonUrl };
  const ctx = {
    logoUrl: resolveImageUrl(tpl.logo, assetBase),
    iconUrl: resolveImageUrl(tpl.icon, assetBase),
    bannerUrl: resolveImageUrl(tpl.banner_image, assetBase),
    btnHtml: buildButtonHtml(tpl),
    footerSection: buildFooterSection(tpl, socialMap, cmsSlugs, assetBase, copyrightText),
    title, body, body2, footerText, companyName,
    code: replacements['code'] || replacements['otp'] || '',
    transactionId: replacements['transaction_id'] || '',
    time: replacements['time'] || '',
    amount: replacements['amount'] || '',
    email: replacements['email'] || '',
    password: replacements['password'] || '',
  };

  const formatNum = parseInt(tpl.email_template) || 5;
  const FORMATS = { 1: formatTemplate1, 2: formatTemplate2, 3: formatTemplate3, 4: formatTemplate4,
    5: formatTemplate5, 6: formatTemplate6, 7: formatTemplate7, 8: formatTemplate8,
    9: formatTemplate9, 10: formatTemplate10, 11: formatTemplate11 };
  const render = FORMATS[formatNum] || formatTemplate5;
  let html = render(ctx);

  // Email clients strip onerror/JS, so an <img src=""> (icon/logo not
  // uploaded) would render as a broken-image icon. Drop empty-src images.
  return html.replace(/<img\b[^>]*\bsrc=""[^>]*>/gi, '');
}

module.exports = { generateTemplateHTML, resolveImageUrl, SHARED_CSS };
