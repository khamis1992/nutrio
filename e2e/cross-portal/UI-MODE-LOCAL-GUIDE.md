# 🎭 Run UI Mode Locally - Complete Guide

## 🚀 Quick Start (Copy & Paste These Commands)

Open your terminal in the project root and run:

### Option 1: Best Experience - Full Cross-Portal Suite
```bash
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui
```

### Option 2: All Workflows
```bash
npx playwright test e2e/cross-portal/ --ui
```

### Option 3: Using npm Script
```bash
npm run test:cross-portal:ui
```

---

## 📋 Prerequisites

Before running UI mode, ensure:

1. **Dev server is running**
   ```bash
   npm run dev
   ```
   Leave this running in a separate terminal!

2. **Playwright browsers are installed**
   ```bash
   npx playwright install
   ```

3. **Test users exist in Supabase** (already configured ✅)

---

## 🎬 What Will Happen When You Run UI Mode

### Step 1: Launch (0-5 seconds)
```
🖥️  Playwright UI window opens
    └── Shows test file tree on left
    └── Main area ready for browser windows
```

### Step 2: Click "Run" (5-10 seconds)
```
🖱️  You click the "Run" button
    └── Test starts executing
    └── Console shows: "Logging in all portals..."
```

### Step 3: Browser Windows Open (10-15 seconds)
```
🌐  4 Chrome browser windows open simultaneously:
    
    ┌─────────────────────────────────────────────────────────┐
    │  Window 1: Customer Portal                              │
    │  URL: http://localhost:8080/dashboard                   │
    │  Status: Loading...                                     │
    └─────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────┐
    │  Window 2: Partner Portal                               │
    │  URL: http://localhost:8080/partner                     │
    │  Status: Loading...                                     │
    └─────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────┐
    │  Window 3: Driver Portal                                │
    │  URL: http://localhost:8080/driver                      │
    │  Status: Loading...                                     │
    └─────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────┐
    │  Window 4: Admin Portal                                 │
    │  URL: http://localhost:8080/admin                       │
    │  Status: Loading...                                     │
    └─────────────────────────────────────────────────────────┘
```

### Step 4: Watch the Magic (15-30 seconds)
```
👀 You'll see:
    
    Customer Window:
    - Login form appears
    - Email/password get filled in automatically
    - "Sign in" button gets clicked
    - Dashboard loads with "Welcome back!" toast
    - Navigation menu appears
    
    Partner Window:
    - Partner login page loads
    - Credentials filled
    - Signs in
    - Partner dashboard with orders appears
    
    Driver Window:
    - Driver portal loads
    - Login or registration flow
    - Driver dashboard with deliveries
    
    Admin Window:
    - Admin login
    - Admin dashboard with analytics
    - Shows user stats, orders, revenue
```

### Step 5: Test Completion (30-45 seconds)
```
✅ All tests pass
    └── Green checkmarks appear in UI
    └── Browser windows stay open for inspection
    └── You can click through each portal
```

---

## 🎮 Interactive Features

### While Tests Are Running:

#### 1. Watch Timeline
```
Bottom panel shows:
⏱️  Timeline of every action
    
    [0ms]     [1000ms]  [2000ms]  [3000ms]
     │         │         │         │
     ▼         ▼         ▼         ▼
    [Start]   [Login]   [Load]    [Verify]
    
    Click any point to see that moment
```

#### 2. Inspect DOM
```
Right-click any element → "Inspect"
    
    Shows:
    - HTML structure
    - CSS styles
    - Element properties
    - Accessibility info
```

#### 3. View Console
```
Click "Console" tab to see:
    - Browser console logs
    - Network requests
    - JavaScript errors
    - Warnings
```

#### 4. Network Monitor
```
Click "Network" tab to see:
    - API requests
    - Response times
    - Status codes
    - Request/response bodies
```

#### 5. Screenshots
```
Every action automatically captures screenshots:
    
    [Screenshot 1] [Screenshot 2] [Screenshot 3]
    
    Click to view full size
    Compare before/after states
```

---

## 🎯 Recommended Test Runs

### Run 1: Quick Demo (1 minute)
```bash
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts:167 --ui
```
**What you'll see:** All 4 portals logging in simultaneously

### Run 2: Full Order Flow (2 minutes)
```bash
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui
```
**What you'll see:** Complete order lifecycle across all portals

### Run 3: Financial Workflows (3 minutes)
```bash
npx playwright test e2e/cross-portal/wallet-payments.spec.ts --ui
```
**What you'll see:** Wallet, payments, earnings, payouts

### Run 4: Everything (5 minutes)
```bash
npx playwright test e2e/cross-portal/ --ui
```
**What you'll see:** All 10 workflows, 139 tests

---

## 📸 What the Browsers Will Show

### Customer Portal Window:
```
┌──────────────────────────────────────────────────────┐
│  Welcome back! You have successfully signed in.  [X] │  ← Toast notification
├──────────────────────────────────────────────────────┤
│                                                      │
│              Dashboard                               │
│                                                      │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│   │  Orders  │ │  Wallet  │ │ Schedule │          │
│   │    5     │ │  $100    │ │   View   │          │
│   └──────────┘ └──────────┘ └──────────┘          │
│                                                      │
│   [Browse Meals]  [View Orders]  [My Profile]      │
│                                                      │
├──────────────────────────────────────────────────────┤
│  🏠 │ 🍽️ │ 📅 │ 👤                                  │
└──────────────────────────────────────────────────────┘
```

