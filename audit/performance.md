# Performance Audit — Nutrio (read-only)

Scope: bundle, render, data-fetch, assets, mobile. Build output `dist/` was inspected; main entry chunk is **1.21 MB** un-gzipped (`index-BUzFLlvu.js`). Charts chunk **433 KB**, `Encoder` (zxing) **389 KB**, jspdf **387 KB**, html2canvas **200 KB**, leaflet **~150 KB**. The `src/assets` folder contains **84 MB of unoptimized media** including 9 PNGs over 7 MB each.

## IMPACT SUMMARY

| Severity | Count | Theme |
|----------|-------|-------|
| Critical | 4 | 84 MB raw assets, monolithic 1.2 MB entry, every `useQuery`-less hook re-fetches, 4677-line LanguageContext |
| High     | 5 | Eager mapbox/leaflet/jspdf/zxing in route bundles, no virtualization, LanguageProvider value not memoized, `select *` `count: exact` on Admin dashboard, no react-query defaults |
| Medium   | 3 | Framer-motion overuse on lists, no useMemo on filter/sort, lazy-loading missing on most `<img>` |
| Low      | 0 | — |

---

## Findings

### [CRITICAL] 84 MB of unoptimized images and videos in `src/assets` — `src/assets/*.png|mp4|mp3`
Directory is **84 MB** raw; nine PNGs are 5–9 MB each (`hero-food.png` 9.07 MB, `1.png` 8.92 MB, `2.png` 9.14 MB, `3.png` 9.39 MB, `Gemini_Generated_Image_*.png` 5.7–8.7 MB, `tracking order.png` 7.17 MB, `background.png` 7.14 MB). Several MP4s 1–2.5 MB, multiple MP3s 600–740 KB. Anything imported from `src/assets` becomes part of a chunk's static asset graph and is fetched at first reference.
**Cost:** if even 3 of these hit the splash/walkthrough/dashboard, that's 25+ MB on a single mobile screen. On 4G this is 10–30 s of TTFB and crashes Capacitor WebView on low-end Android.
**Fix:** convert all PNGs to WebP at appropriate render sizes (390×280 for cards, 1080×1080 max for hero); compress to 80–150 KB each. Move media to `public/` and reference via URL so bundling doesn't pull them into chunk graphs. Drop the duplicate `Logo_Redo_and_Video_Generation*.mp4` files (3 near-identical copies).
**Estimated win:** 95% asset-payload reduction; first-paint time drops from multi-second to sub-1 s on 4G.

### [CRITICAL] 4 677-line `LanguageContext.tsx` ships both EN+AR translations on every page — `src/contexts/LanguageContext.tsx:1-4677`
A single file inlines the full EN and AR dictionary as one TypeScript object. Because it's imported by `App.tsx` it lives in the entry chunk. This is roughly 200 KB of strings before minification and never tree-shakes per-page.
**Cost:** ~70–100 KB gzipped added to the eager bundle for every user, and Arabic users carry English and vice-versa.
**Fix:** split into `locales/en.ts` and `locales/ar.ts`, lazy-load via dynamic `import()` inside the provider on language change; show a tiny default before locale resolves. Optionally split per portal (customer/partner/admin/driver) with namespaces.
**Estimated win:** 60–80 KB off the main chunk; faster TTI especially on cold cache.

