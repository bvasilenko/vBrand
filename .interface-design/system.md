# Design System

## Color Palette

### Semantic — confidence levels (module-scope lookup maps in main.jsx)
- high:   text `#22c55e` / bg `#f0fdf4`
- medium: text `#eab308` / bg `#fefce8`
- low:    text `#f97316` / bg `#fff7ed`
- none:   text `#ef4444` / bg `#fef2f2`

### Neutral — typography and surface
- Primary text:   `#374151` (Tailwind gray-700)
- Secondary text: `#6b7280` (Tailwind gray-500)
- Muted text:     `#9ca3af` (Tailwind gray-400)
- Border:         `#e5e7eb` (Tailwind gray-200)
- Surface bg:     `#f9fafb` (Tailwind gray-50)

## Spacing Scale

Base unit: 4px
Scale used: 2px (letterSpacing), 4px (borderRadius), 8px, 12px, 24px, 32px, 40px
Standard cell padding: `8px 12px` (used on all td and th)

## Typography

Font families:
- UI: `system-ui, sans-serif`
- Code/identifiers: `monospace`

Size scale: 11px (badge/code) → 12px (th labels / subtitle) → 13px (body cells) → 15px (section h2) → 22px (page h1)

Weight scale:
- 600: column headers (th)
- 700: section headings (h2) / badge text
- 800: page title (h1)

## Depth Strategy

Borders-only. No box-shadows used anywhere. Border color is always `#e5e7eb`.
Table uses `borderCollapse: 'collapse'` with a 2px bottom border on thead, 1px on tbody rows.

## Component Patterns

### Badge
Confidence pill: white text on `CONFIDENCE_COLOR[level]` background; `borderRadius: 4`, `padding: '2px 8px'`, `fontSize: 11`, `fontWeight: 700`, `letterSpacing: 1`.

### FieldRow
Table row with `CONFIDENCE_BG[confidence]` background. Columns: field name (monospace), badge, value (word-break), source/reason (muted).

### FieldGroup
Section with h2 + subtitle p + bordered table. `marginBottom: 32` between groups.

### App layout
Max-width 900px, centered with `margin: '40px auto'`, `padding: '0 24px'`.
