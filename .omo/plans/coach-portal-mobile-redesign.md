# Coach Portal — Mobile-Native Redesign Plan

**Date**: 2026-05-27
**Status**: Plan complete — awaiting approval

---

## Current State Assessment

### What exists today

| Component | Status | Mobile-ready? |
|---|---|---|
| `CoachDashboard.tsx` | Functional — client list with compliance cards, pending requests, invite flow | ❌ Desktop grid (`sm:grid-cols-2 lg:grid-cols-3`) |
| `CoachInsights.tsx` | Basic stats grid (active clients, avg adherence, streak, at-risk, macro hit) | ❌ Desktop grid |
| `CoachSettings.tsx` | Bio + specialties + privacy toggles | ❌ Form layout, no mobile spacers |
| `ApplyCoach.tsx` | Application form with status tracking | ✅ Already mobile (max-w-[480px]) |
| `CoachLayout.tsx` | Sidebar (desktop) + top bar | ❌ No mobile nav, sidebar breaks on narrow viewports |
| `useCoachClients.ts` | Full compliance engine — weight trends, adherence, macro hits, streaks, 7-day tracking | N/A (hook) |
| `useCoachChat.ts` | Rule-based AI coach — meal recommendations, progress checks, protein tips | N/A (hook) |
| `InviteClientModal.tsx` | Generate shareable invite codes | ❌ Fixed modal, not mobile-optimized |

### Critical gaps

1. **No mobile navigation** — coach portal has no bottom tab bar, trapped in desktop sidebar paradigm
2. **No client detail view** — clicking a client card shows nothing (ArrowRight is decorative)
3. **No AI coach chat UI** — the `useCoachChat` hook exists but has no UI component
4. **No client meal plan view** — coaches can see adherence % but not WHAT clients are eating
5. **Insights are bare** — stat cards only, no charts, no trends over time
6. **Invite flow is one-directional** — coaches invite via code, but no client-side request queue view
7. **No notification system** — pending requests only visible on dashboard, no push/badge

---

## Design Principles (from existing Nutrio mobile system)

