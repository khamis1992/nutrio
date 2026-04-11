# Nutrio Strategy Summary

> Compiled from 6 internal documents (March 2026). Covers the evolution from "NutriFuel" (meal-only) to "Nutrio" (lifestyle platform).

---

## 1. Current Planned Features

### Core Nutrition (Built/In Progress)
- Daily meal delivery from 20+ curated restaurant partners (multi-restaurant marketplace model)
- AI-powered meal recommendations (via OpenRouter API)
- Custom macros input + auto menu generation
- Meal customization/swapping UI
- High-protein meal variants
- Nutrition tracking: calories, macros, water, steps, weight
- Health scoring and progress dashboard
- Bilingual app (EN/AR, Arabic ~40% complete)
- GPS delivery tracking with own fleet
- Snoonu delivery integration (in DB schema)
- WhatsApp notifications + push + SMS + email
- 5-star restaurant rating system with feedback loops

### Lifestyle Features (Planned — Privilee-inspired)
- **Gym access**: QR check-in at partner gyms, off-peak hour utilization
- **Recovery credits**: Spa, cryotherapy, massage sessions (monthly credits)
- **Healthy dining discounts**: 15-25% off at partner restaurants
- **Dietitian access**: Video consultations + WhatsApp support (2-3 licensed dietitians, initially part-time)
- **Health intelligence**: Blood work integration, wearable sync (Apple Health, Garmin, Whoop), AI lifestyle recommendations
- **Gamification**: Streaks, challenges, leaderboards

### Platform Architecture
- React 18 + TypeScript + Vite (frontend), Capacitor (mobile)
- Supabase (Postgres + Auth + Realtime)
- Sadad payment gateway (Qatar)
- 4 portals: Customer, Partner (restaurants), Admin, Driver
- IP geo-restriction to Qatar
- Production readiness self-assessed at 94/100

---

## 2. Membership Tiers & Pricing

There are **two pricing models** across documents (food-only vs. lifestyle). The lifestyle model supersedes the food-only model.

### Lifestyle Membership Tiers (Nutrio)

| Tier | Monthly (QAR) | Meals | Gym | Recovery | Dining | Dietitian | Target |
|------|--------------|-------|-----|----------|--------|-----------|--------|
| **Lean** | 1,800 | 2/day | — | — | — | — | Budget-conscious |
| **Core** | 3,200 | 3/day + snack | 30% discount | — | 15% off | — | "Calo switchers" |
| **Pro** | 4,800 | 3/day + snack | 12 visits/mo included | 2 credits/mo | 20% off | Monthly video call | Gym-goers, "Privilee + food" |
| **Elite** | 7,500 | 4 premium meals/day | Unlimited | 4 credits/mo | 25% off + priority | Dedicated + blood work | High-income executives |
| **Family** | 10,000 | 2 adults + 2 kids | Family access | 4 credits/mo | Family dining | — | Families (no competitor offers this) |
| **Corporate** | 2,500/employee | Core plan | Gym discounts | — | Dining discounts | — | B2B (QNB, Ooredoo, QSTP) |

### Food-Only Tiers (NutriFuel — earlier model)

| Tier | Monthly (QAR) | Meals | Snacks |
|------|--------------|-------|--------|
| Weekly Boost | 750 | 5 | 5 |
| Fresh Start | 3,200 → recommended 2,800 | 25 | 20 |
| Healthy Balance | 4,500 → recommended 3,800 | 45 | 30 |
| Elite | 5,800 → recommended 5,200 | 70 | 40 |

### Revenue Add-ons
- Dietitian chat: 300 QAR/month
- Priority delivery: 150 QAR/month
- Family add-on: 500 QAR/month (15% discount for second person)
- Featured restaurant listings: 2,500 QAR/month
- Premium analytics for partners: 1,000 QAR/month
- Affiliate commissions from gym/wellness referrals: 2-10%

