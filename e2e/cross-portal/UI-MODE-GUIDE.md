# 🎭 Playwright UI Mode - Visual Demonstration

## What is UI Mode?

Playwright UI Mode is an **interactive test runner** that shows:
- 🖥️ **Live browser windows** running your tests
- 📊 **Real-time test execution** with visual feedback
- 🔍 **Step-by-step debugging** with DOM inspection
- 📸 **Automatic screenshots** on each step
- 🎥 **Video recording** of test runs
- ⏱️ **Timeline view** showing test execution flow

---

## 🚀 How to Launch UI Mode

### Option 1: Full Cross-Portal Suite
```bash
npx playwright test e2e/cross-portal/ --ui
```

### Option 2: Specific Workflow
```bash
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui
```

### Option 3: Using npm script
```bash
npm run test:cross-portal:ui
```

---

## 🖥️ What You'll See

### 1. Test Runner Interface

```
┌─────────────────────────────────────────────────────────────────┐
│  Playwright Test Runner                    [Run] [Debug] [Stop] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📁 e2e/cross-portal/                                          │
│  ├── ✅ order-lifecycle.spec.ts (9 tests)                       │
│  │   ├── ✅ Step 1: Customer browses meals                     │
│  │   ├── ✅ Step 2: Customer proceeds to checkout              │
│  │   ├── ✅ Step 3: Partner views dashboard                    │
│  │   ├── ✅ Step 4: Partner views orders                       │
│  │   ├── ✅ Step 5: Driver views dashboard                     │
│  │   ├── ✅ Step 6: Driver views orders                        │
│  │   ├── ✅ Step 7: Admin views orders                         │
│  │   ├── ✅ Step 8: Admin views dashboard                      │
│  │   └── ✅ Step 9: All portals active                         │
│  ├── ✅ partner-onboarding.spec.ts (11 tests)                   │
│  ├── ✅ driver-delivery.spec.ts (12 tests)                      │
│  └── ...                                                        │
│                                                                 │
│  Summary: 152 passed, 2 failed                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Browser Window - Multi-Portal View

```
┌─────────────────────────────────────────────────────────────────┐
│  Cross-Portal: Order Lifecycle Workflow                         │
│  Step 9: All portals active simultaneously                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 🧑 Customer  │  │ 🏪 Partner   │  │ 🚗 Driver    │          │
│  │              │  │              │  │              │          │
│  │ Dashboard    │  │ Orders       │  │ Deliveries   │          │
│  │ ✅ Loaded    │  │ ✅ Loaded    │  │ ✅ Loaded    │          │
│  │              │  │              │  │              │          │
│  │ URL: /dash   │  │ URL: /partner│  │ URL: /driver │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 👨‍💼 Admin                                                    ││
│  │                                                             ││
│  │ Dashboard - Monitoring all portals                         ││
│  │ ✅ Loaded                                                   ││
│  │                                                             ││
│  │ URL: /admin                                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Status: ✅ All 4 portals active and synchronized               │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Timeline View - Test Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Test Timeline                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  0ms     1000ms   2000ms   3000ms   4000ms   5000ms   6000ms   │
│   │        │        │        │        │        │        │       │
│   ▼        ▼        ▼        ▼        ▼        ▼        ▼       │
│  ┌┴┐     ┌┴┐     ┌┴┐     ┌┴┐     ┌┴┐     ┌┴┐     ┌┴┐        │
│  │🚀│     │🔐│     │🧑│     │🏪│     │🚗│     │👨‍💼│     │✅│        │
│  └┬┘     └┬┘     └┬┘     └┬┘     └┬┘     └┬┘     └┬┘        │
│   │        │        │        │        │        │        │       │
│ Start   Login   Customer Partner  Driver   Admin   Complete    │
│         All     Page     Page     Page     Page              │
│         4       Loaded   Loaded   Loaded   Loaded            │
│         portals                                                    │
│         (1.2s)  (0.8s)   (0.9s)   (0.7s)   (0.8s)   (0.5s)    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. DOM Inspector - Detailed View

