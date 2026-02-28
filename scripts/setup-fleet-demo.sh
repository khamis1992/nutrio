#!/bin/bash
# ==========================================
# DEMO SETUP SCRIPT FOR FLEET MANAGEMENT PORTAL
# ==========================================

set -e

echo "🚀 Fleet Management Portal - Demo Setup"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Please install it first:${NC}"
    echo "npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}❌ Not logged into Supabase. Please run:${NC}"
    echo "npx supabase login"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites met${NC}"
echo ""

# Apply migrations
echo -e "${YELLOW}Step 2: Applying database migrations...${NC}"
npx supabase db push --include-all

echo -e "${GREEN}✅ Migrations applied${NC}"
echo ""

# Deploy edge functions
echo -e "${YELLOW}Step 3: Deploying Edge Functions...${NC}"

FUNCTIONS=("fleet-auth" "fleet-dashboard" "fleet-drivers" "fleet-vehicles" "fleet-payouts" "fleet-tracking")

for func in "${FUNCTIONS[@]}"; do
    echo "  Deploying $func..."
    npx supabase functions deploy $func --no-verify-jwt
done

echo -e "${GREEN}✅ Edge Functions deployed${NC}"
echo ""

# Create demo auth users
echo -e "${YELLOW}Step 4: Creating demo auth users...${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC} You need to manually create auth users in Supabase Dashboard:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/_/auth/users"
echo ""
echo "2. Create Fleet Manager:"
echo "   Email: fleet.demo@nutriofuel.qa"
echo "   Password: DemoFleet2024!"
echo ""
echo "3. Create Super Admin:"
echo "   Email: admin.demo@nutriofuel.qa"
echo "   Password: DemoAdmin2024!"
echo ""
echo "4. After creating users, note their UUIDs and update the fleet_managers table"
echo ""

# Apply demo data
echo -e "${YELLOW}Step 5: Applying demo data...${NC}"
npx supabase db execute --file supabase/migrations/20240227_demo_fleet_data.sql

echo -e "${GREEN}✅ Demo data applied${NC}"
echo ""

# Instructions
echo "========================================"
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "========================================"
echo ""
echo "🔗 ACCESS LINKS:"
echo "----------------"
echo ""
echo "Local Development:"
echo "  Fleet Portal: http://localhost:8080/fleet/login"
echo ""
echo "Production (after deployment):"
echo "  Fleet Portal: https://nutriofuel.qa/fleet/login"
echo ""
echo "📧 DEMO CREDENTIALS:"
echo "--------------------"
echo ""
echo "Fleet Manager Account:"
echo "  Email: fleet.demo@nutriofuel.qa"
echo "  Password: DemoFleet2024!"
echo "  Access: Doha and Al Rayyan cities"
echo ""
echo "Super Admin Account:"
echo "  Email: admin.demo@nutriofuel.qa"
echo "  Password: DemoAdmin2024!"
echo "  Access: All cities"
echo ""
echo "🧪 DEMO DATA INCLUDES:"
echo "---------------------"
echo "• 3 Cities: Doha, Al Rayyan, Al Wakrah"
echo "• 5 Zones across cities"
echo "• 8 Demo drivers (mix of online, offline, pending, suspended)"
echo "• 6 Vehicles with assignments"
echo "• Driver documents and verifications"
echo "• 4 Sample payouts (paid & pending)"
echo "• Activity logs"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "-------------------------"
echo "1. Create the auth users in Supabase Dashboard (see Step 4 above)"
echo "2. Get the UUIDs of the created users"
echo "3. Run this SQL to link them:"
echo ""
echo "   UPDATE fleet_managers"
echo "   SET auth_user_id = 'ACTUAL_AUTH_UUID_HERE'"
echo "   WHERE email = 'fleet.demo@nutriofuel.qa';"
echo ""
echo "   UPDATE fleet_managers"
echo "   SET auth_user_id = 'ACTUAL_ADMIN_UUID_HERE'"
echo "   WHERE email = 'admin.demo@nutriofuel.qa';"
echo ""
echo "4. Start the development server:"
echo "   npm run dev"
echo ""
echo "5. Start the WebSocket server (in a new terminal):"
echo "   cd websocket-server"
echo "   npm install"
echo "   npm run dev"
echo ""
echo "========================================"
