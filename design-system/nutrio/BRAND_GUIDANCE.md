# Nutrio Brand Guidance

This file is the current source of truth for Nutrio customer-facing mobile UI colors and brand usage.

Use this guide before designing or updating any page under `/nutrio/*`, especially dashboard sub-pages, meal ordering, tracker, progress, AI report, live tracking, wallet, subscription, and profile screens.

## Brand Personality

Nutrio should feel:

- Mobile native, clean, and fast.
- Premium but not heavy.
- Health-focused without becoming overly green.
- Friendly and colorful, with color used to explain data.
- Clear enough for repeated daily use.

Avoid:

- One-color green screens.
- Dark cards unless the screen already uses a dark primary action area.
- Browser-native dialogs such as `window.confirm`.
- Heavy gradients, decorative blobs, or unclear glass effects.
- Cards that hide text because of low contrast.

## Core Palette

| Role | Hex | Usage |
| --- | --- | --- |
| App dark | `#020617` | Primary buttons, active tabs, main text, selected controls |
| App background | `#F6F8FB` | Page background, soft panels, input backgrounds |
| Border / track | `#E5EAF1` | Card borders, dividers, progress tracks |
| Muted text | `#94A3B8` | Secondary labels, helper text, metadata |
| Calories / progress | `#22C7A1` | Calorie rings, success progress, positive nutrition status |
| Protein / activity | `#7C83F6` | Protein, steps, AI accent, activity highlight |
| Water | `#38BDF8` | Water icons, hydration charts, water progress |
| Fat / danger | `#FB6B7A` | Fat, destructive actions, cancel, warnings |
| Carbs / energy | `#F97316` | Carbs, burn, kitchen, energy highlights |

## Soft Backgrounds

Use these with colored text/icons so the UI stays bright and readable.

| Token | Hex | Pair With |
| --- | --- | --- |
| Success soft | `#EFFFFA` | `#22C7A1` |
| Protein soft | `#F3F4FF` | `#7C83F6` |
| Water soft | `#EFF9FF` | `#38BDF8` |
| Fat soft | `#FFF0F2` | `#FB6B7A` |
| Carbs soft | `#FFF7ED` | `#F97316` |
| Neutral soft | `#F6F8FB` | `#020617` or `#94A3B8` |

## Color Mapping

Use the same semantic colors everywhere.

| Data / Feature | Primary Color | Soft Background |
| --- | --- | --- |
| Calories | `#22C7A1` | `#EFFFFA` |
| Overall progress | `#22C7A1` | `#EFFFFA` |
| Protein | `#7C83F6` | `#F3F4FF` |
| Activity / steps | `#7C83F6` | `#F3F4FF` |
| AI insight | `#7C83F6` | `#F3F4FF` |
| Water / hydration | `#38BDF8` | `#EFF9FF` |
| Fat | `#FB6B7A` | `#FFF0F2` |
| Cancel / remove | `#FB6B7A` | `#FFF0F2` |
| Carbs | `#F97316` | `#FFF7ED` |
| Calorie burn | `#F97316` | `#FFF7ED` |
| Main CTA | `#020617` | none |

## Buttons

Primary action:

```tsx
className="rounded-full bg-[#020617] text-white"
```

Secondary action:

```tsx
className="rounded-full bg-white text-[#020617] ring-1 ring-[#E5EAF1]"
```

Soft action:

```tsx
className="rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]"
```

Destructive action:

```tsx
className="rounded-full bg-[#FFF0F2] text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20"
```

For final destructive confirmation, use a filled destructive button:

```tsx
className="rounded-full bg-[#FB6B7A] text-white"
```

## Cards

Default mobile card:

```tsx
className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]"
```

Soft inner panel:

```tsx
className="rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]"
```

Metric tile:

```tsx
className="rounded-[20px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]"
```

Keep cards readable:

- Text must be `#020617` or a strong semantic color.
- Do not place white text on light glass cards.
- Do not use overly transparent backgrounds for important text.
- Use shadows lightly; rely mostly on white cards, borders, and spacing.

## Mobile Native Patterns

Use in-app mobile UI instead of browser UI:

- Bottom sheets for confirmations and choices.
- Full-width rounded buttons with at least 44px height.
- Sticky headers with white or `#F6F8FB` background.
- Native-feeling modals with a drag handle.
- Horizontal scroll for dense chips or package cards.

Do not use:

- `window.confirm`
- `window.alert`
- Tiny desktop-style buttons
- Crowded cards with overlapping buttons

## Typography

Primary font in the app is Plus Jakarta Sans.

Recommended hierarchy:

| Use | Size | Weight |
| --- | --- | --- |
| Page title | 22-28px | 900 |
| Section title | 17-20px | 900 |
| Card title | 14-16px | 800-900 |
| Label / eyebrow | 10-12px | 800-900, uppercase |
| Body text | 13-15px | 600-700 |
| Metadata | 11-13px | 600-700 |

Letter spacing should stay natural. Avoid negative letter spacing for normal UI text.

## Page Backgrounds

Customer mobile pages should usually use:

```tsx
className="min-h-screen bg-[#F6F8FB] text-[#020617]"
```

Cards should be white. Inner areas can use `#F6F8FB`.

## Navigation / Tabs

Active tab:

```tsx
className="bg-[#020617] text-white"
```

Inactive tab:

```tsx
className="bg-white text-[#64748B] ring-1 ring-[#E5EAF1]"
```

Avoid green active tabs unless the tab specifically represents progress/success.

## Charts And Progress

Tracks:

```tsx
className="bg-[#E5EAF1]"
```

Bars and rings should use the semantic data colors:

- Calories: `#22C7A1`
- Protein: `#7C83F6`
- Water: `#38BDF8`
- Fat: `#FB6B7A`
- Carbs: `#F97316`

## Icons

Use lucide-react icons when available.

Recommended color/icon mapping:

- Water: `Droplets` with `#38BDF8`
- Protein: `Drumstick` with `#7C83F6`
- Calories/progress: `Target`, `TrendingUp`, or `Flame` with `#22C7A1`
- Carbs/energy: `Wheat` or `Flame` with `#F97316`
- Fat/warning/remove: relevant icon with `#FB6B7A`
- AI: `Brain` or `Sparkles` with `#7C83F6`

## Arabic / RTL Notes

When Arabic copy appears:

- Keep the same brand colors.
- Avoid text inside narrow pills if it may wrap poorly.
- Use enough horizontal padding.
- Keep button labels short.
- Confirm screens should feel like mobile bottom sheets, not browser dialogs.

## Implementation Checklist

Before finishing a UI change:

- Background is `#F6F8FB`.
- Primary text is `#020617`.
- Secondary text is `#94A3B8`.
- Main CTA uses `#020617`.
- Data colors follow the semantic mapping.
- No green-only theme unless the page is explicitly about success/progress.
- No browser-native confirm/alert.
- Text is visible on all cards.
- Buttons are at least 44px tall.
- Cards fit mobile width without clipping or overlap.