```
┌─────────────────────────────────────────────────────────────────┐
│  DOM Inspector - Customer Dashboard                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  <body>                                                         │
│    <div id="root">                                             │
│      <div class="dashboard"> ✅                               │
│        <h1>Dashboard</h1> ✅                                   │
│        <div class="stats"> ✅                                  │
│          <div class="stat-card">Orders: 5</div> ✅             │
│          <div class="stat-card">Wallet: $100</div> ✅          │
│        </div>                                                   │
│        <nav class="sidebar"> ✅                                │
│          <a href="/meals">Meals</a> ✅                         │
│          <a href="/orders">Orders</a> ✅                       │
│          <a href="/wallet">Wallet</a> ✅                       │
│        </nav>                                                   │
│      </div>                                                     │
│    </div>                                                       │
│  </body>                                                        │
│                                                                 │
│  ✅ All elements found and visible                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎬 Live Browser Demo

### What You Would See (Step by Step)

#### Step 1: Initial Launch
```
┌─────────────────────────────────────────────────────────────────┐
│  🎭 Playwright UI                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🟡 Running: order-lifecycle.spec.ts                           │
│                                                                 │
│  Opening 4 browser contexts...                                  │
│  ├── Context 1: Customer Portal ✅                             │
│  ├── Context 2: Partner Portal   ✅                             │
│  ├── Context 3: Driver Portal    ✅                             │
│  └── Context 4: Admin Portal     ✅                             │
│                                                                 │
│  All contexts ready. Starting tests...                          │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 2: Parallel Login
```
┌─────────────────────────────────────────────────────────────────┐
│  Test: Step 1 - Customer browses meals                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔄 Logging in all portals simultaneously...                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Browser 1 - Customer                                   │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  Nutrio Fuel - Login                            │   │   │
│  │  │                                                 │   │   │
│  │  │  Email: khamis--1992@hotmail.com ✓             │   │   │
│  │  │  Password: ******** ✓                          │   │   │
│  │  │                                                 │   │   │
│  │  │  [Sign in] ← Clicking...                       │   │   │
│  │  │                                                 │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🔄 Similar windows opening for Partner, Driver, Admin...       │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 3: All Portals Active
```
┌─────────────────────────────────────────────────────────────────┐
│  Test: Step 9 - All portals active simultaneously              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │ 🧑 Customer │ │ 🏪 Partner  │ │ 🚗 Driver   │              │
│  │             │ │             │ │             │              │
│  │ Dashboard   │ │ Orders      │ │ Deliveries  │              │
│  │             │ │             │ │             │              │
│  │ ✅ Active   │ │ ✅ Active   │ │ ✅ Active   │              │
│  │             │ │             │ │             │              │
│  │ 3 active    │ │ 5 orders    │ │ 2 assigned  │              │
│  │ orders      │ │ pending     │ │             │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 👨‍💼 Admin Portal                                           │ │
│  │                                                           │ │
│  │ Dashboard - Real-time Overview                           │ │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │ │
│  │ │ Users   │ │Orders   │ │Revenue  │ │Drivers  │         │ │
│  │ │  1,234  │ │   56    │ │ $4,500  │ │   23    │         │ │
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘         │ │
│  │                                                           │ │
│  │ ✅ Monitoring all 4 portals                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ✅ Test passed: All portals synchronized                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Interactive Features

### 1. Watch Mode
```bash
# Auto-rerun tests on file changes
npx playwright test e2e/cross-portal/ --ui --watch
```

### 2. Time Travel Debugging
- ⏮️ Step back through test execution
- 🔍 Inspect DOM at any point
- 📸 View screenshots for each action
- 🎥 Replay test execution

### 3. Multi-Browser Testing
```bash
# Test on Chrome, Firefox, Safari simultaneously
npx playwright test e2e/cross-portal/ --ui --project=chromium --project=firefox --project=webkit
```

---

## 📱 What You See on Screen

