# Nutrio Fuel Implementation Checklist

## Phase 1: Foundation (Week 1-2)

### Day 1-2: Legal & Business Setup
- [ ] Register business with Qatar Ministry of Commerce
- [ ] Open business bank account
- [ ] Apply for necessary licenses/permits
- [ ] Get liability insurance (3,000 QAR)
- [ ] Draft restaurant partnership agreement
- [ ] Draft terms of service for customers
- [ ] Set up Sadad merchant account (payment gateway)

### Day 3-4: Technical Setup
- [ ] Set up Supabase production environment
- [ ] Configure domain and SSL certificates
- [ ] Set up email service (Resend)
- [ ] Configure WhatsApp Business API (Ultramsg)
- [ ] Set up error tracking (Sentry)
- [ ] Set up analytics (PostHog)
- [ ] Deploy initial platform version

### Day 5-7: Database & Backend
- [ ] Run all database migrations
- [ ] Set up Row Level Security (RLS) policies
- [ ] Seed subscription plans (Basic, Standard, Premium, VIP)
- [ ] Create admin user account
- [ ] Test all database queries
- [ ] Set up automated backups
- [ ] Configure monitoring alerts

### Day 8-10: Restaurant Recruitment
- [ ] Create list of 50 target restaurants
- [ ] Prepare pitch deck for restaurants
- [ ] Contact first 10 restaurants
- [ ] Schedule meetings with 5 restaurants
- [ ] Prepare partnership agreement templates
- [ ] Create QR code marketing materials

### Day 11-14: Testing & QA
- [ ] Create 3 test restaurant accounts
- [ ] Add 20+ test meals to platform
- [ ] Test complete customer journey (signup → order → delivery)
- [ ] Test payment flow with Sadad
- [ ] Test WhatsApp notifications
- [ ] Test partner onboarding flow
- [ ] Fix critical bugs
- [ ] Document known issues

---

## Phase 2: Development (Week 3-6)

### Week 3 Tasks
- [ ] Enhance partner onboarding to 5-step wizard
- [ ] Add bank account collection fields
- [ ] Create admin approval dashboard
- [ ] Implement payout rate setting interface
- [ ] Test onboarding flow with 2 beta partners

### Week 4 Tasks
- [ ] Update subscription page with 4-tier comparison
- [ ] Integrate Sadad payment gateway
- [ ] Implement subscription webhook handlers
- [ ] Create weekly meal usage tracking
- [ ] Test subscription flows

### Week 5 Tasks
- [ ] Create unified meals view (all restaurants)
- [ ] Remove price display from meal cards
- [ ] Add restaurant filter functionality
- [ ] Implement weekly limit checks
- [ ] Test order flow with limits

### Week 6 Tasks
- [ ] Build referral code generation system
- [ ] Add referral sharing UI (WhatsApp, copy link)
- [ ] Implement referral tracking
- [ ] Create reward meal allocation logic
- [ ] Test complete referral flow
- [ ] End-to-end testing of all features

---

## Phase 3: Beta Launch (Week 7-8)

### Pre-Beta Checklist
- [ ] Platform is stable and bug-free
- [ ] At least 3 restaurants fully onboarded
- [ ] At least 20 meals available on platform
- [ ] Payment processing working
- [ ] Delivery partners identified
- [ ] Customer support WhatsApp ready

### Beta Launch Tasks
- [ ] Invite 50 friends and family
- [ ] Create beta tester instructions
- [ ] Set up beta feedback form
- [ ] Monitor orders closely
- [ ] Daily check-ins with restaurants
- [ ] Collect feedback daily
- [ ] Fix issues within 24 hours

### Beta Success Criteria
- [ ] 30+ beta users active
- [ ] 100+ orders placed
- [ ] 4.5+ average rating
- [ ] <5% order issues
- [ ] Restaurant partners satisfied

---

## Phase 4: Marketing Prep (Week 9-10)

### Referral Program Setup
- [ ] Generate referral codes for all users
- [ ] Add referral UI to profile page
- [ ] Create WhatsApp share template
- [ ] Test referral tracking
- [ ] Verify reward allocation works

