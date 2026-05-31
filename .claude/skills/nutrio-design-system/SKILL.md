---
name: nutrio-design-system
description: Unified design system for Nutrio — applied patterns from Airbnb, Linear, Stripe, and Spotify. Use when redesigning any page or component in the Nutrio app. Applies single accent (emerald), surface ladder, pill geometry, and subtle shadow patterns. Triggers on: "redesign", "update design", "apply design system", "unified design", "make it look like the rest of the app".
---

# Nutrio Design System

Unified design language applied across all Nutrio pages. Derived from top-company DESIGN.md patterns (Airbnb, Linear, Stripe, Spotify).

## Core Principles

1. **Single accent color** — Emerald (`emerald-500`/`#10B981`) is the only chromatic accent. Used ONLY for CTAs, progress bars, active states, and key indicators. Never decorative.
2. **Surface ladder** — Canvas (`#F8FAFC`) → White cards → Tinted Surface 2 (`#F0FDF6` emerald-tinted) → Dark surface (`#0F172A` navy for hero cards).
3. **Pill geometry** — All interactive buttons/CTAs use `rounded-full`. Tabs use segmented pill controls (`bg-slate-100` track + white active tab).
4. **Subtle shadows** — One shadow tier: `shadow-[0_1px_3px_rgba(15,23,42,0.04)]`. Cards use `ring-1 ring-slate-100` instead of `border`. Never heavy drop shadows.
5. **Content-first** — UI recedes so content (images, numbers, data) carries visual weight.

## Color Tokens

| Role | Value |
|------|-------|
| Page background | `bg-[#F8FAFC]` |
| Card surface | `bg-white` |
| Tinted surface | `bg-[#F0FDF6]` |
| Dark surface (hero) | `bg-[#0F172A]` |
| Primary text | `text-slate-900` |
| Secondary text | `text-slate-500` |
| Tertiary text | `text-slate-400` |
| Accent (emerald) | `emerald-500` / `emerald-600` |
| Accent bg | `bg-emerald-50` |
| Accent ring | `ring-emerald-100` |
| Reward (amber) | `amber-400` / `amber-500` / `amber-600` |
| Error (red) | `red-500` |
| Border/separation | `ring-slate-100` / `bg-slate-100` |

## Card Pattern

Replace ALL instances of `border border-gray-100 shadow-sm` (or any border + shadow variant) with:

```
rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100
```

## Button Patterns

Primary CTA:
```
rounded-full bg-emerald-500 text-white font-extrabold shadow-[0_4px_12px_rgba(16,185,129,0.25)] hover:bg-emerald-600
```

Secondary:
```
rounded-full bg-white text-slate-600 font-bold ring-1 ring-slate-200 hover:bg-slate-50
```

Tinted:
```
rounded-full bg-emerald-50 text-emerald-600 font-bold hover:bg-emerald-100
```

## Tab Pattern (Segmented Control)

```
<div className="flex gap-1 bg-slate-100 rounded-full p-1">
  {active ? "bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)] text-slate-900" : "text-slate-500"}
</div>
```

## Section Headers

```
<div className="mb-3 flex items-center gap-2">
  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{LABEL}</span>
  <div className="h-px flex-1 bg-slate-100" />
</div>
```

## Color Replacement Map (find → replace)

When encountering hardcoded hex colors, replace with:

| Old Pattern | Replace With |
|-------------|-------------|
| `#151D2B`, `#071428`, `#101B2D` | `text-slate-900` |
| `#748096`, `#808A9C`, `#5E6A80` | `text-slate-500` |
| `#98A2B4`, `#939CAE`, `#7E899B` | `text-slate-400` |
| `#009F63`, `#11C884`, `#00AE78` | `emerald-500` |
| `#03A96E`, `#04A96F`, `#00A96E` | `emerald-600` |
| `#14CF8A`, `#58D79E` | `emerald-400` |
| `#E8ECF2`, `#EEF1F5`, `#EDF0F4` | `ring-slate-100` |
| `#EDF0F5` | `bg-slate-100` |
| `#D8F8E5`, `#DDF8E5` | `bg-emerald-50` |
| `#FFF0CF` | `bg-amber-50` |
| `#E5EEFF` | `bg-blue-50` |
| `#F6A400` | `amber-500` |
| `#F5D66E` | `amber-400` |
| `#2F7BEA` | `blue-500` |
| `#FCFCFB` | `white` |
| `#06242B`, `#063036`, `#087057` | `#0F172A` (navy dark surface) |

## Do's

- Use emerald ONLY for CTAs, progress, active states
- Use `ring-1 ring-slate-100` for card borders
- Use `rounded-full` for all interactive buttons
- Use `rounded-2xl` for cards
- Use the surface ladder (canvas → white → tinted → dark) for hierarchy
- Preserve `dark:` variants when they exist

## Don'ts

- Don't use `border border-gray-100 shadow-sm` for cards
- Don't use heavy shadows (`shadow-lg`, `shadow-xl`)
- Don't introduce new accent colors beyond emerald
- Don't use hardcoded hex colors — use the replacement map above
- Don't change business logic or component behavior

## Reference Files

See `references/` for source DESIGN.md patterns:
- `airbnb.md` — Single accent, pill shapes, photography-driven, generous whitespace
- `linear.md` — Near-black canvas, surface ladder, single lavender accent, precise
- `stripe.md` — Subtle gradients, editorial, weight-300 elegance
- `spotify.md` — Content-first darkness, pill geometry, single green accent