### Layout (4-Panel View)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Playwright UI Header                         │
├──────────────────────────┬──────────────────────────────────────┤
│                          │                                      │
│   Test List              │   Browser Windows                    │
│   (Left Panel)           │   (Main Area)                        │
│                          │                                      │
│   ✅ Order Lifecycle     │   ┌────────────┐  ┌────────────┐    │
│   ✅ Partner Onboard     │   │ Customer   │  │ Partner    │    │
│   ✅ Driver Delivery     │   │ Browser    │  │ Browser    │    │
│   ✅ Admin Mgmt          │   │            │  │            │    │
│   ✅ Subscription        │   │ Dashboard  │  │ Orders     │    │
│   ✅ Affiliate           │   │ View       │  │ View       │    │
│   ✅ Wallet              │   └────────────┘  └────────────┘    │
│   ✅ Payouts             │                                      │
│   ✅ Notifications       │   ┌────────────┐  ┌────────────┐    │
│   ⏳ Customer Journey    │   │ Driver     │  │ Admin      │    │
│                          │   │ Browser    │  │ Browser    │    │
│                          │   │            │  │            │    │
│                          │   │ Delivery   │  │ Dashboard  │    │
│                          │   │ View       │  │ View       │    │
│                          │   └────────────┘  └────────────┘    │
│                          │                                      │
├──────────────────────────┴──────────────────────────────────────┤
│                    Timeline / Console / DOM                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Launch Commands

### Quick Start
```bash
# Run all cross-portal tests with UI
npx playwright test e2e/cross-portal/ --ui

# Run specific workflow
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui

# Run with specific browser
npx playwright test e2e/cross-portal/ --ui --project=chromium
```

### With npm Scripts
```bash
npm run test:cross-portal:ui
npm run test:order-lifecycle -- --ui
npm run test:wallet-payments -- --ui
```

### Debug Mode
```bash
# Pause on first line for debugging
npx playwright test e2e/cross-portal/ --ui --debug
```

---

## 🎨 Visual Output Examples

### Passing Test
```
✅ Cross-Portal: Order Lifecycle Workflow
   Step 9: All portals active simultaneously
   Duration: 2.4s
   
   Screenshots: [1] [2] [3] [4]
   Video: [Play]
   Trace: [View]
   
   Assertions:
   ✅ Customer page loaded
   ✅ Partner page loaded
   ✅ Driver page loaded
   ✅ Admin page loaded
   ✅ All portals synchronized
```

### Failing Test (With Visual Diff)
```
❌ Cross-Portal: Customer Journey Workflow
   Step 2: Customer browses meals
   Duration: 5.1s
   
   Expected: "Meals" text on page
   Actual: "Restaurants" text found
   
   Screenshot:
   ┌─────────────────────────────────────┐
   │  Expected          Actual          │
   │  ┌──────────┐     ┌──────────┐    │
   │  │ Meals    │     │Restaurants│    │
   │  └──────────┘     └──────────┘    │
   │                                    │
   │  ❌ Text mismatch                  │
   └─────────────────────────────────────┘
   
   [View Full Screenshot] [Debug] [Retry]
```

---

## 💡 Pro Tips

### 1. Use for Debugging
```bash
# When a test fails, run in UI mode
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts:73 --ui
```

### 2. Screenshot Comparisons
```bash
# Update baseline screenshots
npx playwright test e2e/cross-portal/ --ui --update-snapshots
```

### 3. Network Inspection
- View all network requests
- Check API responses
- Monitor WebSocket connections

### 4. Console Logs
- View browser console output
- Filter by log level (info, warn, error)
- Search logs

---

## 🎯 Summary

### What UI Mode Shows You

1. **🖥️ Live Browser Windows** - See all 4 portals running simultaneously
2. **📊 Test Progress** - Watch tests execute in real-time
3. **🔍 DOM Inspection** - Inspect any element on the page
4. **📸 Screenshots** - Automatic capture on every step
5. **🎥 Video Recording** - Full test run video
6. **⏱️ Timeline** - Visual execution flow
7. **🐛 Debug Tools** - Step through, pause, inspect

### Why Use UI Mode

- ✅ **Visual confirmation** - See tests actually running
- ✅ **Debugging** - Step through failures
- ✅ **Development** - Write tests interactively
- ✅ **Demos** - Show stakeholders test coverage
- ✅ **Learning** - Understand test execution flow

---

## 🚀 Try It Now!

```bash
# Launch UI mode with your tests
npx playwright test e2e/cross-portal/ --ui

# Then:
# 1. Click "Run" to execute all tests
# 2. Watch 4 browser windows open
# 3. See all portals log in simultaneously
# 4. Watch the order flow in real-time
# 5. Click on any test to debug
# 6. Inspect DOM, view screenshots
# 7. Time travel through execution
```

---

*UI Mode: The best way to see your cross-portal tests in action!* 🎭