- **44px min touch targets** — all interactive elements
- **24px rounded cards** — `rounded-[24px]` with `shadow-[0_10px_30px_rgba(15,23,42,0.06)]`
- **Plus Jakarta Sans font** — loaded via `<link>` in HTML
- **Gradient CTAs** — `from-emerald-600 to-teal-600` with `shadow-emerald-600/20`
- **White card sections** — `bg-white p-4 ring-1 ring-slate-100/80`
- **framer-motion spring animations** — `stiffness: 280, damping: 26`
- **max-w-[430px] for mobile** — single-column scrollable
- **safe-area-inset-bottom** — 100px+ bottom padding for tab bar
- **Color palette**: Primary emerald (#0E9F6E), Secondary navy, Accent gold, Success green, Warning amber, Destructive red
- **Status colors**: Green (`#10B981`) for good, Amber (`#F59E0B`) for warning, Red (`#EF4444`) for at-risk
- **`bg-[#F8FAFB]` page background** — consistent across all pages

---

## Architecture

### Navigation: 4-tab bottom bar (coach-specific)

```
┌──────────┬──────────┬──────────┬──────────┐
│  Clients │ Insights │   Chat   │ Settings │
│  (Users) │(BarChart)│(Message) │(Settings)│
└──────────┴──────────┬──────────┴──────────┘
           └── active tab: emerald bg pill ──┘
```

Replaces the desktop sidebar entirely. Each tab maps to a dedicated page component.

### Route structure

```
/coach                    → CoachClients (was CoachDashboard)
/coach/insights           → CoachInsights (redesigned)
/coach/chat               → CoachChat (NEW)
/coach/settings           → CoachSettings (redesigned)
/coach/client/:clientId   → CoachClientDetail (NEW)
```

### Component tree

```
CoachPortalLayout (NEW — replaces CoachLayout)
├── BottomTabBar (coach variant)
├── Route: /coach → CoachClientsPage
│   ├── ClientSummaryCard (mobile-optimized)
│   ├── PendingRequestsBanner
│   ├── AtRiskAlert
│   ├── EmptyState (no clients)
│   └── InviteModal (redesigned)
├── Route: /coach/insights → CoachInsightsPage
│   ├── StatsOverviewGrid
│   ├── WeightTrendChart
│   ├── AdherenceTrendChart
│   └── ClientBreakdownList
├── Route: /coach/chat → CoachChatPage (NEW)
│   ├── ChatMessageList
│   ├── QuickQuestionChips
│   └── ChatInput
├── Route: /coach/settings → CoachSettingsPage
│   ├── ProfileSection
│   ├── SpecialtiesPicker
│   └── PrivacyToggles
└── Route: /coach/client/:clientId → CoachClientDetailPage (NEW)
    ├── ClientHeader (avatar, name, goal, streak)
    ├── MacroComplianceCard
    ├── MealAdherenceTimeline
    ├── WeightTrendChart
    ├── WeeklyMealPlan
    └── QuickActionButtons
```

---

## Page Designs

### 1. Clients Tab (`/coach`) — Mobile Redesign

**Header**:
- Greeting: "Your Clients" with subtitle "X clients · Y active this week"
- `Invite Client` button — rounded-full emerald gradient pill, 44px tall, shadow

**Pending Requests Section** (if any):
- Horizontal scrollable row of request cards
- Each card: avatar, name, "Wants to connect", Accept/Decline buttons
- Amber background `bg-amber-50 border-amber-200`

**At-Risk Alert**:
- Red/amber banner with AlertCircle icon
- "X clients at risk of falling off" with "View" link

**Client Cards** (mobile — single column, full width):
```
┌──────────────────────────────────────────┐
│ ● Sarah M.          Weight Loss · 5d    │
│                                          │
│  ┌──────────┬──────────┬──────────┐     │
│  │   85%    │   72%    │  -1.2   │     │
│  │ Adherence│ Macro Hit│ 7d Δ kg  │     │
│  └──────────┴──────────┴──────────┘     │
│                                          │
│  🔥 12-day streak        72.4 kg →      │
└──────────────────────────────────────────┘
```
- Avatar: 48×48 rounded-full gradient emerald-to-teal
- Name: `text-[15px] font-extrabold text-slate-950`
- Goal + days tracked: `text-[11px] font-medium text-slate-500`
- Metric columns: evenly split with emerald/amber/red color coding
- Streak bar: bg-slate-50 border-t, flame icon amber, weight on right
- Entire card tappable → navigates to `/coach/client/:id`

**Empty State**:
- Large Users icon in emerald-50 rounded-2xl
- "No clients yet" heading
- Description text
- "Invite First Client" CTA button

### 2. Client Detail (`/coach/client/:clientId`) — NEW

**Header**:
- Back button (44px circle)
- Client avatar (64×64 rounded-full, gradient)
- Name, goal type, subscription plan
- "X-day streak" badge with flame icon
- Macro compliance ring (SVG ring showing adherence %)

**Macro Overview Cards**:
- 3-column grid: Calories consumed/target, Protein consumed/target, Carbs/Fat consumed/target
- Each with mini progress bar (colored bg with dynamic width)

**Meal Adherence Timeline** (7-day):
- Horizontal scrollable row of day cards
- Each day: Mon-Sun label + adherence % + color dot (green/amber/red)
- Today highlighted with emerald border

**Weight Trend**:
- Simple sparkline or 7-entry list showing date + weight
- Trend indicator (up/down arrow with kg change)

**Weekly Meal Plan**:
- If client has active meal schedules, show upcoming meals
- Each meal card: meal name, restaurant, macros, scheduled time

**Quick Actions**:
- "Send Check-in" → opens chat
- "Adjust Goals" → opens goal editor modal
- "View Full History" → links to full progress view

### 3. Insights Tab (`/coach/insights`) — Redesign

**Stats Overview** (2-column grid, mobile):
```
┌──────────────┬──────────────┐
│ Active       │ Avg Adherence│
│ 12 clients   │     78%      │
│ / 15 total   │   ▲ +3%      │
├──────────────┼──────────────┤
│ Avg Streak   │  At Risk     │
│   8.5 days   │    2 clients │
├──────────────┼──────────────┤
│ Losing       │  Gaining     │
│  5 clients   │  3 clients   │
└──────────────┴──────────────┘
```
- Each card: white bg, 16px rounded, icon + number + label
- Color coding: emerald for positive, amber for warning, red for at-risk

**Weight Trends Section**:
- Horizontal bar: green (losing), red (gaining), gray (stable)
- Each segment shows count

**Client Breakdown List**:
- Sorted by adherence (lowest first for attention)
- Each row: avatar, name, adherence %, streak, weight trend arrow

### 4. AI Coach Chat (`/coach/chat`) — NEW

Leverages existing `useCoachChat` hook. Mobile-native chat interface.

**Layout**:
- Standard chat UI: message bubbles, input at bottom
- Coach messages: left-aligned, emerald-50 bg, rounded-2xl
- User messages: right-aligned, emerald-600 bg, white text
- Timestamps in `text-[10px] text-slate-400`

**Quick Questions** (above input):
- Horizontal scrollable chip row
- 4 chips: "What should I eat today?", "How am I doing?", "Tips for more protein?", "Am I on track?"

**Input Bar**:
- Fixed bottom, rounded-full, emerald border on focus
- Send button: 44×44 emerald circle with Send icon
- Safe area padding

**State Handling**:
- Empty: Welcome message with tips
- Loading: "Coach is thinking..." animated dots
- Error: "Couldn't reach coach. Try again." with retry

### 5. Settings Tab (`/coach/settings`) — Redesign

**Profile Section** (white card, `rounded-[24px]`):
- Avatar upload (tap to change)
- Display name (editable)
- Bio textarea (4 rows, rounded-xl)
- Save button at bottom

**Specialties Section**:
- Grid of toggle chips (2-column on mobile)
- Active: emerald-100 bg, emerald-700 text, emerald-300 border
- Inactive: slate-50 bg, slate-500 text, slate-200 border
- "Add custom" input at bottom

**Privacy & Permissions**:
- 3 toggle switches with labels:
  - Macro intake
  - Weight & body metrics
  - Meal adherence
- Each with description text
- Emerald toggle (animated spring)

**Danger Zone** (at bottom):
- "Stop Coaching" button — red outline, confirmation dialog
- "Delete Account" link — muted, small text

---

## Technical Implementation Plan

### Phase 1: Layout & Navigation (foundation)
- [ ] Create `CoachPortalLayout.tsx` — mobile-native wrapper with bottom tab bar
- [ ] Create `CoachBottomTabBar.tsx` — 4-tab navigation (Clients, Insights, Chat, Settings)
- [ ] Update `App.tsx` routes — replace CoachLayout with CoachPortalLayout
- [ ] Remove desktop sidebar from CoachLayout (keep as fallback)

### Phase 2: Clients Tab
- [ ] Redesign `CoachDashboard.tsx` → `CoachClientsPage.tsx` with mobile cards
- [ ] Create `ClientSummaryCard.tsx` — full-width mobile card component
- [ ] Redesign `InviteClientModal.tsx` to bottom sheet style
- [ ] Optimize `useCoachClients.ts` — add `ClientCompliance` type export

### Phase 3: Client Detail (NEW)
- [ ] Create `CoachClientDetailPage.tsx` — route: `/coach/client/:clientId`
- [ ] Fetch single client data with full 7-day history
- [ ] Create `MacroComplianceCard.tsx` — ring progress + target vs actual
- [ ] Create `MealAdherenceTimeline.tsx` — horizontal 7-day scroll
- [ ] Create `WeightTrendSparkline.tsx` — simple weight visualization

### Phase 4: Insights Tab
- [ ] Redesign `CoachInsights.tsx` with 2-column mobile grid
- [ ] Add trend indicators (up/down arrows with %)
- [ ] Add client breakdown list (sorted by adherence)

### Phase 5: AI Coach Chat (NEW)
- [ ] Create `CoachChatPage.tsx` — chat UI with `useCoachChat` hook
- [ ] Create `ChatMessageBubble.tsx` — coach and user message styles
- [ ] Create `QuickQuestionChips.tsx` — horizontal scrollable suggestions
- [ ] Wire up nutrition snapshot data provider for chat context

### Phase 6: Settings Tab
- [ ] Redesign `CoachSettings.tsx` with mobile-friendly layout
- [ ] Add avatar upload capability
- [ ] Add danger zone section

### Phase 7: Polish & QA
- [ ] Loading skeletons for all pages (matching Nutrio's skeleton patterns)
- [ ] Empty states for all pages
- [ ] Error states with retry buttons
- [ ] Animation polish (staggered card reveals, spring transitions)
- [ ] Safe area insets on all pages
- [ ] 44px minimum touch targets throughout

---

## Files to Create

| File | Purpose |
|---|---|
| `src/components/coach/CoachPortalLayout.tsx` | Mobile-native layout wrapper |
| `src/components/coach/CoachBottomTabBar.tsx` | 4-tab coach navigation |
| `src/pages/coach/CoachClientsPage.tsx` | Redesigned client list (rename from CoachDashboard) |
| `src/components/coach/ClientSummaryCard.tsx` | Mobile client card |
| `src/pages/coach/CoachClientDetailPage.tsx` | Single client deep-dive |
| `src/components/coach/MacroComplianceCard.tsx` | Ring progress + macro targets |
| `src/components/coach/MealAdherenceTimeline.tsx` | 7-day horizontal scroll |
| `src/components/coach/WeightTrendSparkline.tsx` | Simple weight visualization |
| `src/pages/coach/CoachChatPage.tsx` | AI coach chat UI |
| `src/components/coach/ChatMessageBubble.tsx` | Chat message component |
| `src/components/coach/QuickQuestionChips.tsx` | Pre-written question chips |

## Files to Modify

| File | Changes |
|---|---|
| `src/App.tsx` | Update coach routes, replace CoachLayout |
| `src/components/coach/CoachLayout.tsx` | Keep as desktop fallback, add mobile detection |
| `src/pages/coach/CoachDashboard.tsx` | Refactor into CoachClientsPage |
| `src/pages/coach/CoachInsights.tsx` | Mobile redesign |
| `src/pages/coach/CoachSettings.tsx` | Mobile redesign |
| `src/components/coach/InviteClientModal.tsx` | Bottom sheet redesign |
| `src/pages/auth/useAuthPage.ts` | Coach redirect (already fixed) |

---

## Design Tokens Reference (from existing Nutrio system)

```css
/* Cards */
rounded-[24px] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80

/* Section headers */
text-[15px] font-extrabold tracking-[-0.02em] text-slate-950

/* Subtitle text */
text-[11px] font-medium text-slate-500

/* Gradient buttons (emerald) */
bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-lg shadow-emerald-600/20

/* Gradient buttons (violet - for coach-specific) */
bg-gradient-to-r from-violet-600 to-purple-600

/* Page background */
bg-[#F8FAFB] min-h-screen

/* Metric numbers */
text-lg font-extrabold text-slate-950

/* Status - good */
text-emerald-600 bg-emerald-50

/* Status - warning */
text-amber-600 bg-amber-50

/* Status - danger */
text-red-500 bg-red-50

/* Bottom nav spacing */
pb-[calc(100px+env(safe-area-inset-bottom,16px))]

/* Avatars */
w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100

/* Section spacing */
mt-5 (between cards)
space-y-3 (between items within a section)
```

---

## Estimated Effort

| Phase | Complexity | Est. Lines |
|---|---|---|
| Phase 1: Layout & Navigation | Medium | ~300 |
| Phase 2: Clients Tab | Medium | ~400 |
| Phase 3: Client Detail | High | ~600 |
| Phase 4: Insights Tab | Low | ~200 |
| Phase 5: AI Chat | Medium | ~350 |
| Phase 6: Settings Tab | Low | ~150 |
| Phase 7: Polish | Medium | ~200 |
| **Total** | | **~2,200 lines** |