### Partnership Setup
- [ ] Contact 10 gyms/fitness centers
- [ ] Create partnership pitch
- [ ] Design flyers for gyms
- [ ] Create QR code posters for restaurants
- [ ] Set up Instagram business account
- [ ] Prepare content calendar (30 posts)

### Launch Materials
- [ ] Write launch announcement
- [ ] Create press release
- [ ] Design social media graphics
- [ ] Prepare email templates
- [ ] Set up Google My Business
- [ ] Create welcome email sequence

---

## Phase 5: Public Launch (Week 11-12)

### Launch Day Checklist
- [ ] Platform stress-tested
- [ ] All systems monitored
- [ ] Support team on standby
- [ ] Restaurants notified
- [ ] Social media posts scheduled
- [ ] Email sent to beta users
- [ ] Referral program activated

### Week 11 Goals
- [ ] 25 new signups
- [ ] 75 orders completed
- [ ] Zero major incidents
- [ ] All feedback addressed
- [ ] 5-star average rating

### Week 12 Goals
- [ ] 50 total subscribers
- [ ] 150 orders completed
- [ ] 10 restaurant partners
- [ ] Referral program driving 30% of signups
- [ ] Break-even achieved (8+ paying customers)

---

## Daily Operations Checklist (Post-Launch)

### Morning (9:00 AM)
- [ ] Check overnight orders
- [ ] Review any failed payments
- [ ] Check restaurant capacity/status
- [ ] Respond to overnight WhatsApp messages
- [ ] Review daily metrics dashboard

### Midday (1:00 PM)
- [ ] Check lunch rush orders
- [ ] Verify all orders being prepared
- [ ] Contact restaurants if issues
- [ ] Update order statuses
- [ ] Handle customer inquiries

### Evening (6:00 PM)
- [ ] Review day's orders
- [ ] Check customer feedback
- [ ] Follow up on any issues
- [ ] Prepare next day forecast
- [ ] Send daily summary to team

### Weekly Tasks (Every Monday)
- [ ] Generate payout reports for restaurants
- [ ] Process weekly payouts
- [ ] Review weekly metrics
- [ ] Plan social media content
- [ ] Contact 5 new restaurant prospects
- [ ] Review and respond to all feedback

---

## Success Gates

### Gate 1: Technical Readiness (End of Week 2)
**Criteria:**
- Platform fully functional
- All critical bugs resolved
- Payment processing tested
- 3 restaurants onboarded

**Go/No-Go Decision:** ___________

### Gate 2: Beta Success (End of Week 8)
**Criteria:**
- 30+ active beta users
- 4.5+ star rating
- <5% issue rate
- Restaurants satisfied

**Go/No-Go Decision:** ___________

### Gate 3: Launch Readiness (End of Week 10)
**Criteria:**
- Marketing materials ready
- 10 restaurants committed
- Support systems in place
- Referral program tested

**Go/No-Go Decision:** ___________

### Gate 4: Growth Viability (End of Week 12)
**Criteria:**
- 50+ paying subscribers
- Positive unit economics
- Referrals working
- Ready to scale

**Go/No-Go Decision:** ___________

---

## Key Contacts & Resources

### Internal Team
- **Technical Lead:** [Name] - [Phone] - [Email]
- **Operations:** [Name] - [Phone] - [Email]
- **Support:** WhatsApp Business [Number]

### External Partners
- **Payment Gateway:** Sadad Support
- **Delivery:** [Partner Name] - [Contact]
- **Insurance:** [Provider] - [Policy #]
- **Legal:** [Lawyer/Firm]

### Emergency Contacts
- **Hosting/Platform:** Supabase Status Page
- **Payment Issues:** Sadad Emergency Line
- **Critical Bugs:** [Developer Phone]

---

## Notes & Learnings

### Week 1 Notes:
_____________________________________________
_____________________________________________

### Week 2 Notes:
_____________________________________________
_____________________________________________

### Key Learnings:
_____________________________________________
_____________________________________________

### Adjustments Made:
_____________________________________________
_____________________________________________

---

**Document Version:** 1.0  
**Last Updated:** February 21, 2026  
**Next Review:** Weekly