### Unit Economics (Food-Only Model)
- Average profit/customer: 2,052 QAR/month (53% margin)
- Break-even: 4 customers
- Meal cost to restaurants: ~40 QAR/meal
- Delivery cost: 214 QAR/customer (1,500 QAR car lease ÷ 7 customers)
- Net delivery profit: 86 QAR/customer

---

## 3. Key Differentiators

1. **Multi-restaurant variety** — No competitor offers meals from 20+ restaurants. Solves #1 subscriber complaint: menu fatigue (bored after 3-4 weeks on single-kitchen services)
2. **Food + Lifestyle bundle** — Nobody combines food delivery with gym/recovery/dining. Privilee does lifestyle but no food; Calo does food but no lifestyle
3. **AI personalization** — Taste preference engine, auto-curated weekly menus, adaptive nutrition goals. No competitor has this
4. **Same-day ordering** — Up to 2 hours before meal time (Calo: 48hr, Right Bite: 36hr)
5. **Family plans** — Blue ocean: no competitor offers family nutrition under one subscription
6. **Corporate B2B wellness** — Zero-admin HR model (copied from Privilee playbook)
7. **Health intelligence moat** — Blood work + wearables + AI = long-term data advantage competitors can't easily replicate
8. **Own delivery fleet** — Freelance drivers with company cars, controlled experience vs. third-party dependency

---

## 4. Competitor Weaknesses Identified

