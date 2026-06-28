# SchoolPilot brand assets

Official logos copied from `src/img/` into this folder for Next.js static serving.

| File | Source | Use |
|------|--------|-----|
| `mark.png` | icon only.png | Favicon, compact nav (`size="sm"`) |
| `wordmark-dark.png` | horrizontal.png | Light backgrounds — footer, scrolled navbar |
| `wordmark-light.png` | dark bg .png | Dark backgrounds — hero header, login |
| `primary.png` | primary.png | Stacked logo — hero card, marketing |
| `app-icon.png` | app icon.png | PWA / Apple touch icon |
| `monochrome.png` | monochrome.png | Print / single-color contexts |

## Color palette

| Token | Hex | Usage |
|-------|-----|--------|
| Royal | `#2563EB` | Primary actions, links, "Pilot" accent |
| Navy | `#0F172A` | Headings, dark sections, "School" text |
| Gold | `#F59E0B` | CTAs, highlights, badges |
| Green | `#10B981` | Success, stats, positive states |
| Light | `#F8FAFC` | Page background, cards on dark hero |

Configured in `styles/globals.css` as CSS variables and `lib/design-tokens.ts`.
