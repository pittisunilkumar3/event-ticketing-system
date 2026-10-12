# TicketFlow — Design Asset Specifications

Hand this document to your designer. Every dimension below is taken directly
from the production code, so assets built to these sizes will render pixel-perfect.

---

## 1) Email Templates

The email body renders inside a **500px-wide** white card, centered on a
light-grey (#e9ecef) background. Inner content width (after 40px padding)
is **420px**. Font: Roboto, 13px/21px body (#737883), headings (#334257).

| Asset | Rendered size | Design at (@2x) | Fit | Notes |
|---|---|---|---|---|
| **Logo** | 140 × 60 px | **280 × 120 px** | contain | Transparent PNG or SVG. Shown centered at top of most formats |
| **Icon** | 130 × 45 px | **260 × 90 px** | contain | Centered above the title (formats 4, 5, 6, 11) — e.g. a checkmark/seal badge |
| **Banner** | 500 × 172 px (full-bleed) | **1000 × 344 px** (min) — 1200 × 420 px safe | cover | Edge-to-edge strip. Keep important content in the central 80% — edges are cropped |
| Social icons | 24 × 24 px each | — | — | Auto-loaded (Facebook/Instagram/Twitter/LinkedIn/Pinterest). No design needed — just supply the page URLs |
| CTA button | auto width | — | — | Orange **#ffa726**, white text, 14px, 4px radius, padding 8 × 20px |

**Image uploads:** JPG, PNG, GIF, WebP, SVG — max 5 MB.

### Which asset appears in which format (11 layouts)

| Format | Layout summary |
|---|---|
| 1 | Logo → Title → Body → **Banner** → Button |
| 2 | Logo → Title → Body → Button |
| 3 | Title → Body → Button → green "Order Info" section with Logo |
| 4 | **Icon** → Title → Body → OTP/Code → Button |
| 5 (default) | **Banner** → **Icon** → Title → Body → Button (small Logo at bottom) |
| 6 | **Icon** → Title → Body → Transaction table → Button |
| 7 | Logo → Title → Body → **Banner** (no button) |
| 8 | Logo → Title → Body → **Banner** → Button |
| 9 | Title → Body → green "Order Info" section with Logo |
| 10 | **Icon** → Title → Body → **Banner** → Button → credentials block |
| 11 | **Icon** (centered) → Title → Body → Button |

> Design tip: prepare one logo (with transparent background), one icon, and
> one banner — they can be mixed across all 11 formats.

---

## 2) Ticket Design

The ticket renders at **620px wide** (radius 13px, 5px accent stripe on top)
and must stay legible in print and on phones.

| Asset | Rendered size | Design at (@2x) | Notes |
|---|---|---|---|
| **Ticket logo** | height 30 px, max-width 140 px | **280 × 60 px** | Transparent PNG/SVG. Ticket backgrounds are usually dark — supply a white / single-colour version |
| **Ticket banner** | full-bleed behind header, shown at 15% opacity | **1240 × 700 px** | Subtle textures, patterns or duotone imagery work best (it sits behind text) |
| QR code | 108 × 108 px on a white plate | auto-generated | Keep the right 115px column clear of artwork |
| Accent stripe | 5 px full-width | — | Default orange **#f97316**, configurable |
| Background | full card | — | Default near-black **#111111**; light text is applied automatically on dark backgrounds |

**Layouts:** `classic`, `minimal`, `badge` — same asset sizes for all three.
Tickets are print-enabled (`print-color-adjust: exact`), so avoid very light
colours on white and vice-versa.

---

## 3) Event Banners (public website)

| Placement | Rendered size | Design at | Notes |
|---|---|---|---|
| Event card (home / browse) | ~370 × 176 px visible, object-cover | **1200 × 630 px** | 1.91:1 ratio; centre-weighted composition (edges crop on small screens) |
| Event detail page hero | up to ~1200 px wide | same asset | One asset serves both |
| Fallback | — | — | If no banner is uploaded, an emoji + gradient placeholder is shown |

**Image uploads:** JPG, PNG, WebP, GIF — max 5 MB.

---

## 4) Brand & Misc

| Asset | Size | Notes |
|---|---|---|
| Brand logo (Brand & SMTP settings) | any, displayed ≤ 140px wide | PNG/SVG with transparency |
| Favicon | SVG or 32×32 px | `frontend/public/favicon.svg` |
| Palette (current defaults) | Email button `#ffa726` · Ticket accent `#f97316` · Ticket background `#111111` · Email text `#737883` / `#334257` | All configurable in the admin studio |

## General delivery guidelines

1. Design at **2×** the rendered size (tables above list both).
2. Banners use `object-fit: cover` → **centre-safe zone**: keep logos/text away from the outer 10% on all sides.
3. Logos & icons: **transparent PNG or SVG**, single-colour versions welcome (they sit on dark and light surfaces).
4. Name files clearly, e.g. `logo@2x.png`, `icon-badge@2x.png`, `banner-email@2x.png`, `banner-ticket@2x.png`, `event-banner@2x.jpg`.