### Calo (Biggest Threat)
- Food quality "good not great" — functional, not premium
- No dietitian consultations
- No family plans, no blood work, no medical integration
- Limited Arabic premium cuisine
- Chat-only customer service (no video/personal touch)
- Single kitchen = limited cuisine diversity
- 48-hour advance ordering required
- Menu fatigue after 3-4 weeks
- No AI personalization
- No gym/spa/dining lifestyle benefits
- Slow to innovate (menu hasn't changed much in 2+ years)

### Right Bite
- NOT available in Qatar (UAE + KSA only)
- Part of Kitopi (cloud kitchen) — dependency risk
- Higher price without clear premium justification
- Website has 404 errors on meal plans page
- Perceived as "medical/diet" not "lifestyle"
- 36-hour minimum for changes

### Kcal Life
- UAE-focused, limited Qatar/Kuwait delivery
- Less polished app than Calo
- Poor SEO/visibility (heavy JS website)

### Local Players
- Very limited menus (5-15 options)
- No technology platform (WhatsApp ordering)
- No nutrition tracking
- Inconsistent quality and delivery
- Not scalable

### Privilee (Lifestyle Competitor)
- NO food delivery — tells you WHERE to go but doesn't feed you
- No nutrition tracking, no dietitian access, no meal customization
- No family plans, no medical/condition-specific plans
- No health data integration
- **Risk**: They could add food partnerships — mitigation is first-mover speed

---

## 5. Gaps Already Identified in Documents

### Critical Product Gaps
1. **No dietitian layer** — Right Bite and Kcal both include this; Nutrio plans it but hasn't built it
2. **No custom macros** — Calo has this; planned for Nutrio
3. **No meal customization/swapping** — Planned but not built
4. **No ingredient editing** — Calo lets you remove components
5. **No high-protein variants** — Planned but not built
6. **No snacks category** — In DB but not confirmed live
7. **No body assessment tool** — Kcal has this
8. **No medical/condition-specific plans** — Diabetic, postnatal (Right Bite has these)
9. **No kids/teen meal categories** — Family plan depends on this
10. **Arabic translation only ~40% complete** — Critical for Qatar market

### Operational Gaps
11. **No restaurants signed yet** — 20+ needed at launch
12. **No gym partners signed yet** — 5-10 target for launch
13. **No recovery center partners** — Planned for Phase 2
14. **No dietitians hired** — Need 2-3 (part-time initially)
15. **No delivery fleet operational** — 3-5 cars needed at launch
16. **Credits system not built** — DB schema designed but not implemented
17. **Corporate wellness portal not built** — Planned for Month 5-6
18. **No lab partnerships for blood work** — Planned for Month 7+

### Strategic Gaps
19. **Brand name inconsistency** — Documents use both "NutriFuel" and "Nutrio" (lifestyle rebrand)
20. **Pricing not finalized** — Two different pricing models exist; food-only model needs to align with lifestyle tiers
21. **Per-meal cost higher than competitors** — 74-150 QAR vs Calo's ~37-47 QAR (justified by variety but unproven with customers)
22. **No market validation** — Zero customers, zero restaurant partners, zero revenue
23. **Kuwait market entry untested** — Planned for Month 5-6 or post-Qatar validation
24. **No exclusivity agreements with restaurants** — Competitors could sign same partners

---

## 6. Go-to-Market Strategy

### Phase 1: Foundation (Month 1-3)
- Fix meal subscription core (swap, custom macros, HP variants)
- Sign 5-10 gym partners + 10-15 restaurant partners in Doha
- Pre-launch waitlist via Instagram/TikTok
- Target: 100 subscribers in first month

### Phase 2: Growth (Month 4-6)
- Launch Core + Pro tiers with gym/dining access
- QR code check-in, credits wallet, partner discovery map
- Corporate pilot with 2-3 companies
- Influencer marketing + referral program
- Target: 500 subscribers

### Phase 3: Scale (Month 7-12)
- Launch Elite + Family tiers
- 3-5 corporate contracts signed
- Expand partner network to 30+ venues
- Kuwait market entry
- Target: 2,000 subscribers + corporate

### Phase 4: Dominate (Year 2+)
- 5,000+ subscribers, 10+ corporate contracts
- Bahrain/Oman expansion
- AI personalization engine live
- Target: 20M+ QAR annual revenue

### Customer Acquisition Channels (Priority Order)
1. Gym partnerships (CAC: 50-100 QAR)
2. Referrals (100 QAR credit cost)
3. Instagram/Social (150-200 QAR CAC)
4. Influencer marketing (200-300 QAR CAC)
5. Corporate wellness (100-150 QAR CAC, slow cycle)

---

## 7. Revenue Projections

### Food-Only Model (NutriFuel Business Plan)

| Metric | Month 6 | Month 12 | Month 24 |
|--------|---------|----------|----------|
| Customers | 100 | 300 | 1,200 |
| Monthly Revenue | 387K QAR | 1.16M QAR | 4.64M QAR |
| Monthly Profit | 164K QAR | 533K QAR | 2.19M QAR |
| Cumulative Profit | 768K QAR | 3.58M QAR | 25M+ QAR |

### Lifestyle Model (Nutrio Business Case)

| Metric | Month 6 | Year 1 |
|--------|---------|--------|
| Subscribers | 500 | 2,000 |
| Corporate Employees | 100 | 500 |
| Monthly Revenue | 1.6M QAR | 6M+ QAR |

### Corporate Revenue Example
- 3 corporate clients (QNB 100 emp, Ooredoo 50 emp, 10 QSTP startups × 10 emp) = 5.7M QAR/year

---

## 8. Key Risks

| Risk | Likelihood | Impact |
|------|-----------|--------|
| Restaurant quality inconsistency | Medium | High |
| Delivery logistics complexity | High | High |
| Calo copies lifestyle features | High | Medium |
| Customer price sensitivity | Medium | Medium |
| Low initial restaurant/gym interest | Medium | Medium |
| Privilee adds food delivery | Medium | High |
| Corporate sales cycle too long | Medium | Medium |
| Arabic translation delays | Medium | Medium |

---

## 9. DB Schema Additions Needed (for Lifestyle Features)

New tables designed but not yet implemented:
- `partners` (gyms, restaurants, spas, recovery centers)
- `partner_benefits` (per-tier benefits)
- `member_credits` (monthly credits wallet)
- `partner_checkins` (QR check-in tracking)
- `corporate_accounts` (B2B accounts)
- `corporate_enrollments` (employee enrollment)

Family plan changes: `family_id`, `family_member_role`, `age_group` to profiles table.

---

*Last updated: 2026-03-30 | Source: 6 internal strategy documents*
