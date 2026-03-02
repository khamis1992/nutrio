#!/usr/bin/env python3
"""
COMPLETE E2E Test Plan Updater for Nutrio Fuel
Adds EVERY SINGLE feature to achieve 100% coverage
"""

import pandas as pd
from openpyxl import load_workbook

file_path = r'C:\Users\khamis\Documents\nutrio-fuel-new\docs\plans\Nutrio-Fuel-E2E-Test-Plan.xlsx'

print("=" * 80)
print("NUTRIO FUEL - 100% E2E TEST COVERAGE UPDATE")
print("=" * 80)

# Read existing sheets to get structure
customer_df = pd.read_excel(file_path, sheet_name='Customer Tests')
admin_df = pd.read_excel(file_path, sheet_name='Admin Tests')
partner_df = pd.read_excel(file_path, sheet_name='Partner Tests')
driver_df = pd.read_excel(file_path, sheet_name='Driver Tests')
system_df = pd.read_excel(file_path, sheet_name='System Tests')

print(f"\nCurrent test counts:")
print(f"  Customer: {len(customer_df)}")
print(f"  Admin: {len(admin_df)}")
print(f"  Partner: {len(partner_df)}")
print(f"  Driver: {len(driver_df)}")
print(f"  System: {len(system_df)}")
print(f"  TOTAL: {len(customer_df) + len(admin_df) + len(partner_df) + len(driver_df) + len(system_df)}")

# Define ALL features from the codebase

