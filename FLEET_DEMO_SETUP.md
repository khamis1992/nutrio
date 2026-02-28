# Fleet Management Portal - Demo Setup Guide

## Quick Start

### 1. Deploy Database & Functions

```bash
# Apply database migrations
npx supabase db push

# Deploy all fleet edge functions
npx supabase functions deploy fleet-auth --no-verify-jwt
npx supabase functions deploy fleet-dashboard --no-verify-jwt
npx supabase functions deploy fleet-drivers --no-verify-jwt
npx supabase functions deploy fleet-vehicles --no-verify-jwt
npx supabase functions deploy fleet-payouts --no-verify-jwt
npx supabase functions deploy fleet-tracking --no-verify-jwt

# Apply demo data
npx supabase db execute --file supabase/migrations/20240227_demo_fleet_data.sql
```

### 2. Create Auth Users

**Option A: Via Admin Panel (Recommended)**

1. Login to the admin portal: `http://localhost:8080/admin`
2. Navigate to: `http://localhost:8080/admin/users`
3. Click the **"Add Fleet Manager"** button
4. Fill in the form:
   - Select role (Fleet Manager or Super Admin)
   - Enter full name, email, phone
   - Generate or enter a password
   - For Fleet Manager: select assigned cities
5. Click "Create" - the account will be created automatically!

**Option B: Manual via Supabase Dashboard**

1. Go to: `https://supabase.com/dashboard/project/_/auth/users`
2. Click "Add User" or use the invite feature

**Fleet Manager Account:**
- Email: `fleet.demo@nutriofuel.qa`
- Password: `DemoFleet2024!`

**Super Admin Account:**
- Email: `admin.demo@nutriofuel.qa`
- Password: `DemoAdmin2024!`

3. Note the UUIDs of the created users

### 3. Link Auth Users to Fleet Managers

Run this SQL in Supabase SQL Editor:

```sql
-- Replace with actual UUIDs from step 2
UPDATE fleet_managers
SET auth_user_id = 'YOUR_FLEET_MANAGER_AUTH_UUID'
WHERE email = 'fleet.demo@nutriofuel.qa';

UPDATE fleet_managers
SET auth_user_id = 'YOUR_SUPER_ADMIN_AUTH_UUID'
WHERE email = 'admin.demo@nutriofuel.qa';
```

### 4. Start Development Servers

```bash
# Terminal 1: Start the React app
npm run dev

# Terminal 2: Start the WebSocket server
cd websocket-server
npm install
npm run dev
```

### 5. Access the Portal

Open your browser and navigate to:

**Local Development:**
```
http://localhost:8080/fleet/login
```

**Production (after deployment):**
```
https://nutriofuel.qa/fleet/login
```

## Demo Accounts

### Fleet Manager
- **Email:** fleet.demo@nutriofuel.qa
- **Password:** DemoFleet2024!
- **Role:** Fleet Manager
- **Access:** Doha and Al Rayyan cities only
- **Capabilities:**
  - View dashboard with stats
  - Manage drivers in assigned cities
  - Track drivers in real-time
  - Process payouts
  - Manage vehicles

### Super Admin
- **Email:** admin.demo@nutriofuel.qa
- **Password:** DemoAdmin2024!
- **Role:** Super Admin
- **Access:** All cities (Doha, Al Rayyan, Al Wakrah)
- **Capabilities:**
  - Full access to all fleet features
  - View all cities and drivers
  - Multi-city filter support
  - Admin-level configurations

## Demo Data

### Cities (3)
1. **Doha** - Main operations hub
2. **Al Rayyan** - Education City focus
3. **Al Wakrah** - Expansion city

### Zones (5)
- West Bay (Doha)
- The Pearl (Doha)
- Souq Waqif (Doha)
- Msheireb (Doha)
- Education City (Al Rayyan)

### Drivers (8)
- **5 Active drivers** (3 online, 2 offline)
- **1 Pending verification** driver
- **1 Suspended driver**
- **2 Active drivers** in Al Rayyan

### Vehicles (6)
- Mix of motorcycles and cars
- Insurance tracking with expiry alerts
- Assigned to active drivers

### Payouts (4)
- 2 Paid payouts with bank transfer references
- 1 Pending payout ready for processing
- 1 Al Rayyan city payout

## Testing Scenarios

### 1. Login & Dashboard
1. Navigate to `/fleet/login`
2. Login with Fleet Manager credentials
3. View dashboard stats
4. Switch cities using the city selector

### 2. Driver Management
1. Go to "Drivers" section
2. Try different filters (status, city, search)
3. Click on a driver to view details
4. View real-time online status

### 3. Live Tracking
1. Go to "Live Tracking" section
2. View drivers on the map
3. Click markers for driver info
4. Check connection status indicator

### 4. Vehicle Management
1. Go to "Vehicles" section
2. View insurance expiry alerts
3. Assign vehicles to drivers

### 5. Payout Processing
1. Go to "Payouts" section
2. View pending and paid payouts
3. Click "Process Payouts"
4. Select drivers and calculate earnings

### 6. Role-Based Access
1. Login as Super Admin
2. Verify access to all cities
3. Login as Fleet Manager
4. Verify restricted to assigned cities only

## Troubleshooting

### "User not found" error
Make sure you've linked the auth UUIDs to the fleet_managers table (Step 3 above).

### "Access denied" error
Check that the user's assigned_city_ids includes the city you're trying to access.

### WebSocket not connecting
Ensure the WebSocket server is running on port 3001 and Redis is accessible.

### Map not loading
Verify that `VITE_MAPBOX_TOKEN` is set in your `.env` file.

## Environment Variables

Add these to your `.env` file:

```bash
# Fleet Management Portal
VITE_FLEET_API_URL=http://localhost:54321/functions/v1
VITE_WS_URL=http://localhost:3001
VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here
```

## Next Steps

After testing, you can:
1. Create real fleet manager accounts
2. Onboard actual drivers
3. Set up production WebSocket servers
4. Configure SSL certificates for WebSocket
5. Set up Redis cluster for scaling

---

**Need Help?** 
- Check the design doc: `docs/fleet-management-portal-design.md`
- Review the logs in browser dev tools
- Check Supabase Dashboard for function logs