### Partner Portal Window:
```
┌──────────────────────────────────────────────────────┐
│              Partner Dashboard                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📊 Today's Overview                                 │
│                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │ New Orders   │ │  Earnings    │ │   Rating     ││
│  │     3        │ │   $450       │ │    4.8 ⭐    ││
│  └──────────────┘ └──────────────┘ └──────────────┘│
│                                                      │
│  🔔 Recent Orders:                                   │
│  ┌────────────────────────────────────────────────┐ │
│  │ Order #1234 - Customer: John - $45 - Pending │ │
│  │ Order #1235 - Customer: Jane - $32 - Cooking │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Driver Portal Window:
```
┌──────────────────────────────────────────────────────┐
│              Driver Dashboard                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  🚗 Available for Deliveries: ON                     │
│                                                      │
│  💰 Today's Earnings: $85                            │
│                                                      │
│  📦 Active Deliveries:                               │
│  ┌────────────────────────────────────────────────┐ │
│  │ Delivery #567                                   │ │
│  │ Pickup: Lebanese Kitchen                        │ │
│  │ Dropoff: 123 Main St, Doha                      │ │
│  │ Status: En route to pickup                      │ │
│  │ [Navigate] [Mark Picked Up]                     │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Admin Portal Window:
```
┌──────────────────────────────────────────────────────┐
│              Admin Dashboard                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📊 Platform Overview                                │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │  Users   │ │  Orders  │ │ Revenue  ││Drivers ││
│  │  1,234   │ │    56    │ │ $12,450  ││   89   ││
│  └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                                                      │
│  🔔 Recent Activity:                                 │
│  • New order #1234 from customer John               │
│  • Driver Mike completed delivery #567              │
│  • Partner "Lebanese Kitchen" updated menu          │
│  • New affiliate application received               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 🔧 Controls & Shortcuts

### In the Playwright UI Window:

| Action | How To |
|--------|--------|
| **Run tests** | Click green "▶ Run" button |
| **Stop tests** | Click red "⏹ Stop" button |
| **Debug test** | Click "🐛 Debug" button |
| **View source** | Click on test name |
| **Inspect element** | Right-click → Inspect |
| **Take screenshot** | Click "📸" icon |
| **View trace** | Click on completed test |

### Keyboard Shortcuts:

| Key | Action |
|-----|--------|
| `Ctrl+R` | Run tests |
| `Ctrl+.` | Stop tests |
| `Ctrl+D` | Debug mode |
| `F5` | Refresh |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |

---

## 💡 Pro Tips

### Tip 1: Arrange Windows Side-by-Side
```
Before running, arrange your desktop:

┌───────────────┬───────────────┐
│   Customer    │   Partner     │
│   Browser     │   Browser     │
├───────────────┼───────────────┤
│    Driver     │    Admin      │
│   Browser     │   Browser     │
└───────────────┴───────────────┘

This way you can watch all 4 at once!
```

### Tip 2: Use Debug Mode
```bash
# Tests pause on first line - step through manually
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui --debug
```

### Tip 3: Slow Motion
```bash
# Slow down to see each action
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui --slow-mo 2000
# Each action takes 2 seconds - great for demos!
```

### Tip 4: Single Worker
```bash
# Run one test at a time for clearer viewing
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui --workers=1
```

---

## 🚨 Troubleshooting

### Issue: "No tests found"
**Fix:**
```bash
cd C:\Users\khamis\Documents\nutrio-fuel-new
npx playwright test e2e/cross-portal/ --ui
```

### Issue: "Could not connect to dev server"
**Fix:**
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run tests
npx playwright test e2e/cross-portal/ --ui
```

### Issue: "Browsers not installed"
**Fix:**
```bash
npx playwright install chromium
```

### Issue: UI mode window doesn't open
**Fix:** Try headed mode instead:
```bash
npx playwright test e2e/cross-portal/ --headed
```

---

## 🎓 Learning Path

### First Time: Just Watch (5 minutes)
```bash
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts:167 --ui
```
- Click "Run"
- Watch the 4 browsers
- See the magic happen!

### Second Time: Interact (10 minutes)
```bash
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui
```
- Click on timeline steps
- Inspect DOM elements
- View network requests

### Third Time: Debug (15 minutes)
```bash
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts:73 --ui --debug
```
- Step through line by line
- Understand the flow
- Modify and re-run

---

## 📹 Recording Your Session

Want to record a video of the test run?

```bash
# Already configured in playwright.config.ts!
# Videos are saved to: test-results/

# After running, find videos:
ls test-results/**/*.webm
```

Or use screen recording software to capture the 4 browsers in action!

---

## 🎯 Next Steps After Watching

Once you've seen UI mode in action:

1. **Try different tests:**
   ```bash
   npx playwright test e2e/cross-portal/wallet-payments.spec.ts --ui
   ```

2. **Run all tests:**
   ```bash
   npx playwright test e2e/cross-portal/ --ui
   ```

3. **Generate HTML report:**
   ```bash
   npx playwright show-report
   ```

4. **Add to CI/CD:**
   ```yaml
   - name: Run E2E Tests
     run: npx playwright test e2e/cross-portal/
   ```

---

## ✨ Summary

### To see your cross-portal tests in action:

```bash
1. Ensure dev server is running:
   npm run dev

2. Open new terminal and run:
   npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --ui

3. Click "Run" in the UI window

4. Watch 4 browser windows open and interact!

5. Explore timeline, DOM, network, screenshots
```

**You'll see all 4 portals (Customer, Partner, Driver, Admin) running simultaneously - just like the screenshots I captured!**

---

🎭 **Ready to watch the magic happen? Run the command above!**