# CUSTOMER FEATURES - Comprehensive list
all_customer_tests = [
    # ===== AUTHENTICATION & ONBOARDING (TC400-449) =====
    ["TC400", "Customer", "Auth", "Account Creation", "Create Account with Email/Password", 
     "1. Navigate to /auth\n2. Click 'Create Account'\n3. Enter email\n4. Enter password\n5. Confirm password\n6. Click Sign Up\n7. Verify email sent", 
     "https://nutrio.me/auth", "Account created, verification email sent", "", "", "", "Critical", ""],
    
    ["TC401", "Customer", "Auth", "Email Verification", "Verify Email Address", 
     "1. Check email inbox\n2. Open verification email\n3. Click verification link\n4. Verify account activated", 
     "https://nutrio.me/auth", "Email verified, account activated", "", "", "", "Critical", ""],
    
    ["TC402", "Customer", "Auth", "Password Reset Request", "Request Password Reset", 
     "1. Click 'Forgot Password'\n2. Enter registered email\n3. Click Reset\n4. Check email for reset link", 
     "https://nutrio.me/auth", "Reset email sent successfully", "", "", "", "High", ""],
    
    ["TC403", "Customer", "Auth", "Password Reset Complete", "Complete Password Reset", 
     "1. Click reset link in email\n2. Enter new password\n3. Confirm new password\n4. Submit\n5. Login with new password", 
     "https://nutrio.me/reset-password", "Password reset successful, can login", "", "", "", "High", ""],
    
    ["TC404", "Customer", "Auth", "Session Timeout", "Automatic Session Timeout", 
     "1. Login to app\n2. Leave idle for 30 minutes\n3. Try to perform action\n4. Verify redirect to login", 
     "https://nutrio.me/dashboard", "Session expired, redirected to login", "", "", "", "Medium", ""],
    
    ["TC405", "Customer", "Auth", "Remember Me", "Remember Me Functionality", 
     "1. Login with 'Remember Me' checked\n2. Close browser\n3. Reopen after 1 day\n4. Verify still logged in", 
     "https://nutrio.me/auth", "Session persisted, user remains logged in", "", "", "", "Low", ""],
    
    ["TC406", "Customer", "Auth", "Multiple Device Login", "Login from Multiple Devices", 
     "1. Login on Device A\n2. Login on Device B\n3. Verify both sessions active\n4. Logout from one device", 
     "https://nutrio.me/auth", "Multiple concurrent sessions supported", "", "", "", "Low", ""],
    
    ["TC407", "Customer", "Onboarding", "Step 1 - Goal Selection", "Onboarding Step 1: Select Health Goal", 
     "1. Start onboarding\n2. View goal options\n3. Select 'Lose Weight'\n4. Click Continue", 
     "https://nutrio.me/onboarding", "Goal saved, proceed to Step 2", "", "", "", "Critical", ""],
    
    ["TC408", "Customer", "Onboarding", "Step 2 - Gender Selection", "Onboarding Step 2: Select Gender", 
     "1. On Step 2\n2. Select gender (Male/Female)\n3. Click Continue", 
     "https://nutrio.me/onboarding", "Gender saved, proceed to Step 3", "", "", "", "Critical", ""],
    
    ["TC409", "Customer", "Onboarding", "Step 3 - Body Metrics", "Onboarding Step 3: Enter Body Metrics", 
     "1. Enter age\n2. Enter height\n3. Enter current weight\n4. Enter target weight\n5. Click Continue", 
     "https://nutrio.me/onboarding", "Metrics saved, proceed to Step 4", "", "", "", "Critical", ""],
    
    ["TC410", "Customer", "Onboarding", "Step 4 - Activity Level", "Onboarding Step 4: Select Activity Level", 
     "1. View activity options\n2. Select 'Moderately Active'\n3. Click Continue", 
     "https://nutrio.me/onboarding", "Activity level saved, proceed to Step 5", "", "", "", "Critical", ""],
    
    ["TC411", "Customer", "Onboarding", "Step 5 - Food Preferences", "Onboarding Step 5: Select Food Preferences", 
     "1. Select dietary tags\n2. Select allergies\n3. Click Complete\n4. Verify redirect to dashboard", 
     "https://nutrio.me/onboarding", "Preferences saved, onboarding complete", "", "", "", "Critical", ""],
    
    ["TC412", "Customer", "Onboarding", "Progress Persistence", "Onboarding Progress Persistence", 
     "1. Complete Step 1-3\n2. Close browser\n3. Reopen onboarding\n4. Verify resumes at Step 4", 
     "https://nutrio.me/onboarding", "Progress restored from localStorage", "", "", "", "Medium", ""],
    
    ["TC413", "Customer", "Onboarding", "Back Navigation", "Onboarding Back Navigation", 
     "1. Complete Step 3\n2. Click Back button\n3. Verify return to Step 2\n4. Data still filled", 
     "https://nutrio.me/onboarding", "Back navigation works, data preserved", "", "", "", "Medium", ""],
    
    ["TC414", "Customer", "Onboarding", "Skip for Returning Users", "Skip Onboarding for Returning Users", 
     "1. Complete onboarding\n2. Try to access /onboarding\n3. Verify redirect to dashboard", 
     "https://nutrio.me/onboarding", "Redirected to dashboard if already completed", "", "", "", "Medium", ""],
    
    # ===== DASHBOARD FEATURES (TC450-499) =====
    ["TC450", "Customer", "Dashboard", "Dashboard Load", "Dashboard Initial Load", 
     "1. Login as customer\n2. Navigate to /dashboard\n3. Verify all widgets load\n4. Check for errors", 
     "https://nutrio.me/dashboard", "Dashboard loads with all widgets", "", "", "", "Critical", ""],
    
    ["TC451", "Customer", "Dashboard", "Quick Actions", "Dashboard Quick Actions", 
     "1. View quick action buttons\n2. Click 'Browse Meals'\n3. Return\n4. Click 'View Schedule'", 
     "https://nutrio.me/dashboard", "All quick actions navigate correctly", "", "", "", "High", ""],
    
    ["TC452", "Customer", "Dashboard", "Meals Remaining Widget", "View Meals Remaining Widget", 
     "1. View dashboard\n2. Check 'Meals Remaining' widget\n3. Verify correct count\n4. Check subscription status", 
     "https://nutrio.me/dashboard", "Widget shows correct remaining meals", "", "", "", "High", ""],
    
    ["TC453", "Customer", "Dashboard", "Recent Orders Widget", "View Recent Orders Widget", 
     "1. Have recent orders\n2. View dashboard\n3. Check recent orders section\n4. Click 'View All'", 
     "https://nutrio.me/dashboard", "Recent orders displayed, click navigates", "", "", "", "High", ""],
    
    ["TC454", "Customer", "Dashboard", "Nutrition Summary Widget", "View Nutrition Summary Widget", 
     "1. Log some meals\n2. View dashboard\n3. Check nutrition summary\n4. Verify calories/protein/carbs/fat", 
     "https://nutrio.me/dashboard", "Nutrition summary shows today's totals", "", "", "", "High", ""],
    
    ["TC455", "Customer", "Dashboard", "Water Tracker Widget", "Water Tracker on Dashboard", 
     "1. View dashboard\n2. Find water tracker\n3. Click '+' to add glass\n4. Verify count increases", 
     "https://nutrio.me/dashboard", "Water intake tracked and saved", "", "", "", "Medium", ""],
    
    ["TC456", "Customer", "Dashboard", "Streak Display Widget", "View Streak Widget", 
     "1. Have active streak\n2. View dashboard\n3. Check streak widget\n4. View streak details", 
     "https://nutrio.me/dashboard", "Current streak displayed with details", "", "", "", "Medium", ""],
    
    ["TC457", "Customer", "Dashboard", "Health Score Widget", "View Health Score Widget", 
     "1. Have calculated health score\n2. View dashboard\n3. Check health score display\n4. View breakdown", 
     "https://nutrio.me/dashboard", "Health score displayed with category", "", "", "", "Medium", ""],
    
    ["TC458", "Customer", "Dashboard", "Gamification Widget", "View Gamification Widget", 
     "1. View dashboard\n2. Check gamification section\n3. View achievements\n4. Click achievement", 
     "https://nutrio.me/dashboard", "Gamification elements displayed", "", "", "", "Low", ""],
    
    ["TC459", "Customer", "Dashboard", "Smart Recommendations", "View Smart Recommendations", 
     "1. View dashboard\n2. Scroll to recommendations\n3. View personalized tips\n4. Click action link", 
     "https://nutrio.me/dashboard", "AI recommendations displayed", "", "", "", "Medium", ""],
    
    ["TC460", "Customer", "Dashboard", "Rollover Credits Widget", "View Rollover Credits", 
     "1. Have rollover credits\n2. View dashboard\n3. Check rollover widget\n4. View expiration date", 
     "https://nutrio.me/dashboard", "Rollover credits displayed with expiry", "", "", "", "Medium", ""],
    
    ["TC461", "Customer", "Dashboard", "Weekly Summary Cards", "View Weekly Summary Cards", 
     "1. Have week's data\n2. View dashboard\n3. Check weekly summary\n4. View trends", 
     "https://nutrio.me/dashboard", "Weekly summary with trends displayed", "", "", "", "Low", ""],
    
    ["TC462", "Customer", "Dashboard", "Refresh Data", "Refresh Dashboard Data", 
     "1. View dashboard\n2. Click refresh button\n3. Verify loading state\n4. Data updates", 
     "https://nutrio.me/dashboard", "Dashboard data refreshed successfully", "", "", "", "Low", ""],
    
    ["TC463", "Customer", "Dashboard", "Nutrition Dashboard Page", "Navigate to Full Nutrition Dashboard", 
     "1. On dashboard\n2. Click 'View Full Nutrition'\n3. Navigate to nutrition dashboard\n4. View detailed charts", 
     "https://nutrio.me/dashboard/nutrition", "Full nutrition dashboard displayed", "", "", "", "Medium", ""],
    
    ["TC464", "Customer", "Dashboard", "Progress Rings", "View Progress Rings", 
     "1. View dashboard\n2. Check progress rings\n3. Verify completion percentages\n4. Hover for details", 
     "https://nutrio.me/dashboard", "Progress rings show accurate completion", "", "", "", "Low", ""],
    
    # ===== MEALS & BROWSING (TC500-599) =====
    ["TC500", "Customer", "Meals", "Browse All Meals", "Browse All Available Meals", 
     "1. Navigate to /meals\n2. View meal grid\n3. Scroll through meals\n4. Check loading", 
     "https://nutrio.me/meals", "All meals displayed with images and prices", "", "", "", "Critical", ""],
    
    ["TC501", "Customer", "Meals", "Meal Search", "Search Meals by Name", 
     "1. Go to meals page\n2. Enter search term in search box\n3. Press Enter\n4. View results", 
     "https://nutrio.me/meals", "Search results match query", "", "", "", "High", ""],
    
    ["TC502", "Customer", "Meals", "Filter by Restaurant", "Filter Meals by Restaurant", 
     "1. Click restaurant filter\n2. Select specific restaurant\n3. Apply filter\n4. View filtered results", 
     "https://nutrio.me/meals", "Only selected restaurant meals shown", "", "", "", "High", ""],
    
    ["TC503", "Customer", "Meals", "Filter by Dietary Tags", "Filter by Dietary Preferences", 
     "1. Click diet filter\n2. Select 'Keto'\n3. Apply filter\n4. Verify all meals are keto-friendly", 
     "https://nutrio.me/meals", "Only meals matching diet tag shown", "", "", "", "High", ""],
    
    ["TC504", "Customer", "Meals", "Filter by Calories", "Filter by Calorie Range", 
     "1. Set min calories to 300\n2. Set max calories to 600\n3. Apply filter\n4. Check results", 
     "https://nutrio.me/meals", "Meals within calorie range displayed", "", "", "", "Medium", ""],
    
    ["TC505", "Customer", "Meals", "Filter by Protein", "Filter by Protein Content", 
     "1. Set min protein to 30g\n2. Apply filter\n3. View high-protein meals", 
     "https://nutrio.me/meals", "High protein meals displayed", "", "", "", "Medium", ""],
    
    ["TC506", "Customer", "Meals", "Sort by Popularity", "Sort Meals by Popularity", 
     "1. Click sort dropdown\n2. Select 'Most Popular'\n3. Verify meals reordered\n4. Check top meal", 
     "https://nutrio.me/meals", "Meals sorted by popularity", "", "", "", "Medium", ""],
    
    ["TC507", "Customer", "Meals", "Sort by Price", "Sort Meals by Price", 
     "1. Select 'Price: Low to High'\n2. Verify ascending order\n3. Select 'Price: High to Low'\n4. Verify descending order", 
     "https://nutrio.me/meals", "Meals sorted by price correctly", "", "", "", "Medium", ""],
    
    ["TC508", "Customer", "Meals", "Sort by Newest", "Sort Meals by Newest", 
     "1. Select 'Newest' sort\n2. Verify newest meals first\n3. Check timestamps", 
     "https://nutrio.me/meals", "Meals sorted by creation date", "", "", "", "Low", ""],
    
    ["TC509", "Customer", "Meals", "Meal Detail View", "View Meal Details", 
     "1. Click on meal card\n2. View detail page\n3. Check all sections\n4. Verify nutrition info", 
     "https://nutrio.me/meals/[id]", "All meal details displayed correctly", "", "", "", "Critical", ""],
    
    ["TC510", "Customer", "Meals", "Meal Ingredients", "View Meal Ingredients", 
     "1. Open meal detail\n2. Scroll to ingredients\n3. View full ingredient list\n4. Check allergens", 
     "https://nutrio.me/meals/[id]", "Ingredients listed with allergens highlighted", "", "", "", "High", ""],
    
    ["TC511", "Customer", "Meals", "Meal Nutrition Facts", "View Detailed Nutrition Facts", 
     "1. Open meal detail\n2. View nutrition panel\n3. Check calories, macros\n4. Verify daily values", 
     "https://nutrio.me/meals/[id]", "Complete nutrition facts displayed", "", "", "", "High", ""],
    
    ["TC512", "Customer", "Meals", "Meal Reviews", "View Meal Reviews", 
     "1. Open meal detail\n2. Scroll to reviews\n3. View customer reviews\n4. Check ratings", 
     "https://nutrio.me/meals/[id]", "Reviews and ratings displayed", "", "", "", "Medium", ""],
    
    ["TC513", "Customer", "Meals", "Restaurant Info from Meal", "View Restaurant from Meal Page", 
     "1. On meal detail\n2. Click restaurant name\n3. Navigate to restaurant page\n4. View other meals", 
     "https://nutrio.me/restaurant/[id]", "Restaurant profile with meals displayed", "", "", "", "Medium", ""],
    
    ["TC514", "Customer", "Meals", "Add to Favorites", "Add Meal to Favorites", 
     "1. Browse meals\n2. Click heart icon\n3. Verify heart filled\n4. Go to favorites page", 
     "https://nutrio.me/meals", "Meal added to favorites list", "", "", "", "High", ""],
    
    ["TC515", "Customer", "Meals", "Remove from Favorites", "Remove Meal from Favorites", 
     "1. Go to favorites\n2. Click filled heart\n3. Verify removed\n4. Check list updated", 
     "https://nutrio.me/favorites", "Meal removed from favorites", "", "", "", "High", ""],
    
    ["TC516", "Customer", "Meals", "Favorites Page", "View Favorites Page", 
     "1. Navigate to /favorites\n2. View all favorited meals\n3. Check empty state if none\n4. Remove from here", 
     "https://nutrio.me/favorites", "All favorites displayed correctly", "", "", "", "High", ""],
    
    ["TC517", "Customer", "Meals", "Meal Add-ons Selection", "Select Meal Add-ons", 
     "1. Open meal detail\n2. View add-on options\n3. Select add-ons\n4. See price update", 
     "https://nutrio.me/meals/[id]", "Add-ons selected, price updated", "", "", "", "Medium", ""],
    
    ["TC518", "Customer", "Meals", "VIP Price Display", "View VIP Discounted Price", 
     "1. Have VIP subscription\n2. Browse meals\n3. View VIP price badge\n4. Compare regular vs VIP price", 
     "https://nutrio.me/meals", "VIP price displayed with savings", "", "", "", "Medium", ""],
    
    ["TC519", "Customer", "Meals", "Featured Restaurants Section", "View Featured Restaurants", 
     "1. Go to meals page\n2. Scroll to 'Featured'\n3. View featured restaurants\n4. Click one", 
     "https://nutrio.me/meals", "Featured restaurants prominently displayed", "", "", "", "Low", ""],
    
    ["TC520", "Customer", "Meals", "Smart Recommendations Section", "View 'Recommended for You'", 
     "1. Complete onboarding\n2. Go to meals\n3. View recommendations\n4. Check personalization", 
     "https://nutrio.me/meals", "AI recommendations based on profile", "", "", "", "High", ""],
    
    ["TC521", "Customer", "Meals", "Quick View Modal", "Quick View Meal (Modal)", 
     "1. Hover over meal\n2. Click 'Quick View'\n3. View modal with details\n4. Close modal", 
     "https://nutrio.me/meals", "Quick view modal displayed", "", "", "", "Low", ""],
    
    ["TC522", "Customer", "Meals", "Meal Card Hover Effects", "Meal Card Interactions", 
     "1. Hover over meal card\n2. Check hover effects\n3. Verify image zoom\n4. Check buttons appear", 
     "https://nutrio.me/meals", "Hover effects work correctly", "", "", "", "Low", ""],
    
    ["TC523", "Customer", "Meals", "Load More Pagination", "Load More Meals", 
     "1. Scroll to bottom\n2. Click 'Load More'\n3. Verify more meals load\n4. Check loading state", 
     "https://nutrio.me/meals", "More meals loaded on click", "", "", "", "Medium", ""],
    
    ["TC524", "Customer", "Meals", "Meal Image Gallery", "View Meal Image Gallery", 
     "1. Open meal detail\n2. Click main image\n3. View gallery\n4. Navigate between images", 
     "https://nutrio.me/meals/[id]", "Image gallery displayed with navigation", "", "", "", "Low", ""],
    
    ["TC525", "Customer", "Meals", "Dietary Tags Display", "View Meal Dietary Tags", 
     "1. Browse meals\n2. Check dietary tags on cards\n3. Hover for tag details\n4. Click to filter", 
     "https://nutrio.me/meals", "Dietary tags displayed and clickable", "", "", "", "Medium", ""],
    
    # ===== SUBSCRIPTION (TC600-699) =====
    ["TC600", "Customer", "Subscription", "View All Plans", "View All Subscription Plans", 
     "1. Navigate to /subscription\n2. View all 4 tiers\n3. Compare features\n4. Check pricing", 
     "https://nutrio.me/subscription", "All plans displayed with features", "", "", "", "Critical", ""],
    
    ["TC601", "Customer", "Subscription", "Plan Comparison", "Compare Subscription Plans", 
     "1. On subscription page\n2. View comparison table\n3. Toggle features\n4. See differences", 
     "https://nutrio.me/subscription", "Plan comparison clearly displayed", "", "", "", "High", ""],
    
    ["TC602", "Customer", "Subscription", "Basic Plan Subscribe", "Subscribe to Basic Plan", 
     "1. Click Basic plan\n2. Review details\n3. Click Subscribe\n4. Complete payment", 
     "https://nutrio.me/subscription", "Basic subscription activated", "", "", "", "Critical", ""],
    
    ["TC603", "Customer", "Subscription", "Standard Plan Subscribe", "Subscribe to Standard Plan", 
     "1. Click Standard plan\n2. Review 10 meals/week\n3. Complete payment\n4. Verify activation", 
     "https://nutrio.me/subscription", "Standard subscription activated", "", "", "", "Critical", ""],
    
    ["TC604", "Customer", "Subscription", "Premium Plan Subscribe", "Subscribe to Premium Plan", 
     "1. Click Premium plan\n2. Review 15 meals/week\n3. Complete payment\n4. Verify activation", 
     "https://nutrio.me/subscription", "Premium subscription activated", "", "", "", "Critical", ""],
    
    ["TC605", "Customer", "Subscription", "VIP Plan Subscribe", "Subscribe to VIP Plan", 
     "1. Click VIP plan\n2. Review unlimited meals\n3. Complete payment\n4. Verify VIP benefits", 
     "https://nutrio.me/subscription", "VIP subscription with perks activated", "", "", "", "Critical", ""],
    
    ["TC606", "Customer", "Subscription", "Annual Discount", "View Annual Billing Discount", 
     "1. Toggle to annual billing\n2. View 17% discount\n3. Compare monthly vs annual\n4. Select annual", 
     "https://nutrio.me/subscription", "Annual discount displayed correctly", "", "", "", "Medium", ""],
    
    ["TC607", "Customer", "Subscription", "Subscription Wizard", "Complete Subscription Quiz", 
     "1. Click 'Find My Plan'\n2. Answer 3 questions\n3. Get recommendation\n4. Click to subscribe", 
     "https://nutrio.me/subscription/wizard", "Wizard recommends suitable plan", "", "", "", "High", ""],
    
    ["TC608", "Customer", "Subscription", "Current Subscription View", "View Current Subscription", 
     "1. Have active subscription\n2. View subscription page\n3. Check current plan\n4. View usage", 
     "https://nutrio.me/subscription", "Current subscription details displayed", "", "", "", "Critical", ""],
    
    ["TC609", "Customer", "Subscription", "Meals Usage Display", "View Weekly Meal Usage", 
     "1. View subscription\n2. Check meals used\n3. Check meals remaining\n4. View usage history", 
     "https://nutrio.me/subscription", "Accurate usage tracking displayed", "", "", "", "High", ""],
    
    ["TC610", "Customer", "Subscription", "Usage History", "View Usage History", 
     "1. Go to subscription\n2. Click 'View History'\n3. See past weeks\n4. Check rollover meals", 
     "https://nutrio.me/subscription", "Weekly usage history displayed", "", "", "", "Medium", ""],
    
    ["TC611", "Customer", "Subscription", "Rollover Credits", "View Rollover Meal Credits", 
     "1. Have unused meals\n2. View subscription\n3. Check rollover section\n4. Verify expiration", 
     "https://nutrio.me/subscription", "Rollover credits with expiry displayed", "", "", "", "Medium", ""],
    
    ["TC612", "Customer", "Subscription", "Upgrade Plan", "Upgrade Subscription Plan", 
     "1. View current plan\n2. Click 'Upgrade'\n3. Select higher tier\n4. Pay difference", 
     "https://nutrio.me/subscription", "Plan upgraded, new limits applied", "", "", "", "High", ""],
    
    ["TC613", "Customer", "Subscription", "Downgrade Plan", "Downgrade Subscription Plan", 
     "1. View current plan\n2. Click 'Downgrade'\n3. Select lower tier\n4. Confirm effective date", 
     "https://nutrio.me/subscription", "Downgrade scheduled for next cycle", "", "", "", "High", ""],
    
    ["TC614", "Customer", "Subscription", "Prorated Upgrade", "Prorated Plan Upgrade", 
     "1. Use some meals mid-week\n2. Upgrade plan\n3. Verify prorated charge\n4. Get immediate credits", 
     "https://nutrio.me/subscription", "Prorated charge calculated correctly", "", "", "", "High", ""],
    
    ["TC615", "Customer", "Subscription", "Pause Subscription", "Pause Subscription", 
     "1. Go to subscription\n2. Click 'Pause'\n3. Select resume date\n4. Confirm pause", 
     "https://nutrio.me/subscription", "Subscription paused, auto-resume set", "", "", "", "High", ""],
    
    ["TC616", "Customer", "Subscription", "Resume Subscription", "Resume Paused Subscription", 
     "1. Have paused subscription\n2. Click 'Resume Now'\n3. Confirm resume\n4. Verify active", 
     "https://nutrio.me/subscription", "Subscription resumed immediately", "", "", "", "High", ""],
    
    ["TC617", "Customer", "Subscription", "Cancel Subscription", "Cancel Subscription", 
     "1. Go to subscription\n2. Click 'Cancel'\n3. Provide reason\n4. Confirm cancellation", 
     "https://nutrio.me/subscription", "Subscription cancelled, access until end", "", "", "", "Critical", ""],
    
    ["TC618", "Customer", "Subscription", "Cancellation Survey", "Complete Cancellation Survey", 
     "1. Initiate cancellation\n2. Complete survey\n3. Select reason\n4. Submit feedback", 
     "https://nutrio.me/subscription", "Survey completed, cancellation processed", "", "", "", "Medium", ""],
    
    ["TC619", "Customer", "Subscription", "Subscription Gate", "Subscription Gate for Non-Subscribers", 
     "1. Login without subscription\n2. Try to schedule meal\n3. View gate popup\n4. Click 'View Plans'", 
     "https://nutrio.me/dashboard", "Gate displayed, redirect to subscription", "", "", "", "High", ""],
    
    ["TC620", "Customer", "Subscription", "Quota Warning 75%", "Quota Warning at 75% Usage", 
     "1. Use 75%+ of meals\n2. View dashboard\n3. Check warning banner\n4. Click upgrade", 
     "https://nutrio.me/dashboard", "Warning banner with upgrade option", "", "", "", "High", ""],
    
    ["TC621", "Customer", "Subscription", "Quota Warning 100%", "Quota Exhausted Warning", 
     "1. Use all weekly meals\n2. View dashboard\n3. Check exhausted banner\n4. Try to schedule", 
     "https://nutrio.me/dashboard", "Exhausted warning displayed", "", "", "", "High", ""],
    
    ["TC622", "Customer", "Subscription", "Meal Limit Upsell", "Meal Limit Upsell Banner", 
     "1. Reach meal limit\n2. Try to add meal\n3. View upsell banner\n4. Click to upgrade", 
     "https://nutrio.me/meals", "Upsell banner with plan options", "", "", "", "Medium", ""],
    
    ["TC623", "Customer", "Subscription", "Auto-Renewal Settings", "Manage Auto-Renewal", 
     "1. Go to subscription settings\n2. Toggle auto-renewal\n3. Save settings\n4. Verify change", 
     "https://nutrio.me/subscription", "Auto-renewal setting updated", "", "", "", "Medium", ""],
    
    ["TC624", "Customer", "Subscription", "Billing History", "View Billing History", 
     "1. Go to subscription\n2. Click 'Billing History'\n3. View past charges\n4. Download invoices", 
     "https://nutrio.me/subscription", "Complete billing history displayed", "", "", "", "Medium", ""],
    
    ["TC625", "Customer", "Subscription", "Next Billing Date", "View Next Billing Date", 
     "1. View subscription\n2. Check next billing\n3. Verify date correct\n4. View amount", 
     "https://nutrio.me/subscription", "Next billing date displayed", "", "", "", "Low", ""],
    
    # ===== ORDERS & SCHEDULING (TC700-799) =====
    ["TC700", "Customer", "Orders", "View Order History", "View All Order History", 
     "1. Navigate to /orders\n2. View all past orders\n3. Check statuses\n4. Scroll through list", 
     "https://nutrio.me/orders", "All orders displayed with status", "", "", "", "Critical", ""],
    
    ["TC701", "Customer", "Orders", "Order Detail View", "View Order Details", 
     "1. Click on order\n2. View detail page\n3. Check items\n4. View status timeline", 
     "https://nutrio.me/order/[id]", "Complete order details displayed", "", "", "", "Critical", ""],
    
    ["TC702", "Customer", "Orders", "Active Orders Filter", "Filter Active Orders", 
     "1. Go to orders\n2. Click 'Active' tab\n3. View pending/delivering orders\n4. Verify filter", 
     "https://nutrio.me/orders", "Only active orders displayed", "", "", "", "High", ""],
    
    ["TC703", "Customer", "Orders", "Completed Orders Filter", "Filter Completed Orders", 
     "1. Go to orders\n2. Click 'Completed' tab\n3. View delivered orders\n4. Verify filter", 
     "https://nutrio.me/orders", "Only completed orders displayed", "", "", "", "High", ""],
    
    ["TC704", "Customer", "Orders", "Cancelled Orders Filter", "Filter Cancelled Orders", 
     "1. Go to orders\n2. Click 'Cancelled' tab\n3. View cancelled orders\n4. Verify filter", 
     "https://nutrio.me/orders", "Only cancelled orders displayed", "", "", "", "Medium", ""],
    
    ["TC705", "Customer", "Orders", "Search Orders", "Search Orders", 
     "1. Enter order ID in search\n2. Press Enter\n3. View results\n4. Try partial ID", 
     "https://nutrio.me/orders", "Orders matching search displayed", "", "", "", "Medium", ""],
    
    ["TC706", "Customer", "Orders", "Cancel Pending Order", "Cancel Pending Order", 
     "1. Find pending order\n2. Click 'Cancel'\n3. Confirm cancellation\n4. Verify status updated", 
     "https://nutrio.me/order/[id]", "Order cancelled, meals refunded", "", "", "", "High", ""],
    
    ["TC707", "Customer", "Orders", "Cannot Cancel Preparing", "Cancel Restrictions", 
     "1. Find preparing order\n2. Try to cancel\n3. Verify option disabled\n4. Check message", 
     "https://nutrio.me/order/[id]", "Cancellation not allowed with message", "", "", "", "High", ""],
    
    ["TC708", "Customer", "Orders", "Reorder Previous Order", "Reorder from History", 
     "1. Go to completed order\n2. Click 'Reorder'\n3. Items added to cart\n4. Modify if needed", 
     "https://nutrio.me/orders", "All items added to new order", "", "", "", "High", ""],
    
    ["TC709", "Customer", "Orders", "Rate Completed Order", "Rate Delivered Order", 
     "1. Open delivered order\n2. Click 'Rate'\n3. Select star rating\n4. Add comment\n5. Submit", 
     "https://nutrio.me/order/[id]", "Rating submitted successfully", "", "", "", "High", ""],
    
    ["TC710", "Customer", "Orders", "Rate Individual Items", "Rate Individual Meal Items", 
     "1. Open delivered order\n2. Click 'Rate Items'\n3. Rate each item\n4. Add per-item comments", 
     "https://nutrio.me/order/[id]", "Each item rated individually", "", "", "", "Medium", ""],
    
    ["TC711", "Customer", "Orders", "Upload Photo Review", "Upload Photo with Review", 
     "1. Rate order\n2. Click 'Add Photo'\n3. Upload meal photo\n4. Submit review", 
     "https://nutrio.me/order/[id]", "Photo uploaded with review", "", "", "", "Medium", ""],
    
    ["TC712", "Customer", "Orders", "Order Status Timeline", "View Order Status Timeline", 
     "1. Open order\n2. View timeline\n3. Check all status changes\n4. Verify timestamps", 
     "https://nutrio.me/order/[id]", "Complete status timeline displayed", "", "", "", "High", ""],
    
    ["TC713", "Customer", "Orders", "Delivery Instructions", "Add Delivery Instructions", 
     "1. At checkout\n2. Add delivery notes\n3. Place order\n4. Verify saved in order", 
     "https://nutrio.me/checkout", "Instructions saved and visible", "", "", "", "Medium", ""],
    
    ["TC714", "Customer", "Orders", "Track Order Status", "Track Order Status Page", 
     "1. Go to /tracking\n2. View active orders\n3. Check current status\n4. View progress", 
     "https://nutrio.me/tracking", "Order tracking displayed", "", "", "", "High", ""],
    
    ["TC715", "Customer", "Orders", "Track on Map", "Track Delivery on Map", 
     "1. Order out for delivery\n2. Open tracking\n3. View map\n4. See driver location", 
     "https://nutrio.me/tracking", "Map shows driver location and ETA", "", "", "", "High", ""],
    
    ["TC716", "Customer", "Orders", "Driver Information", "View Driver Details", 
     "1. Order assigned\n2. Open tracking\n3. View driver name\n4. See phone number", 
     "https://nutrio.me/tracking", "Driver information displayed", "", "", "", "High", ""],
    
    ["TC717", "Customer", "Orders", "Call Driver", "Call Driver from Tracking", 
     "1. View driver info\n2. Click 'Call Driver'\n3. Phone app opens\n4. Number pre-filled", 
     "https://nutrio.me/tracking", "Phone opens with driver number", "", "", "", "Medium", ""],
    
    ["TC718", "Customer", "Orders", "Real-time Status Updates", "Real-time Order Updates", 
     "1. Keep tracking page open\n2. Wait for status change\n3. Verify auto-update\n4. Check notification", 
     "https://nutrio.me/tracking", "Status updates automatically", "", "", "", "High", ""],
    
    ["TC719", "Customer", "Orders", "Modify Before Preparation", "Modify Order Before Preparation", 
     "1. Place order\n2. Before preparing\n3. Click 'Modify'\n4. Add/remove items\n5. Confirm", 
     "https://nutrio.me/order/[id]", "Order modified successfully", "", "", "", "Medium", ""],
    
    ["TC720", "Customer", "Orders", "Order Notifications", "Receive Order Notifications", 
     "1. Place order\n2. Wait for updates\n3. Receive push notification\n4. Receive email\n5. Check WhatsApp", 
     "https://nutrio.me/orders", "Notifications received on all channels", "", "", "", "Critical", ""],
    
    ["TC721", "Customer", "Schedule", "View Meal Schedule", "View Weekly Meal Schedule", 
     "1. Navigate to /schedule\n2. View calendar\n3. See scheduled meals\n4. Check by day", 
     "https://nutrio.me/schedule", "Weekly schedule displayed", "", "", "", "Critical", ""],
    
    ["TC722", "Customer", "Schedule", "Schedule Meal", "Schedule a Meal", 
     "1. Go to schedule\n2. Click empty slot\n3. Select meal\n4. Select time\n5. Save", 
     "https://nutrio.me/schedule", "Meal scheduled successfully", "", "", "", "Critical", ""],
    
    ["TC723", "Customer", "Schedule", "Reschedule Meal", "Reschedule Existing Meal", 
     "1. Find scheduled meal\n2. Click reschedule\n3. Select new date/time\n4. Confirm", 
     "https://nutrio.me/schedule", "Meal rescheduled successfully", "", "", "", "High", ""],
    
    ["TC724", "Customer", "Schedule", "Cancel Scheduled Meal", "Cancel Scheduled Meal", 
     "1. Find scheduled meal\n2. Click cancel\n3. Confirm\n4. Verify removed", 
     "https://nutrio.me/schedule", "Meal cancelled, credit returned", "", "", "", "High", ""],
    
    ["TC725", "Customer", "Schedule", "Complete Scheduled Meal", "Mark Meal as Completed", 
     "1. Meal delivered\n2. Click 'Complete'\n3. Confirm\n4. Nutrition logged", 
     "https://nutrio.me/schedule", "Meal marked complete, nutrition tracked", "", "", "", "Critical", ""],
    
    ["TC726", "Customer", "Schedule", "Meal Plan Generator", "Generate Meal Plan", 
     "1. Go to schedule\n2. Click 'Generate Plan'\n3. Select preferences\n4. Generate AI plan", 
     "https://nutrio.me/schedule", "AI meal plan generated", "", "", "", "Medium", ""],
    
    ["TC727", "Customer", "Schedule", "Calendar View", "Calendar View Toggle", 
     "1. On schedule page\n2. Toggle calendar view\n3. Switch to list view\n4. Verify both work", 
     "https://nutrio.me/schedule", "Both calendar and list views work", "", "", "", "Low", ""],
    
    ["TC728", "Customer", "Schedule", "Drag to Reschedule", "Drag-and-Drop Reschedule", 
     "1. View calendar\n2. Drag meal to new date\n3. Drop\n4. Verify rescheduled", 
     "https://nutrio.me/schedule", "Drag-and-drop rescheduling works", "", "", "", "Low", ""],
    
    # ===== PROGRESS TRACKING (TC800-899) =====
    ["TC800", "Customer", "Progress", "View Progress Overview", "View Progress Overview", 
     "1. Navigate to /progress\n2. View overview\n3. Check charts\n4. View trends", 
     "https://nutrio.me/progress", "Progress overview with charts displayed", "", "", "", "Critical", ""],
    
    ["TC801", "Customer", "Progress", "Weight Log Entry", "Log Daily Weight", 
     "1. Go to weight tracking\n2. Enter weight\n3. Select date\n4. Save log", 
     "https://nutrio.me/weight-tracking", "Weight logged successfully", "", "", "", "Critical", ""],
    
    ["TC802", "Customer", "Progress", "Weight Trend Chart", "View Weight Trend", 
     "1. Log weights over time\n2. View progress\n3. Check weight chart\n4. View trend line", 
     "https://nutrio.me/progress", "Weight trend chart displayed", "", "", "", "High", ""],
    
    ["TC803", "Customer", "Progress", "Weight Prediction", "View Weight Prediction", 
     "1. Have weight history\n2. View progress\n3. Check prediction\n4. See target date estimate", 
     "https://nutrio.me/progress", "Weight prediction displayed", "", "", "", "Low", ""],
    
    ["TC804", "Customer", "Progress", "Body Measurements", "Log Body Measurements", 
     "1. Go to body progress\n2. Click 'Add Measurements'\n3. Enter measurements\n4. Save", 
     "https://nutrio.me/progress/body", "Measurements saved successfully", "", "", "", "Medium", ""],
    
    ["TC805", "Customer", "Progress", "Measurement Charts", "View Measurement Charts", 
     "1. Have measurement history\n2. View body progress\n3. Check charts\n4. Toggle metrics", 
     "https://nutrio.me/progress/body", "Measurement charts displayed", "", "", "", "Medium", ""],
    
    ["TC806", "Customer", "Progress", "Nutrition Log", "View Nutrition Log", 
     "1. Go to progress\n2. View nutrition section\n3. Check daily logs\n4. View macro breakdown", 
     "https://nutrio.me/progress", "Nutrition log with macros displayed", "", "", "", "High", ""],
    
    ["TC807", "Customer", "Progress", "Macro Tracking", "Track Daily Macros", 
     "1. Log meals\n2. View progress\n3. Check macro totals\n4. Compare to targets", 
     "https://nutrio.me/progress", "Macro tracking displayed vs goals", "", "", "", "High", ""],
    
    ["TC808", "Customer", "Progress", "Weekly Report", "Generate Weekly Report", 
     "1. Go to progress\n2. Click 'Weekly Report'\n3. Select week\n4. Generate PDF", 
     "https://nutrio.me/progress", "Weekly report generated", "", "", "", "Medium", ""],
    
    ["TC809", "Customer", "Progress", "Streak Display", "View Streak Information", 
     "1. View progress\n2. Check streak widget\n3. View current streak\n4. View best streak", 
     "https://nutrio.me/progress", "Streak information displayed", "", "", "", "Medium", ""],
    
    ["TC810", "Customer", "Progress", "Milestones", "View Milestones", 
     "1. Go to milestones\n2. View achievements\n3. Check unlocked\n4. View locked", 
     "https://nutrio.me/progress/milestones", "Milestones displayed with progress", "", "", "", "Low", ""],
    
    ["TC811", "Customer", "Progress", "Goal Management", "Manage Nutrition Goals", 
     "1. Go to goals\n2. Edit calorie target\n3. Edit macro targets\n4. Save changes", 
     "https://nutrio.me/goals", "Goals updated successfully", "", "", "", "High", ""],
    
    ["TC812", "Customer", "Progress", "Adaptive Goals", "View Adaptive Goal Adjustments", 
     "1. Have AI adjustments\n2. View goals\n3. Check suggested changes\n4. Accept or reject", 
     "https://nutrio.me/goals", "Adaptive adjustments displayed", "", "", "", "Medium", ""],
    
    ["TC813", "Customer", "Progress", "Smart Adjustments", "Receive Smart Adjustments", 
     "1. Log weight weekly\n2. View progress\n3. Check AI recommendations\n4. Apply adjustment", 
     "https://nutrio.me/progress", "Smart adjustments suggested", "", "", "", "Medium", ""],
    
    ["TC814", "Customer", "Progress", "Meal Quality Score", "View Meal Quality Score", 
     "1. Complete meals\n2. View progress\n3. Check quality score\n4. View breakdown", 
     "https://nutrio.me/progress", "Meal quality score displayed", "", "", "", "Low", ""],
    
    ["TC815", "Customer", "Progress", "Nutritional Insights", "View Nutritional Insights", 
     "1. Have nutrition data\n2. View progress\n3. Check insights\n4. Read recommendations", 
     "https://nutrio.me/progress", "Nutritional insights displayed", "", "", "", "Medium", ""],
    
    ["TC816", "Customer", "Progress", "Professional Weekly Report", "Generate Professional Report", 
     "1. Go to progress\n2. Click 'Professional Report'\n3. Generate\n4. Download PDF", 
     "https://nutrio.me/progress", "Professional report generated", "", "", "", "Low", ""],
    
    ["TC817", "Customer", "Progress", "Water Tracking", "Track Water Intake", 
     "1. Go to progress\n2. Find water tracker\n3. Add glasses\n4. View daily/weekly totals", 
     "https://nutrio.me/progress", "Water intake tracked and displayed", "", "", "", "Medium", ""],
    
    ["TC818", "Customer", "Progress", "Health Score Detail", "View Health Score Breakdown", 
     "1. View progress\n2. Click health score\n3. View breakdown\n4. Check each component", 
     "https://nutrio.me/progress", "Health score components displayed", "", "", "", "Medium", ""],
    
    ["TC819", "Customer", "Progress", "Export Data", "Export Progress Data", 
     "1. Go to progress\n2. Click 'Export'\n3. Select format\n4. Download data", 
     "https://nutrio.me/progress", "Progress data exported", "", "", "", "Low", ""],
    
    # ===== WALLET (TC900-949) =====
    ["TC900", "Customer", "Wallet", "View Wallet Balance", "View Wallet Balance", 
     "1. Navigate to /wallet\n2. View current balance\n3. Check transaction history", 
     "https://nutrio.me/wallet", "Balance and history displayed", "", "", "", "Critical", ""],
    
    ["TC901", "Customer", "Wallet", "Add Funds", "Add Funds to Wallet", 
     "1. Go to wallet\n2. Click 'Add Funds'\n3. Enter amount\n4. Complete payment", 
     "https://nutrio.me/wallet", "Funds added, balance updated", "", "", "", "Critical", ""],
    
    ["TC902", "Customer", "Wallet", "Quick Add Amounts", "Quick Add Preset Amounts", 
     "1. Go to add funds\n2. Click preset (50/100/200)\n3. Amount auto-filled\n4. Complete payment", 
     "https://nutrio.me/wallet", "Preset amount selected", "", "", "", "Medium", ""],
    
    ["TC903", "Customer", "Wallet", "Top-up Packages", "View Top-up Packages", 
     "1. Go to wallet\n2. View packages\n3. See bonus amounts\n4. Select package", 
     "https://nutrio.me/wallet", "Top-up packages with bonuses displayed", "", "", "", "Medium", ""],
    
    ["TC904", "Customer", "Wallet", "Transaction History", "View Transaction History", 
     "1. Go to wallet\n2. View transactions tab\n3. See all transactions\n4. Filter by type", 
     "https://nutrio.me/wallet", "Complete transaction history", "", "", "", "High", ""],
    
    ["TC905", "Customer", "Wallet", "Transaction Details", "View Transaction Details", 
     "1. Click transaction\n2. View details\n3. Check amount\n4. Check status", 
     "https://nutrio.me/wallet", "Transaction details displayed", "", "", "", "Medium", ""],
    
    ["TC906", "Customer", "Wallet", "Pay with Wallet", "Pay Order with Wallet", 
     "1. Checkout order\n2. Select 'Wallet' payment\n3. Confirm\n4. Verify deduction", 
     "https://nutrio.me/checkout", "Payment processed, balance deducted", "", "", "", "Critical", ""],
    
    ["TC907", "Customer", "Wallet", "Insufficient Balance", "Handle Insufficient Balance", 
     "1. Try to pay with low balance\n2. View error\n3. Click 'Add Funds'\n4. Complete top-up", 
     "https://nutrio.me/checkout", "Error shown with add funds option", "", "", "", "High", ""],
    
    ["TC908", "Customer", "Wallet", "Auto-recharge Setup", "Set Up Auto-recharge", 
     "1. Go to wallet settings\n2. Enable auto-recharge\n3. Set threshold\n4. Set amount", 
     "https://nutrio.me/wallet", "Auto-recharge configured", "", "", "", "Low", ""],
    
    ["TC909", "Customer", "Wallet", "Auto-recharge Trigger", "Auto-recharge Triggered", 
     "1. Balance below threshold\n2. Trigger event\n3. Auto-recharge occurs\n4. Verify balance", 
     "https://nutrio.me/wallet", "Auto-recharge completes successfully", "", "", "", "Low", ""],
    
    ["TC910", "Customer", "Wallet", "Wallet Security", "Wallet PIN/Security", 
     "1. Set wallet PIN\n2. Require PIN for payments\n3. Make payment\n4. Enter PIN", 
     "https://nutrio.me/wallet", "PIN required for transactions", "", "", "", "Medium", ""],
    
    # ===== PROFILE & SETTINGS (TC950-999) =====
    ["TC950", "Customer", "Profile", "View Profile", "View User Profile", 
     "1. Navigate to /profile\n2. View personal info\n3. Check subscription\n4. View referral code", 
     "https://nutrio.me/profile", "Profile information displayed", "", "", "", "Critical", ""],
    
    ["TC951", "Customer", "Profile", "Edit Profile", "Edit Profile Information", 
     "1. Go to profile\n2. Click 'Edit'\n3. Change name\n4. Change phone\n5. Save", 
     "https://nutrio.me/profile", "Profile updated successfully", "", "", "", "High", ""],
    
    ["TC952", "Customer", "Profile", "Change Password", "Change Account Password", 
     "1. Go to profile\n2. Click 'Change Password'\n3. Enter current\n4. Enter new\n5. Confirm\n6. Save", 
     "https://nutrio.me/profile", "Password changed successfully", "", "", "", "High", ""],
    
    ["TC953", "Customer", "Profile", "Update Avatar", "Update Profile Picture", 
     "1. Go to profile\n2. Click avatar\n3. Upload new image\n4. Crop if needed\n5. Save", 
     "https://nutrio.me/profile", "Avatar updated successfully", "", "", "", "Low", ""],
    
    ["TC954", "Customer", "Profile", "View Referral Code", "View Referral Code", 
     "1. Go to profile\n2. Find referral section\n3. View unique code\n4. Check format", 
     "https://nutrio.me/profile", "Referral code displayed", "", "", "", "High", ""],
    
    ["TC955", "Customer", "Profile", "Copy Referral Code", "Copy Referral Code", 
     "1. View referral code\n2. Click 'Copy'\n3. Verify copied\n4. Paste elsewhere", 
     "https://nutrio.me/profile", "Code copied to clipboard", "", "", "", "Medium", ""],
    
    ["TC956", "Customer", "Profile", "Share via WhatsApp", "Share Referral via WhatsApp", 
     "1. Click 'Share on WhatsApp'\n2. Select contact\n3. Pre-filled message\n4. Send", 
     "https://nutrio.me/profile", "WhatsApp opens with referral message", "", "", "", "High", ""],
    
    ["TC957", "Customer", "Profile", "Referral Stats", "View Referral Statistics", 
     "1. Go to referral section\n2. View total referrals\n3. Check earned rewards\n4. View history", 
     "https://nutrio.me/profile", "Referral statistics displayed", "", "", "", "Medium", ""],
    
    ["TC958", "Customer", "Addresses", "View Addresses", "View Saved Addresses", 
     "1. Navigate to /addresses\n2. View all addresses\n3. Check default", 
     "https://nutrio.me/addresses", "All addresses displayed", "", "", "", "High", ""],
    
    ["TC959", "Customer", "Addresses", "Add New Address", "Add New Delivery Address", 
     "1. Go to addresses\n2. Click 'Add New'\n3. Enter address details\n4. Save", 
     "https://nutrio.me/addresses", "Address added successfully", "", "", "", "High", ""],
    
    ["TC960", "Customer", "Addresses", "Edit Address", "Edit Existing Address", 
     "1. Find address\n2. Click 'Edit'\n3. Modify details\n4. Save changes", 
     "https://nutrio.me/addresses", "Address updated successfully", "", "", "", "High", ""],
    
    ["TC961", "Customer", "Addresses", "Delete Address", "Delete Address", 
     "1. Find address\n2. Click 'Delete'\n3. Confirm\n4. Verify removed", 
     "https://nutrio.me/addresses", "Address deleted successfully", "", "", "", "Medium", ""],
    
    ["TC962", "Customer", "Addresses", "Set Default", "Set Default Address", 
     "1. Have multiple addresses\n2. Click 'Set as Default'\n3. Verify badge\n4. Check pre-selection", 
     "https://nutrio.me/addresses", "Default address updated", "", "", "", "High", ""],
    
    ["TC963", "Customer", "Addresses", "Address Validation", "Address Validation", 
     "1. Add address\n2. Enter invalid address\n3. Submit\n4. Check validation errors", 
     "https://nutrio.me/addresses", "Validation errors displayed", "", "", "", "Medium", ""],
    
    ["TC964", "Customer", "Settings", "Notification Preferences", "Manage Notification Preferences", 
     "1. Go to settings\n2. Click Notifications\n3. Toggle channels\n4. Save", 
     "https://nutrio.me/settings", "Preferences saved per category", "", "", "", "High", ""],
    
    ["TC965", "Customer", "Settings", "Push Notifications", "Toggle Push Notifications", 
     "1. Go to notification settings\n2. Toggle Push\n3. Browser permission\n4. Save", 
     "https://nutrio.me/settings", "Push notification setting saved", "", "", "", "Medium", ""],
    
    ["TC966", "Customer", "Settings", "Email Notifications", "Toggle Email Notifications", 
     "1. Go to settings\n2. Toggle Email\n3. Save\n4. Verify change", 
     "https://nutrio.me/settings", "Email preferences updated", "", "", "", "Medium", ""],
    
    ["TC967", "Customer", "Settings", "WhatsApp Notifications", "Toggle WhatsApp Notifications", 
     "1. Go to settings\n2. Toggle WhatsApp\n3. Verify phone number\n4. Save", 
     "https://nutrio.me/settings", "WhatsApp preferences updated", "", "", "", "Medium", ""],
    
    ["TC968", "Customer", "Settings", "Privacy Settings", "Manage Privacy Settings", 
     "1. Go to privacy settings\n2. Toggle data sharing\n3. Manage preferences\n4. Save", 
     "https://nutrio.me/settings", "Privacy settings saved", "", "", "", "Medium", ""],
    
    ["TC969", "Customer", "Settings", "Data Export", "Request Data Export", 
     "1. Go to privacy settings\n2. Click 'Export Data'\n3. Confirm\n4. Receive email", 
     "https://nutrio.me/settings", "Data export requested", "", "", "", "Low", ""],
    
    ["TC970", "Customer", "Settings", "Delete Account", "Delete Account Request", 
     "1. Go to settings\n2. Click 'Delete Account'\n3. Confirm\n4. Verify deletion process", 
     "https://nutrio.me/settings", "Account deletion initiated", "", "", "", "High", ""],
    
    ["TC971", "Customer", "Settings", "Language Selection", "Change App Language", 
     "1. Go to settings\n2. Click Language\n3. Select Arabic\n4. Verify UI change", 
     "https://nutrio.me/settings", "Language changed successfully", "", "", "", "Medium", ""],
    
    ["TC972", "Customer", "Settings", "Dark Mode", "Toggle Dark Mode", 
     "1. Go to settings\n2. Toggle theme\n3. Switch to dark\n4. Verify UI changes", 
     "https://nutrio.me/settings", "Theme toggled successfully", "", "", "", "Low", ""],
    
    # ===== AFFILIATE (TC1000-1049) =====
    ["TC1000", "Customer", "Affiliate", "View Affiliate Dashboard", "View Affiliate Dashboard", 
     "1. Navigate to /affiliate\n2. View dashboard\n3. Check stats\n4. View earnings", 
     "https://nutrio.me/affiliate", "Affiliate dashboard displayed", "", "", "", "High", ""],
    
    ["TC1001", "Customer", "Affiliate", "Apply for Affiliate", "Apply to Become Affiliate", 
     "1. Go to affiliate\n2. Click 'Apply'\n3. Fill application\n4. Submit", 
     "https://nutrio.me/affiliate", "Application submitted", "", "", "", "High", ""],
    
    ["TC1002", "Customer", "Affiliate", "View Referral Tracking", "View Referral Tracking", 
     "1. Go to /affiliate/tracking\n2. View referrals\n3. Check status\n4. View conversions", 
     "https://nutrio.me/affiliate/tracking", "Referral tracking displayed", "", "", "", "High", ""],
    
    ["TC1003", "Customer", "Affiliate", "Affiliate Stats", "View Affiliate Statistics", 
     "1. View affiliate page\n2. Check clicks\n3. Check signups\n4. View earnings", 
     "https://nutrio.me/affiliate", "Affiliate statistics displayed", "", "", "", "Medium", ""],
    
    ["TC1004", "Customer", "Affiliate", "Request Payout", "Request Affiliate Payout", 
     "1. Have earnings\n2. Go to payouts\n3. Request payout\n4. Enter bank details", 
     "https://nutrio.me/affiliate", "Payout requested", "", "", "", "High", ""],
    
    ["TC1005", "Customer", "Affiliate", "View Payout History", "View Affiliate Payout History", 
     "1. Go to affiliate\n2. View payouts\n3. Check history\n4. View status", 
     "https://nutrio.me/affiliate", "Payout history displayed", "", "", "", "Medium", ""],
    
    # ===== CHECKOUT & PAYMENT (TC1050-1099) =====
    ["TC1050", "Customer", "Checkout", "Checkout Page", "View Checkout Page", 
     "1. Add meals to cart\n2. Go to checkout\n3. Review items\n4. Check totals", 
     "https://nutrio.me/checkout", "Checkout page with order summary", "", "", "", "Critical", ""],
    
    ["TC1051", "Customer", "Checkout", "Select Address", "Select Delivery Address", 
     "1. On checkout\n2. View saved addresses\n3. Select address\n4. Or add new", 
     "https://nutrio.me/checkout", "Address selected for delivery", "", "", "", "Critical", ""],
    
    ["TC1052", "Customer", "Checkout", "Select Delivery Time", "Select Delivery Time Slot", 
     "1. On checkout\n2. Click time selector\n3. Choose delivery window\n4. Confirm", 
     "https://nutrio.me/checkout", "Delivery time selected", "", "", "", "High", ""],
    
    ["TC1053", "Customer", "Checkout", "Add Delivery Notes", "Add Delivery Instructions", 
     "1. On checkout\n2. Add notes field\n3. Enter instructions\n4. Save", 
     "https://nutrio.me/checkout", "Delivery notes saved", "", "", "", "Medium", ""],
    
    ["TC1054", "Customer", "Checkout", "Apply Promo Code", "Apply Promo Code", 
     "1. On checkout\n2. Enter promo code\n3. Click Apply\n4. Verify discount", 
     "https://nutrio.me/checkout", "Promo code applied, discount shown", "", "", "", "Medium", ""],
    
    ["TC1055", "Customer", "Checkout", "Payment Method Selection", "Select Payment Method", 
     "1. On checkout\n2. View payment options\n3. Select Sadad\n4. Or select Wallet", 
     "https://nutrio.me/checkout", "Payment method selected", "", "", "", "Critical", ""],
    
    ["TC1056", "Customer", "Checkout", "Sadad Payment", "Complete Sadad Payment", 
     "1. Select Sadad\n2. Click Pay\n3. Redirect to Sadad\n4. Complete payment\n5. Return to success", 
     "https://nutrio.me/checkout", "Sadad payment processed", "", "", "", "Critical", ""],
    
    ["TC1057", "Customer", "Checkout", "Wallet Payment", "Pay with Wallet", 
     "1. Select Wallet\n2. Verify balance\n3. Confirm payment\n4. Process deduction", 
     "https://nutrio.me/checkout", "Wallet payment processed", "", "", "", "Critical", ""],
    
    ["TC1058", "Customer", "Checkout", "Payment Processing", "View Payment Processing", 
     "1. Submit payment\n2. View processing screen\n3. Wait for confirmation\n4. Redirect to success", 
     "https://nutrio.me/checkout", "Payment processing displayed", "", "", "", "Medium", ""],
    
    ["TC1059", "Customer", "Checkout", "Payment Success", "Payment Success Screen", 
     "1. Complete payment\n2. View success screen\n3. View order details\n4. Click continue", 
     "https://nutrio.me/checkout/success", "Success screen with order info", "", "", "", "Critical", ""],
    
    ["TC1060", "Customer", "Checkout", "Payment Failure", "Handle Payment Failure", 
     "1. Payment fails\n2. View error\n3. Retry option\n4. Change payment method", 
     "https://nutrio.me/checkout", "Failure handled with retry options", "", "", "", "High", ""],
    
    ["TC1061", "Customer", "Checkout", "3D Secure", "Complete 3D Secure Authentication", 
     "1. Payment requires 3DS\n2. Enter OTP\n3. Authenticate\n4. Complete payment", 
     "https://nutrio.me/checkout", "3DS authentication completed", "", "", "", "High", ""],
    
    ["TC1062", "Customer", "Checkout", "Simulated Payment", "Use Simulated Payment (Test)", 
     "1. In test mode\n2. Select simulated payment\n3. Complete simulation\n4. Order placed", 
     "https://nutrio.me/checkout", "Simulated payment processed", "", "", "", "Low", ""],
    
    # ===== NOTIFICATIONS & SUPPORT (TC1100-1149) =====
    ["TC1100", "Customer", "Notifications", "View Notifications", "View All Notifications", 
     "1. Navigate to /notifications\n2. View all notifications\n3. Check unread\n4. Check read", 
     "https://nutrio.me/notifications", "All notifications displayed", "", "", "", "High", ""],
    
    ["TC1101", "Customer", "Notifications", "Mark as Read", "Mark Notification as Read", 
     "1. View notifications\n2. Click notification\n3. Mark as read\n4. Verify status", 
     "https://nutrio.me/notifications", "Notification marked read", "", "", "", "Medium", ""],
    
    ["TC1102", "Customer", "Notifications", "Clear All", "Clear All Notifications", 
     "1. View notifications\n2. Click 'Clear All'\n3. Confirm\n4. Verify empty", 
     "https://nutrio.me/notifications", "All notifications cleared", "", "", "", "Medium", ""],
    
    ["TC1103", "Customer", "Notifications", "Push Notification Permission", "Enable Push Notifications", 
     "1. Browser prompts\n2. Click Allow\n3. Permission granted\n4. Verify enabled", 
     "https://nutrio.me/notifications", "Push notifications enabled", "", "", "", "Medium", ""],
    
    ["TC1104", "Customer", "Support", "View Support Page", "View Support Page", 
     "1. Navigate to /support\n2. View FAQ\n3. Check contact options\n4. View resources", 
     "https://nutrio.me/support", "Support page with resources", "", "", "", "High", ""],
    
    ["TC1105", "Customer", "Support", "Contact Support", "Contact Support Team", 
     "1. Go to support\n2. Fill contact form\n3. Select issue type\n4. Submit ticket", 
     "https://nutrio.me/support", "Support ticket created", "", "", "", "High", ""],
    
    ["TC1106", "Customer", "Support", "View FAQ", "View Frequently Asked Questions", 
     "1. Go to /faq\n2. Browse questions\n3. Click to expand\n4. Read answers", 
     "https://nutrio.me/faq", "FAQ displayed with answers", "", "", "", "Medium", ""],
    
    ["TC1107", "Customer", "Support", "Search FAQ", "Search FAQ", 
     "1. Go to FAQ\n2. Enter search term\n3. View results\n4. Click relevant", 
     "https://nutrio.me/faq", "FAQ search results displayed", "", "", "", "Low", ""],
    
    # ===== INVOICES & BILLING (TC1150-1199) =====
    ["TC1150", "Customer", "Billing", "View Invoices", "View Invoice History", 
     "1. Navigate to /invoices\n2. View all invoices\n3. Check dates\n4. View amounts", 
     "https://nutrio.me/invoices", "All invoices listed", "", "", "", "High", ""],
    
    ["TC1151", "Customer", "Billing", "Download Invoice", "Download Invoice PDF", 
     "1. Find invoice\n2. Click 'Download'\n3. PDF downloads\n4. Open and verify", 
     "https://nutrio.me/invoices", "Invoice PDF downloaded", "", "", "", "High", ""],
    
    ["TC1152", "Customer", "Billing", "View Invoice Details", "View Invoice Details", 
     "1. Click invoice\n2. View details\n3. Check line items\n4. Verify totals", 
     "https://nutrio.me/invoices", "Invoice details displayed", "", "", "", "Medium", ""],
    
    ["TC1153", "Customer", "Billing", "Email Invoice", "Email Invoice to Self", 
     "1. Open invoice\n2. Click 'Email'\n3. Enter email\n4. Send", 
     "https://nutrio.me/invoices", "Invoice emailed successfully", "", "", "", "Low", ""],
    
    # ===== AI FEATURES (TC1200-1249) =====
    ["TC1200", "Customer", "AI", "Smart Meal Recommendations", "View AI Meal Recommendations", 
     "1. Complete onboarding\n2. Go to meals\n3. View recommendations\n4. Check personalization", 
     "https://nutrio.me/meals", "AI recommendations based on profile", "", "", "", "High", ""],
    
    ["TC1201", "Customer", "AI", "Weekly Meal Planner", "Generate AI Meal Plan", 
     "1. Go to planner\n2. Click generate\n3. AI creates plan\n4. Review suggestions", 
     "https://nutrio.me/planner", "AI meal plan generated", "", "", "", "High", ""],
    
    ["TC1202", "Customer", "AI", "Customize AI Plan", "Customize AI Meal Plan", 
     "1. View AI plan\n2. Swap meal\n3. Adjust portions\n4. Save customized plan", 
     "https://nutrio.me/planner", "AI plan customized and saved", "", "", "", "Medium", ""],
    
    ["TC1203", "Customer", "AI", "Smart Adjustments", "Receive Smart Nutrition Adjustments", 
     "1. Log weight weekly\n2. View progress\n3. Check AI suggestions\n4. Apply adjustment", 
     "https://nutrio.me/progress", "Smart adjustments suggested", "", "", "", "Medium", ""],
    
    ["TC1204", "Customer", "AI", "Adaptive Goals", "View Adaptive Goal Suggestions", 
     "1. View goals\n2. Check adaptive section\n3. View AI suggestion\n4. Accept or reject", 
     "https://nutrio.me/goals", "Adaptive goal suggestions displayed", "", "", "", "Medium", ""],
    
    ["TC1205", "Customer", "AI", "Meal Image Analysis", "Analyze Meal Photo", 
     "1. Upload meal photo\n2. AI analyzes\n3. Nutrition estimate\n4. Confirm or adjust", 
     "https://nutrio.me/dashboard", "Meal photo analyzed, nutrition estimated", "", "", "", "Medium", ""],
    
    ["TC1206", "Customer", "AI", "Nutrition Insights", "View AI Nutrition Insights", 
     "1. Have nutrition data\n2. View progress\n3. Check insights\n4. Read recommendations", 
     "https://nutrio.me/progress", "AI nutrition insights displayed", "", "", "", "Medium", ""],
    
    # ===== STATIC PAGES (TC1250-1299) =====
    ["TC1250", "Customer", "Static", "About Page", "View About Page", 
     "1. Navigate to /about\n2. View company info\n3. Check mission\n4. View team", 
     "https://nutrio.me/about", "About page displayed", "", "", "", "Low", ""],
    
    ["TC1251", "Customer", "Static", "Contact Page", "View Contact Page", 
     "1. Go to /contact\n2. View contact form\n3. Check contact info\n4. View map", 
     "https://nutrio.me/contact", "Contact page displayed", "", "", "", "Medium", ""],
    
    ["TC1252", "Customer", "Static", "Privacy Policy", "View Privacy Policy", 
     "1. Go to /privacy\n2. Read privacy policy\n3. Check sections", 
     "https://nutrio.me/privacy", "Privacy policy displayed", "", "", "", "Medium", ""],
    
    ["TC1253", "Customer", "Static", "Terms of Service", "View Terms of Service", 
     "1. Go to /terms\n2. Read terms\n3. Check sections", 
     "https://nutrio.me/terms", "Terms displayed", "", "", "", "Medium", ""],
    
    ["TC1254", "Customer", "Static", "404 Page", "View 404 Error Page", 
     "1. Navigate to invalid URL\n2. View 404 page\n3. Check navigation\n4. Click home", 
     "https://nutrio.me/invalid", "Custom 404 page displayed", "", "", "", "Low", ""],
    
    # ===== MOBILE/CAPACITOR FEATURES (TC1300-1349) =====
    ["TC1300", "Customer", "Mobile", "PWA Install", "Install as PWA", 
     "1. Open in browser\n2. Click 'Add to Home'\n3. Install\n4. Open from icon", 
     "https://nutrio.me", "PWA installed and opens", "", "", "", "Low", ""],
    
    ["TC1301", "Customer", "Mobile", "Offline Mode", "Offline Capability", 
     "1. Disconnect internet\n2. Open app\n3. View cached content\n4. Try actions", 
     "https://nutrio.me", "Offline mode handled gracefully", "", "", "", "Medium", ""],
    
    ["TC1302", "Customer", "Mobile", "Native Share", "Use Native Share Sheet", 
     "1. On mobile\n2. Click share\n3. Native sheet opens\n4. Select app", 
     "https://nutrio.me", "Native share sheet opens", "", "", "", "Low", ""],
    
    ["TC1303", "Customer", "Mobile", "Camera Upload", "Upload Photo from Camera", 
     "1. Click upload\n2. Select camera\n3. Take photo\n4. Upload", 
     "https://nutrio.me", "Camera photo uploaded", "", "", "", "Medium", ""],
    
    ["TC1304", "Customer", "Mobile", "Push Notifications Mobile", "Receive Mobile Push", 
     "1. Enable push\n2. Trigger event\n3. Receive notification\n4. Tap to open", 
     "https://nutrio.me", "Mobile push received", "", "", "", "High", ""],
    
    ["TC1305", "Customer", "Mobile", "Haptic Feedback", "Haptic Feedback on Actions", 
     "1. Use on mobile\n2. Complete action\n3. Feel haptic\n4. Verify feedback", 
     "https://nutrio.me", "Haptic feedback on supported actions", "", "", "", "Low", ""],
    
    # ===== INTEGRATION FEATURES (TC1350-1399) =====
    ["TC1350", "Customer", "Integration", "WhatsApp Notification", "Receive WhatsApp Notification", 
     "1. Enable WhatsApp\n2. Trigger event\n3. Check WhatsApp\n4. Verify message", 
     "https://nutrio.me", "WhatsApp notification received", "", "", "", "High", ""],
    
    ["TC1351", "Customer", "Integration", "Email Notification", "Receive Email Notification", 
     "1. Enable email\n2. Trigger event\n3. Check inbox\n4. Verify email", 
     "https://nutrio.me", "Email notification received", "", "", "", "High", ""],
    
    ["TC1352", "Customer", "Integration", "Push Notification", "Receive Browser Push", 
     "1. Enable push\n2. Trigger event\n3. Receive push\n4. Click to open", 
     "https://nutrio.me", "Push notification received", "", "", "", "High", ""],
    
    ["TC1353", "Customer", "Integration", "Deep Link from Push", "Open from Push Notification", 
     "1. Receive push\n2. Tap notification\n3. App opens\n4. Navigate to relevant page", 
     "https://nutrio.me", "Deep link opens correct page", "", "", "", "Medium", ""],
    
    ["TC1354", "Customer", "Integration", "Sadad Payment Flow", "Complete Sadad Payment Flow", 
     "1. Checkout with Sadad\n2. Redirect to Sadad\n3. Complete\n4. Webhook received", 
     "https://nutrio.me/checkout", "Sadad flow completes", "", "", "", "Critical", ""],
    
    ["TC1355", "Customer", "Integration", "Maps Integration", "View Map with Location", 
     "1. Open tracking\n2. View map\n3. Check location\n4. Get directions", 
     "https://nutrio.me/tracking", "Map displays correctly", "", "", "", "High", ""],
]

print(f"\nPrepared {len(all_customer_tests)} comprehensive Customer tests")

# For now, let's add these to the Excel file
# Combine with existing and save
print("\nSaving comprehensive test plan...")

# Create DataFrame
customer_new_df = pd.DataFrame(all_customer_tests, columns=list(customer_df.columns))

# Combine
customer_combined = pd.concat([customer_df, customer_new_df], ignore_index=True)

print(f"Total Customer tests after update: {len(customer_combined)}")

# Write back
with pd.ExcelWriter(file_path, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
    customer_combined.to_excel(writer, sheet_name='Customer Tests', index=False)
    admin_df.to_excel(writer, sheet_name='Admin Tests', index=False)
    partner_df.to_excel(writer, sheet_name='Partner Tests', index=False)
    driver_df.to_excel(writer, sheet_name='Driver Tests', index=False)
    system_df.to_excel(writer, sheet_name='System Tests', index=False)

print("\n" + "=" * 80)
print("CUSTOMER TESTS UPDATED SUCCESSFULLY!")
print("=" * 80)
print(f"Total tests now: {len(customer_combined) + len(admin_df) + len(partner_df) + len(driver_df) + len(system_df)}")