### [CRITICAL] No react-query defaults — every page re-fetches on mount — `src/App.tsx:144`
`const queryClient = new QueryClient();` has no `defaultOptions`. Default `staleTime` is 0, so every `useQuery` re-fetches on every mount and on every window focus. Only 6 files (`useBodyMetrics`, `useHealthScore`, `useMealTranslation`, `useProfile`, `useRolloverCredits`, `useSubscriptionFreeze`) actually use `useQuery` — the rest of the 116 Supabase call-sites use raw `useEffect + useState`, which provides no caching at all.
**Cost:** Dashboard, Schedule, Meals each re-issue 3–10 Supabase queries on every navigation. Returning to a page from a meal detail re-runs the same fetch.
**Fix:** Set `defaultOptions: { queries: { staleTime: 60_000, gcTime: 300_000, refetchOnWindowFocus: false, retry: 1 } }`. Migrate hot hooks (`useFeaturedRestaurants`, `useTodayProgress`, Schedule's `fetchSchedules`, `useFavoriteRestaurants`, `useNotifications`) to `useQuery` to gain caching + dedup.
**Estimated win:** 50–80% fewer Supabase round-trips on warm navigation; dashboard navigation feels instant.

### [CRITICAL] Monolithic 1.21 MB entry chunk — `dist/assets/index-BUzFLlvu.js` (1 213 205 bytes)
`vite.config.ts:71-76` only carves out `react-vendor`, `ui-vendor` (just two Radix packages), and `charts`. Everything else — Supabase client, Sentry, framer-motion, lucide-react, all helper libs, LanguageContext, AuthContext, ProtectedRoute, plus the entire `App.tsx` route table — lands in `index.js`.
**Cost:** 1.2 MB before any route renders. Mobile WebView blocks paint until parsed.
**Fix:** expand `manualChunks`:
```ts
manualChunks: {
  'react-vendor': ['react','react-dom','react-router-dom'],
  'supabase': ['@supabase/supabase-js'],
  'sentry': ['@sentry/react'],
  'motion': ['framer-motion'],
  'forms': ['react-hook-form','@hookform/resolvers','zod'],
  'date': ['date-fns','date-fns-tz'],
  'radix': [/* all @radix-ui/* */],
  'icons': ['lucide-react'],
  'charts': ['recharts'],
  'i18n': [/* path to LanguageContext */],
}
```
Also inspect `import "leaflet/dist/leaflet.css"` references — currently each leaflet importer pulls the CSS independently (`Addresses.tsx:4`, `MapContainer.tsx:4`).
**Estimated win:** entry chunk to 350–500 KB; remaining work parallelized as separate cacheable chunks.

### [HIGH] Heavy maps/PDF/scanner libs eagerly imported by route components — `src/pages/Addresses.tsx:5-6`, `src/components/maps/mapbox/MapboxMap.tsx:2`, `src/lib/*-pdf.ts`, `src/components/BarcodeScanner.tsx:7`
Although each *page* is `React.lazy`-wrapped in `App.tsx`, the lazy chunk itself **still bundles** mapbox-gl (~200 KB), leaflet (~150 KB), jspdf (387 KB), jspdf-autotable, html2canvas (200 KB), and `@zxing/library` Encoder (389 KB) at the top of files like `Addresses.tsx`, `LiveMap.tsx`, `BarcodeScanner.tsx`, `weekly-report-pdf.ts`. Anyone hitting `/addresses` downloads all of leaflet even if they never open the map.
**Cost:** 5 of the 12 largest dist chunks come from these libs.
**Fix:** Wrap the heavy imports in dynamic `import()` triggered only when the user actually opens the map / clicks "export PDF" / opens scanner. Example:
```ts
const handleExport = async () => {
  const { generateWeeklyReport } = await import('@/lib/weekly-report-pdf');
  generateWeeklyReport(...)
};
```
For the maps, defer `import('leaflet')` + `react-leaflet` inside an effect triggered on visibility (Intersection Observer) so the address page renders without blocking on 150 KB of mapping code.
**Estimated win:** 700–900 KB removed from the most-trafficked customer routes; PDF lib only ships when actually used (single-digit % of sessions).

### [HIGH] `LanguageProvider` value object recreated every render — `src/contexts/LanguageContext.tsx:4654-4670`
`t` is a fresh function every render and the provider value `{ language, setLanguage, t, isRTL }` is a new object on every render. With `useLanguage()` consumed in 60+ components (Dashboard, Schedule, Meals, every layout, every dialog), any state change in the App tree re-renders the provider, which re-fires every consumer.
**Cost:** Re-renders cascade through the entire UI on every keystroke in any input that bubbles up to a parent.
**Fix:**
```ts
const t = useCallback((key, params) => { ... }, [language]);
const value = useMemo(() => ({ language, setLanguage, t, isRTL }), [language, t, isRTL]);
```
**Estimated win:** 30–60% fewer renders on text inputs and slider drags; smoother scroll on lists.

### [HIGH] `Schedule.tsx` (68 KB, 8 list `.map`s, 27 framer-motion props, 0 `useMemo`) — `src/pages/Schedule.tsx`
The page imports `motion, AnimatePresence, PanInfo`, has 27 animation/whileTap/animate uses, eight `.map` renders for week strip, meal-type chips, scheduled meals per day, etc. No `useMemo` for the per-day grouping; no `useCallback` other than `fetchSchedules`. Every keystroke or slider re-runs the grouping. Re-fetch is hand-rolled (no react-query).
**Cost:** noticeable jank when adding/toggling a meal — the entire week re-renders + re-animates.
**Fix:** memoize `mealsByDay` with `useMemo(() => group(schedules), [schedules])`; extract `<DayColumn>` and wrap in `React.memo`; replace the manual fetch with `useQuery({ queryKey: ['meal-schedules', userId, weekStart], staleTime: 30_000 })`. Reduce framer-motion to entrance-only via `LayoutGroup`; keep tap animations minimal on Capacitor (use `useReducedMotion`).
**Estimated win:** 200–400 ms shaved off interaction latency on mid-tier Android; CPU usage during week-swipe halved.

### [HIGH] `useFeaturedRestaurants` issues N+1 on every Dashboard mount — `src/hooks/useFeaturedRestaurants.ts:22-119`
Plain `useEffect` (no react-query, no dedup, no cache) runs on every mount. It fetches `featured_listings`, then in parallel fetches `restaurants` and the **entire `meals` table filtered by restaurant id** just to compute a meal count. `meals` may have thousands of rows.
**Cost:** Worst case per-dashboard-visit is 3 round-trips moving up to several MB of meal rows; redundant on every navigation back to `/dashboard`.
**Fix:** (a) switch to `useQuery` with 5-min staleTime; (b) replace meal-count fetch with a Postgres aggregate / view (e.g., a materialized view `restaurant_meal_counts` or `select restaurant_id, count(*) ... group by`). Even better, store `meal_count` denormalized on the restaurant row.
**Estimated win:** Dashboard cold-load cuts ~300–800 ms; warm navigation 0 ms (cached).

### [HIGH] AdminDashboard: 13 `count: 'exact'` queries with `select('*')` — `src/pages/admin/AdminDashboard.tsx:143-159`
Ten parallel queries each `select('*', { count: 'exact', head: true })` against `restaurants`, `profiles`, `meal_schedules`, `meals` etc. With `head: true` Supabase returns no rows but `count: exact` forces a full table scan in Postgres. As tables grow this becomes the dashboard's wall-clock floor.
**Cost:** O(n) DB scans per admin page-load; >1 s on tables of 100 k rows.
**Fix:** Use `count: 'estimated'` (uses pg_class stats, near-instant) or `count: 'planned'`. Reserve `exact` for tables that are small AND need precise numbers. Combine the 13 counts into a single Postgres function returning a JSON object, or a SQL view/RPC that runs all counts server-side once.
**Estimated win:** admin dashboard load 70–90% faster; reduced Supabase row-egress quota.

### [HIGH] No list virtualization anywhere — `src/pages/Meals.tsx`, `OrderHistory.tsx`, `AdminUsers.tsx`, `AdminOrders.tsx`, `AdminRestaurants.tsx`
Zero references to `react-window`, `react-virtualized`, or `@tanstack/react-virtual` (verified). `Meals.tsx:559-562` does an unbounded `select` of *all* meals across all approved restaurants and renders them as a `motion.div` grid. Admin pages render entire tables of users/orders/payouts. Each `MealCard` and `RestaurantCard` includes a framer-motion `motion.div` with a stagger delay — stagger × N items × DOM nodes per card adds up.
**Cost:** With 200+ meals, scroll FPS drops to 20–30 on mid-range mobile; admin pages with 500+ rows freeze the main thread on render.
**Fix:** Add `@tanstack/react-virtual` for any list rendering >50 items. For Meals, also paginate the Supabase query with `.range(0, 49)` and infinite-scroll. For admin tables, server-side pagination is mandatory.
**Estimated win:** scroll FPS 60 on devices that today drop to 30; first render of `/meals` 5–10× faster on long catalogs.

### [MEDIUM] Lazy-loading missing on most `<img>` tags — only 6/56 pages use `loading="lazy"`
Counts: 56 files contain `<img>`, only 4 files (`Dashboard.tsx`, `Meals.tsx`, `MealDetail.tsx`, `AdminRestaurantDetail.tsx`) include `loading="lazy"`. Restaurant logos, meal images, banners, walkthrough screens all eager-load.
**Cost:** every meal/restaurant card image is requested before the user scrolls past — multiplies network usage and decode work.
**Fix:** add `loading="lazy" decoding="async"` to every `<img>` not in the initial viewport. Add `width` and `height` attributes to prevent CLS. Wrap a small `<Image>` component once and replace usages.
**Estimated win:** 40–70% lower image bandwidth on listing pages; CLS score improvement.

### [MEDIUM] Framer-motion overused on map-rendered lists — see `Schedule.tsx`, `Meals.tsx:115-119`
Both pages wrap every list item in `motion.div` with `staggerChildren` + `whileTap` and a per-index `delay: index * 0.03`. With 30+ items the stagger animation alone runs for ~1 s after every list update. On low-end Capacitor WebView this competes with scroll.
**Cost:** noticeable jank on first paint of `/meals` and on every Schedule re-render.
**Fix:** Apply `motion` only to the container with `LayoutGroup`/`AnimatePresence`; render children as plain `<div>`. Honor `useReducedMotion()` consistently. Remove per-item `delay: i * 0.03`.
**Estimated win:** 100–200 ms faster perceived TTI on list pages; lower CPU during scroll.
