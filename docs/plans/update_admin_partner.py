#!/usr/bin/env python3
"""
Complete E2E Test Plan - Admin, Partner, Driver, System Coverage
Adds remaining tests for 100% coverage
"""

import pandas as pd

file_path = r'C:\Users\khamis\Documents\nutrio-fuel-new\docs\plans\Nutrio-Fuel-E2E-Test-Plan.xlsx'

print("=" * 80)
print("ADDING ADMIN, PARTNER, DRIVER, SYSTEM TESTS FOR 100% COVERAGE")
print("=" * 80)

# Read existing sheets
admin_df = pd.read_excel(file_path, sheet_name='Admin Tests')
partner_df = pd.read_excel(file_path, sheet_name='Partner Tests')
driver_df = pd.read_excel(file_path, sheet_name='Driver Tests')
system_df = pd.read_excel(file_path, sheet_name='System Tests')
customer_df = pd.read_excel(file_path, sheet_name='Customer Tests')

print(f"\nCurrent counts:")
print(f"  Customer: {len(customer_df)}")
print(f"  Admin: {len(admin_df)}")
print(f"  Partner: {len(partner_df)}")
print(f"  Driver: {len(driver_df)}")
print(f"  System: {len(system_df)}")

# ========== ADMIN TESTS (400-599) ==========
admin_tests = [
    # AUTH & DASHBOARD
    ["TC400", "Admin", "Auth", "Admin Login", "Login as Admin", 
     "1. Navigate to /admin\n2. Enter admin credentials\n3. Login", 
     "https://nutrio.me/admin/auth", "Admin logged in, dashboard shown", "", "", "", "Critical", ""],
    
    ["TC401", "Admin", "Auth", "Invalid Admin Login", "Login with Invalid Credentials", 
     "1. Enter wrong password\n2. Try login\n3. Check error", 
     "https://nutrio.me/admin/auth", "Access denied, error shown", "", "", "", "High", ""],
    
    ["TC402", "Admin", "Auth", "Non-Admin Access Denied", "Prevent Non-Admin Access", 
     "1. Login as customer\n2. Try /admin\n3. Verify redirect", 
     "https://nutrio.me/admin", "Redirected to customer dashboard", "", "", "", "Critical", ""],
    
    ["TC403", "Admin", "Auth", "Admin Logout", "Admin Logout", 
     "1. Click logout\n2. Verify redirect\n3. Try access", 
     "https://nutrio.me/admin/auth", "Logged out, access denied", "", "", "", "High", ""],
    
    ["TC404", "Admin", "Auth", "Session Timeout", "Admin Session Timeout", 
     "1. Login\n2. Idle 30 mins\n3. Try action", 
     "https://nutrio.me/admin", "Session expired, login required", "", "", "", "Medium", ""],
    
    # DASHBOARD
    ["TC410", "Admin", "Dashboard", "Dashboard Load", "Load Admin Dashboard", 
     "1. Login as admin\n2. View dashboard\n3. Check stats", 
     "https://nutrio.me/admin", "Dashboard with stats displayed", "", "", "", "Critical", ""],
    
    ["TC411", "Admin", "Dashboard", "View Statistics", "View Dashboard Statistics", 
     "1. View dashboard\n2. Check user count\n3. Check order count\n4. Check revenue", 
     "https://nutrio.me/admin", "All statistics displayed accurately", "", "", "", "High", ""],
    
    ["TC412", "Admin", "Dashboard", "Quick Actions", "Use Quick Actions", 
     "1. Click quick action\n2. Navigate to section\n3. Verify", 
     "https://nutrio.me/admin", "Quick action navigates correctly", "", "", "", "Medium", ""],
    
    ["TC413", "Admin", "Dashboard", "Recent Activity", "View Recent Activity", 
     "1. View dashboard\n2. Check recent orders\n3. Check signups\n4. Check applications", 
     "https://nutrio.me/admin", "Recent activity displayed", "", "", "", "Medium", ""],
    
    ["TC414", "Admin", "Dashboard", "Charts Display", "View Dashboard Charts", 
     "1. View dashboard\n2. Check revenue chart\n3. Check orders chart", 
     "https://nutrio.me/admin", "Charts displayed correctly", "", "", "", "Medium", ""],
    
    # USERS MANAGEMENT
    ["TC420", "Admin", "Users", "View All Users", "View All Users List", 
     "1. Go to Users\n2. View list\n3. Check pagination", 
     "https://nutrio.me/admin/users", "All users displayed", "", "", "", "Critical", ""],
    
    ["TC421", "Admin", "Users", "Search Users", "Search for User", 
     "1. Enter search term\n2. Search\n3. View results", 
     "https://nutrio.me/admin/users", "Matching users displayed", "", "", "", "High", ""],
    
    ["TC422", "Admin", "Users", "Filter by Status", "Filter Users by Status", 
     "1. Select filter\n2. Apply\n3. View filtered", 
     "https://nutrio.me/admin/users", "Filtered users displayed", "", "", "", "Medium", ""],
    
    ["TC423", "Admin", "Users", "View User Details", "View User Detail Page", 
     "1. Click user\n2. View details\n3. Check profile\n4. Check orders", 
     "https://nutrio.me/admin/users/[id]", "User details displayed", "", "", "", "Critical", ""],
    
    ["TC424", "Admin", "Users", "Edit User", "Edit User Information", 
     "1. Open user\n2. Click Edit\n3. Change info\n4. Save", 
     "https://nutrio.me/admin/users/[id]/edit", "User updated successfully", "", "", "", "High", ""],
    
    ["TC425", "Admin", "Users", "Deactivate User", "Deactivate User Account", 
     "1. Find user\n2. Click Deactivate\n3. Confirm\n4. Verify", 
     "https://nutrio.me/admin/users", "User deactivated", "", "", "", "High", ""],
    
    ["TC426", "Admin", "Users", "Reactivate User", "Reactivate User", 
     "1. Find deactivated user\n2. Click Activate\n3. Confirm", 
     "https://nutrio.me/admin/users", "User reactivated", "", "", "", "High", ""],
    
    ["TC427", "Admin", "Users", "Delete User", "Permanently Delete User", 
     "1. Find user\n2. Click Delete\n3. Confirm\n4. Verify", 
     "https://nutrio.me/admin/users", "User deleted", "", "", "", "High", ""],
    
    ["TC428", "Admin", "Users", "Impersonate User", "Impersonate User Account", 
     "1. Find user\n2. Click Impersonate\n3. View as user\n4. Exit", 
     "https://nutrio.me/admin/users", "Viewing app as user", "", "", "", "Medium", ""],
    
    ["TC429", "Admin", "Users", "Reset User Password", "Reset User Password", 
     "1. Find user\n2. Click Reset Password\n3. Generate temp\n4. Notify", 
     "https://nutrio.me/admin/users", "Password reset, user notified", "", "", "", "High", ""],
    
    ["TC430", "Admin", "Users", "View User Activity Log", "View User Activity", 
     "1. Open user\n2. Click Activity\n3. View log\n4. Filter", 
     "https://nutrio.me/admin/users/[id]", "Activity log displayed", "", "", "", "Medium", ""],
    
    ["TC431", "Admin", "Users", "Export Users", "Export Users List", 
     "1. Go to users\n2. Click Export\n3. Select format\n4. Download", 
     "https://nutrio.me/admin/users", "Users exported", "", "", "", "Low", ""],
    
    # RESTAURANTS
    ["TC440", "Admin", "Restaurants", "View All Restaurants", "View All Restaurants", 
     "1. Go to Restaurants\n2. View list\n3. Check status", 
     "https://nutrio.me/admin/restaurants", "All restaurants displayed", "", "", "", "Critical", ""],
    
    ["TC441", "Admin", "Restaurants", "View Pending", "View Pending Applications", 
     "1. Click Pending tab\n2. View pending\n3. Check details", 
     "https://nutrio.me/admin/restaurants", "Pending applications displayed", "", "", "", "Critical", ""],
    
    ["TC442", "Admin", "Restaurants", "Review Application", "Review Restaurant Application", 
     "1. Open pending\n2. Review details\n3. Check documents\n4. Check photos", 
     "https://nutrio.me/admin/restaurants/[id]", "Application details displayed", "", "", "", "Critical", ""],
    
    ["TC443", "Admin", "Restaurants", "Approve Restaurant", "Approve Restaurant", 
     "1. Review application\n2. Set payout rate\n3. Click Approve\n4. Confirm", 
     "https://nutrio.me/admin/restaurants", "Restaurant approved", "", "", "", "Critical", ""],
    
    ["TC444", "Admin", "Restaurants", "Reject Restaurant", "Reject Application", 
     "1. Review application\n2. Click Reject\n3. Add reason\n4. Confirm", 
     "https://nutrio.me/admin/restaurants", "Application rejected", "", "", "", "High", ""],
    
    ["TC445", "Admin", "Restaurants", "Request More Info", "Request Additional Info", 
     "1. Review application\n2. Click Request Info\n3. Specify needs\n4. Send", 
     "https://nutrio.me/admin/restaurants", "Request sent to restaurant", "", "", "", "Medium", ""],
    
    ["TC446", "Admin", "Restaurants", "Bulk Approve", "Bulk Approve Restaurants", 
     "1. Select multiple\n2. Click Bulk Approve\n3. Set rate\n4. Confirm", 
     "https://nutrio.me/admin/restaurants", "All selected approved", "", "", "", "Medium", ""],
    
    ["TC447", "Admin", "Restaurants", "View Restaurant Details", "View Restaurant Profile", 
     "1. Click restaurant\n2. View profile\n3. Check menu\n4. Check earnings", 
     "https://nutrio.me/admin/restaurants/[id]", "Restaurant details displayed", "", "", "", "Critical", ""],
    
    ["TC448", "Admin", "Restaurants", "Edit Restaurant", "Edit Restaurant Info", 
     "1. Open restaurant\n2. Click Edit\n3. Modify\n4. Save", 
     "https://nutrio.me/admin/restaurants/[id]/edit", "Restaurant updated", "", "", "", "Medium", ""],
    
    ["TC449", "Admin", "Restaurants", "Set Payout Rate", "Set Restaurant Payout Rate", 
     "1. Open restaurant\n2. Edit payout rate\n3. Save", 
     "https://nutrio.me/admin/restaurants", "Payout rate updated", "", "", "", "High", ""],
    
    ["TC450", "Admin", "Restaurants", "Suspend Restaurant", "Suspend Restaurant", 
     "1. Find restaurant\n2. Click Suspend\n3. Add reason\n4. Confirm", 
     "https://nutrio.me/admin/restaurants", "Restaurant suspended", "", "", "", "High", ""],
    
    ["TC451", "Admin", "Restaurants", "Reactivate Restaurant", "Reactivate Restaurant", 
     "1. Find suspended\n2. Click Reactivate\n3. Confirm", 
     "https://nutrio.me/admin/restaurants", "Restaurant reactivated", "", "", "", "High", ""],
    
    ["TC452", "Admin", "Restaurants", "Delete Restaurant", "Delete Restaurant", 
     "1. Find restaurant\n2. Click Delete\n3. Confirm", 
     "https://nutrio.me/admin/restaurants", "Restaurant deleted", "", "", "", "Medium", ""],
    
    ["TC453", "Admin", "Restaurants", "View Performance", "View Restaurant Performance", 
     "1. Open restaurant\n2. View performance\n3. Check trends\n4. Compare", 
     "https://nutrio.me/admin/restaurants/[id]", "Performance metrics displayed", "", "", "", "Medium", ""],
    
    # ORDERS
    ["TC460", "Admin", "Orders", "View All Orders", "View All Orders", 
     "1. Go to Orders\n2. View list\n3. Check filters", 
     "https://nutrio.me/admin/orders", "All orders displayed", "", "", "", "Critical", ""],
    
    ["TC461", "Admin", "Orders", "Filter by Status", "Filter Orders by Status", 
     "1. Select status\n2. Apply filter\n3. View results", 
     "https://nutrio.me/admin/orders", "Filtered orders displayed", "", "", "", "High", ""],
    
    ["TC462", "Admin", "Orders", "Search Orders", "Search for Order", 
     "1. Enter order ID\n2. Search\n3. View results", 
     "https://nutrio.me/admin/orders", "Matching orders displayed", "", "", "", "High", ""],
    
    ["TC463", "Admin", "Orders", "View Order Details", "View Order Details", 
     "1. Click order\n2. View details\n3. Check items\n4. Check customer", 
     "https://nutrio.me/admin/orders/[id]", "Order details displayed", "", "", "", "Critical", ""],
    
    ["TC464", "Admin", "Orders", "Update Order Status", "Update Order Status", 
     "1. Open order\n2. Change status\n3. Save", 
     "https://nutrio.me/admin/orders/[id]/edit", "Status updated", "", "", "", "High", ""],
    
    ["TC465", "Admin", "Orders", "Cancel Order", "Cancel Order", 
     "1. Open order\n2. Click Cancel\n3. Add reason\n4. Confirm", 
     "https://nutrio.me/admin/orders", "Order cancelled", "", "", "", "High", ""],
    
    ["TC466", "Admin", "Orders", "Process Refund", "Process Order Refund", 
     "1. Open order\n2. Click Refund\n3. Enter amount\n4. Confirm", 
     "https://nutrio.me/admin/orders", "Refund processed", "", "", "", "Critical", ""],
    
    ["TC467", "Admin", "Orders", "Assign Driver", "Assign Driver to Order", 
     "1. Open order\n2. Click Assign\n3. Select driver\n4. Save", 
     "https://nutrio.me/admin/orders", "Driver assigned", "", "", "", "High", ""],
    
    ["TC468", "Admin", "Orders", "View Order Timeline", "View Order Status Timeline", 
     "1. Open order\n2. View timeline\n3. Check history", 
     "https://nutrio.me/admin/orders/[id]", "Timeline displayed", "", "", "", "Medium", ""],
    
    ["TC469", "Admin", "Orders", "Bulk Status Update", "Bulk Update Order Status", 
     "1. Select multiple\n2. Click bulk action\n3. Select status\n4. Confirm", 
     "https://nutrio.me/admin/orders", "All selected updated", "", "", "", "Medium", ""],
    
    # SUBSCRIPTIONS
    ["TC480", "Admin", "Subscriptions", "View All Subscriptions", "View All Subscriptions", 
     "1. Go to Subscriptions\n2. View list\n3. Check filters", 
     "https://nutrio.me/admin/subscriptions", "All subscriptions displayed", "", "", "", "Critical", ""],
    
    ["TC481", "Admin", "Subscriptions", "View Subscription Plans", "View Subscription Plans", 
     "1. Click Plans tab\n2. View all tiers\n3. Check pricing", 
     "https://nutrio.me/admin/subscriptions", "All plans displayed", "", "", "", "High", ""],
    
    ["TC482", "Admin", "Subscriptions", "Edit Plan", "Edit Subscription Plan", 
     "1. Click plan\n2. Edit details\n3. Save changes", 
     "https://nutrio.me/admin/subscriptions/[id]/edit", "Plan updated", "", "", "", "Medium", ""],
    
    ["TC483", "Admin", "Subscriptions", "Add Plan", "Add New Plan", 
     "1. Click Add\n2. Fill details\n3. Save", 
     "https://nutrio.me/admin/subscriptions/new", "New plan created", "", "", "", "Low", ""],
    
    ["TC484", "Admin", "Subscriptions", "Cancel Subscription", "Cancel Customer Subscription", 
     "1. Find subscription\n2. Click Cancel\n3. Confirm", 
     "https://nutrio.me/admin/subscriptions", "Subscription cancelled", "", "", "", "High", ""],
    
    ["TC485", "Admin", "Subscriptions", "Extend Subscription", "Extend Subscription", 
     "1. Open subscription\n2. Add days\n3. Save", 
     "https://nutrio.me/admin/subscriptions", "Subscription extended", "", "", "", "Low", ""],
    
    ["TC486", "Admin", "Subscriptions", "Freeze Management", "Manage Frozen Subscriptions", 
     "1. Go to Freeze Management\n2. View frozen\n3. Edit dates\n4. Cancel freeze", 
     "https://nutrio.me/admin/freeze-management", "Freeze managed", "", "", "", "Medium", ""],
    
    ["TC487", "Admin", "Subscriptions", "Subscription Dashboard", "View Subscription Dashboard", 
     "1. Go to subscription dashboard\n2. View stats\n3. Check churn\n4. View revenue", 
     "https://nutrio.me/admin/subscriptions/dashboard", "Dashboard displayed", "", "", "", "High", ""],
    
    # PAYOUTS
    ["TC490", "Admin", "Payouts", "View Pending Payouts", "View Pending Payouts", 
     "1. Go to Payouts\n2. View pending\n3. Check amounts", 
     "https://nutrio.me/admin/payouts", "Pending payouts displayed", "", "", "", "Critical", ""],
    
    ["TC491", "Admin", "Payouts", "Calculate Payouts", "Calculate Weekly Payouts", 
     "1. Select week\n2. Click Calculate\n3. Review\n4. Verify", 
     "https://nutrio.me/admin/payouts", "Payouts calculated", "", "", "", "Critical", ""],
    
    ["TC492", "Admin", "Payouts", "Preview Payouts", "Preview Before Processing", 
     "1. Calculate\n2. Click Preview\n3. Review each\n4. Verify", 
     "https://nutrio.me/admin/payouts", "Preview displayed", "", "", "", "High", ""],
    
    ["TC493", "Admin", "Payouts", "Process Payout", "Process Payout", 
     "1. Select restaurants\n2. Click Process\n3. Confirm", 
     "https://nutrio.me/admin/payouts", "Payouts processed", "", "", "", "Critical", ""],
    
    ["TC494", "Admin", "Payouts", "Process Individual", "Process Individual Payout", 
     "1. Find restaurant\n2. Click Process\n3. Confirm\n4. Mark paid", 
     "https://nutrio.me/admin/payouts", "Individual payout processed", "", "", "", "Medium", ""],
    
    ["TC495", "Admin", "Payouts", "View Payout History", "View Payout History", 
     "1. Click History\n2. View past\n3. Check status", 
     "https://nutrio.me/admin/payouts", "History displayed", "", "", "", "Medium", ""],
    
    ["TC496", "Admin", "Payouts", "Adjust Payout", "Adjust Payout Amount", 
     "1. Find payout\n2. Edit amount\n3. Add note\n4. Save", 
     "https://nutrio.me/admin/payouts", "Payout adjusted", "", "", "", "Medium", ""],
    
    ["TC497", "Admin", "Payouts", "Handle Dispute", "Handle Payout Dispute", 
     "1. Receive dispute\n2. Review\n3. Resolve\n4. Adjust if needed", 
     "https://nutrio.me/admin/payouts", "Dispute resolved", "", "", "", "High", ""],
    
    ["TC498", "Admin", "Payouts", "Export Payout Data", "Export Payout Data", 
     "1. Select range\n2. Click Export\n3. Download", 
     "https://nutrio.me/admin/payouts", "Data exported", "", "", "", "Low", ""],
    
    # AFFILIATE
    ["TC500", "Admin", "Affiliate", "View Applications", "View Affiliate Applications", 
     "1. Go to Affiliate Applications\n2. View pending\n3. Review", 
     "https://nutrio.me/admin/affiliate-applications", "Applications displayed", "", "", "", "High", ""],
    
    ["TC501", "Admin", "Affiliate", "Approve Application", "Approve Affiliate", 
     "1. Review app\n2. Click Approve\n3. Confirm", 
     "https://nutrio.me/admin/affiliate-applications", "Application approved", "", "", "", "High", ""],
    
    ["TC502", "Admin", "Affiliate", "Reject Application", "Reject Affiliate", 
     "1. Review app\n2. Click Reject\n3. Add reason\n4. Confirm", 
     "https://nutrio.me/admin/affiliate-applications", "Application rejected", "", "", "", "High", ""],
    
    ["TC503", "Admin", "Affiliate", "View Affiliate Payouts", "View Affiliate Payouts", 
     "1. Go to Affiliate Payouts\n2. View pending\n3. Check amounts", 
     "https://nutrio.me/admin/affiliate-payouts", "Payouts displayed", "", "", "", "High", ""],
    
    ["TC504", "Admin", "Affiliate", "Process Affiliate Payout", "Process Affiliate Payout", 
     "1. Select affiliates\n2. Process\n3. Confirm\n4. Mark paid", 
     "https://nutrio.me/admin/affiliate-payouts", "Payouts processed", "", "", "", "High", ""],
    
    # ANALYTICS
    ["TC510", "Admin", "Analytics", "View Analytics", "View Analytics Dashboard", 
     "1. Go to Analytics\n2. View charts\n3. Check metrics", 
     "https://nutrio.me/admin/analytics", "Analytics displayed", "", "", "", "Critical", ""],
    
    ["TC511", "Admin", "Analytics", "Revenue Trends", "View Revenue Trends", 
     "1. Go to analytics\n2. Select range\n3. View revenue\n4. Compare periods", 
     "https://nutrio.me/admin/analytics", "Revenue trends displayed", "", "", "", "High", ""],
    
    ["TC512", "Admin", "Analytics", "Customer Retention", "View Retention Metrics", 
     "1. Click Retention\n2. View cohorts\n3. Check churn", 
     "https://nutrio.me/admin/retention-analytics", "Retention metrics displayed", "", "", "", "High", ""],
    
    ["TC513", "Admin", "Analytics", "Peak Hours", "View Peak Hours", 
     "1. Click Peak Hours\n2. View heatmap\n3. Identify busy", 
     "https://nutrio.me/admin/analytics", "Peak hours displayed", "", "", "", "Medium", ""],
    
    ["TC514", "Admin", "Analytics", "Export Report", "Export Analytics Report", 
     "1. Select metrics\n2. Select range\n3. Click Export\n4. Download", 
     "https://nutrio.me/admin/analytics", "Report exported", "", "", "", "Low", ""],
    
    # CONTENT
    ["TC520", "Admin", "Content", "View All Meals", "View All Meals", 
     "1. Go to Content > Meals\n2. View all\n3. Check filters", 
     "https://nutrio.me/admin/content", "All meals displayed", "", "", "", "Medium", ""],
    
    ["TC521", "Admin", "Content", "Edit Meal", "Edit Any Meal", 
     "1. Find meal\n2. Click Edit\n3. Modify\n4. Save", 
     "https://nutrio.me/admin/content/[id]/edit", "Meal updated", "", "", "", "Medium", ""],
    
    ["TC522", "Admin", "Content", "Delete Meal", "Delete Meal", 
     "1. Find meal\n2. Click Delete\n3. Confirm", 
     "https://nutrio.me/admin/content", "Meal deleted", "", "", "", "Medium", ""],
    
    ["TC523", "Admin", "Content", "Bulk Edit Meals", "Bulk Edit Meals", 
     "1. Select multiple\n2. Click Bulk Edit\n3. Change field\n4. Apply", 
     "https://nutrio.me/admin/content", "All selected updated", "", "", "", "Low", ""],
    
    ["TC524", "Admin", "Content", "Manage Diet Tags", "Manage Dietary Tags", 
     "1. Go to Diet Tags\n2. Add new\n3. Edit\n4. Delete", 
     "https://nutrio.me/admin/diet-tags", "Tags updated", "", "", "", "Medium", ""],
    
    ["TC525", "Admin", "Content", "Featured Restaurants", "Manage Featured", 
     "1. Go to Featured\n2. Add restaurant\n3. Set priority\n4. Schedule", 
     "https://nutrio.me/admin/featured", "Featured updated", "", "", "", "Low", ""],
    
    ["TC526", "Admin", "Content", "Moderate Reviews", "Moderate Reviews", 
     "1. Go to Reviews\n2. Filter inappropriate\n3. Review\n4. Approve/Remove", 
     "https://nutrio.me/admin/content", "Reviews moderated", "", "", "", "Medium", ""],
    
    ["TC527", "Admin", "Content", "Create Promo", "Create Promotional Banner", 
     "1. Go to Banners\n2. Upload image\n3. Set link\n4. Publish", 
     "https://nutrio.me/admin/content/new", "Banner published", "", "", "", "Low", ""],
    
    # GAMIFICATION
    ["TC530", "Admin", "Gamification", "Streak Rewards", "Manage Streak Rewards", 
     "1. Go to Streak Rewards\n2. View rewards\n3. Edit thresholds\n4. Add new", 
     "https://nutrio.me/admin/streak-rewards", "Streak rewards configured", "", "", "", "Medium", ""],
    
    ["TC531", "Admin", "Gamification", "Milestones", "Manage Milestones", 
     "1. Go to Milestones\n2. View all\n3. Edit criteria\n4. Toggle status", 
     "https://nutrio.me/admin/milestones", "Milestones configured", "", "", "", "Medium", ""],
    
    # AI
    ["TC540", "Admin", "AI", "AI Engine Monitor", "Monitor AI Performance", 
     "1. Go to AI Monitor\n2. View accuracy\n3. Check recommendations\n4. Review adjustments", 
     "https://nutrio.me/admin/ai-monitor", "AI metrics displayed", "", "", "", "Medium", ""],
    
    # SETTINGS
    ["TC550", "Admin", "Settings", "General Settings", "Update General Settings", 
     "1. Go to Settings\n2. Modify general\n3. Save", 
     "https://nutrio.me/admin/settings", "Settings saved", "", "", "", "Medium", ""],
    
    ["TC551", "Admin", "Settings", "Payment Settings", "Configure Payment", 
     "1. Go to Payment\n2. Configure Sadad\n3. Test\n4. Save", 
     "https://nutrio.me/admin/settings", "Payment configured", "", "", "", "Critical", ""],
    
    ["TC552", "Admin", "Settings", "Configure Sadad", "Configure Sadad Gateway", 
     "1. Enter credentials\n2. Test connection\n3. Set webhook\n4. Save", 
     "https://nutrio.me/admin/settings", "Sadad configured", "", "", "", "Critical", ""],
    
    ["TC553", "Admin", "Settings", "Notification Templates", "Edit Notification Templates", 
     "1. Go to Notifications\n2. Select template\n3. Edit\n4. Save", 
     "https://nutrio.me/admin/settings", "Template updated", "", "", "", "Low", ""],
    
    ["TC554", "Admin", "Settings", "Referral Settings", "Configure Referral Program", 
     "1. Go to Referral\n2. Set rewards\n3. Set limits\n4. Save", 
     "https://nutrio.me/admin/settings", "Referral configured", "", "", "", "Medium", ""],
    
    ["TC555", "Admin", "Settings", "Maintenance Mode", "Toggle Maintenance Mode", 
     "1. Go to System\n2. Enable maintenance\n3. Set message\n4. Save", 
     "https://nutrio.me/admin/settings", "Maintenance activated", "", "", "", "Low", ""],
    
    # EXPORTS
    ["TC560", "Admin", "Exports", "Data Export", "Export Platform Data", 
     "1. Go to Exports\n2. Select type\n3. Set range\n4. Generate", 
     "https://nutrio.me/admin/exports", "Export generated", "", "", "", "Medium", ""],
    
    # IP MANAGEMENT
    ["TC570", "Admin", "IP", "View Blocked IPs", "View Blocked IPs", 
     "1. Go to IP Management\n2. View blocked\n3. Check reasons", 
     "https://nutrio.me/admin/ip-management", "Blocked IPs displayed", "", "", "", "High", ""],
    
    ["TC571", "Admin", "IP", "Block IP", "Block IP Address", 
     "1. Add IP\n2. Set reason\n3. Save", 
     "https://nutrio.me/admin/ip-management", "IP blocked", "", "", "", "High", ""],
    
    ["TC572", "Admin", "IP", "Unblock IP", "Unblock IP", 
     "1. Find blocked\n2. Click Unblock\n3. Confirm", 
     "https://nutrio.me/admin/ip-management", "IP unblocked", "", "", "", "High", ""],
    
    # DRIVERS
    ["TC580", "Admin", "Drivers", "View All Drivers", "View All Drivers", 
     "1. Go to Drivers\n2. View list\n3. Check status", 
     "https://nutrio.me/admin/drivers", "All drivers displayed", "", "", "", "High", ""],
    
    ["TC581", "Admin", "Drivers", "Add Driver", "Add New Driver", 
     "1. Click Add\n2. Fill details\n3. Save", 
     "https://nutrio.me/admin/drivers", "Driver added", "", "", "", "High", ""],
    
    ["TC582", "Admin", "Drivers", "Edit Driver", "Edit Driver", 
     "1. Find driver\n2. Edit\n3. Save", 
     "https://nutrio.me/admin/drivers", "Driver updated", "", "", "", "Medium", ""],
    
    ["TC583", "Admin", "Drivers", "Deactivate Driver", "Deactivate Driver", 
     "1. Find driver\n2. Deactivate\n3. Confirm", 
     "https://nutrio.me/admin/drivers", "Driver deactivated", "", "", "", "High", ""],
    
    # DELIVERIES
    ["TC590", "Admin", "Deliveries", "View Deliveries", "View All Deliveries", 
     "1. Go to Deliveries\n2. View list\n3. Check status", 
     "https://nutrio.me/admin/deliveries", "All deliveries displayed", "", "", "", "High", ""],
    
    ["TC591", "Admin", "Deliveries", "Track Delivery", "Track Delivery on Map", 
     "1. Open delivery\n2. View map\n3. Track driver", 
     "https://nutrio.me/admin/deliveries", "Map tracking displayed", "", "", "", "Medium", ""],
    
    # SUPPORT
    ["TC595", "Admin", "Support", "View Support Tickets", "View Support Tickets", 
     "1. Go to Support\n2. View tickets\n3. Check status", 
     "https://nutrio.me/admin/support", "Tickets displayed", "", "", "", "High", ""],
    
    ["TC596", "Admin", "Support", "Respond to Ticket", "Respond to Ticket", 
     "1. Open ticket\n2. Read issue\n3. Respond\n4. Send", 
     "https://nutrio.me/admin/support", "Response sent", "", "", "", "High", ""],
    
    ["TC597", "Admin", "Support", "Close Ticket", "Close Support Ticket", 
     "1. Open ticket\n2. Resolve\n3. Close\n4. Confirm", 
     "https://nutrio.me/admin/support", "Ticket closed", "", "", "", "Medium", ""],
    
    ["TC598", "Admin", "Support", "View Notifications", "View Admin Notifications", 
     "1. Go to Notifications\n2. View all\n3. Mark read", 
     "https://nutrio.me/admin/notifications", "Notifications displayed", "", "", "", "Medium", ""],
]

# ========== PARTNER TESTS (200-399) ==========
partner_tests = [
    # AUTH
    ["TC200", "Partner", "Auth", "Partner Login", "Login as Partner", 
     "1. Navigate to /partner/auth\n2. Enter credentials\n3. Login", 
     "https://nutrio.me/partner/auth", "Partner logged in", "", "", "", "Critical", ""],
    
    ["TC201", "Partner", "Auth", "Invalid Login", "Invalid Credentials", 
     "1. Enter wrong password\n2. Try login\n3. Check error", 
     "https://nutrio.me/partner/auth", "Error displayed", "", "", "", "High", ""],
    
    ["TC202", "Partner", "Auth", "Partner Logout", "Logout", 
     "1. Click user menu\n2. Click Logout\n3. Verify", 
     "https://nutrio.me/partner/auth", "Logged out", "", "", "", "High", ""],
    
    ["TC203", "Partner", "Auth", "Password Reset", "Password Reset", 
     "1. Click Forgot\n2. Enter email\n3. Check email\n4. Reset", 
     "https://nutrio.me/partner/auth", "Password reset successful", "", "", "", "High", ""],
    
    # ONBOARDING
    ["TC210", "Partner", "Onboarding", "Step 1 - Basic Info", "Onboarding Step 1", 
     "1. Start onboarding\n2. Fill name\n3. Add description\n4. Select cuisine\n5. Continue", 
     "https://nutrio.me/partner/onboarding", "Step 1 saved", "", "", "", "High", ""],
    
    ["TC211", "Partner", "Onboarding", "Step 2 - Location", "Onboarding Step 2", 
     "1. Enter address\n2. Pin location\n3. Add phone\n4. Set hours\n5. Continue", 
     "https://nutrio.me/partner/onboarding", "Step 2 saved", "", "", "", "High", ""],
    
    ["TC212", "Partner", "Onboarding", "Step 3 - Media", "Onboarding Step 3", 
     "1. Upload logo\n2. Upload photos\n3. Verify preview\n4. Continue", 
     "https://nutrio.me/partner/onboarding", "Images uploaded", "", "", "", "High", ""],
    
    ["TC213", "Partner", "Onboarding", "Step 4 - Kitchen", "Onboarding Step 4", 
     "1. Set prep time\n2. Set capacity\n3. Add bank info\n4. Continue", 
     "https://nutrio.me/partner/onboarding", "Step 4 saved", "", "", "", "Critical", ""],
    
    ["TC214", "Partner", "Onboarding", "Step 5 - Review", "Onboarding Step 5", 
     "1. Review all info\n2. Accept terms\n3. Submit\n4. Verify pending", 
     "https://nutrio.me/partner/onboarding", "Application submitted", "", "", "", "Critical", ""],
    
    ["TC215", "Partner", "Onboarding", "Save Progress", "Save Onboarding Progress", 
     "1. Fill partial\n2. Click Save\n3. Logout\n4. Resume", 
     "https://nutrio.me/partner/onboarding", "Progress saved", "", "", "", "Medium", ""],
    
    ["TC216", "Partner", "Onboarding", "Pending Approval", "View Pending Approval", 
     "1. Submit application\n2. View pending page\n3. Check status", 
     "https://nutrio.me/partner/pending-approval", "Pending status displayed", "", "", "", "High", ""],
    
    # DASHBOARD
    ["TC220", "Partner", "Dashboard", "Dashboard Load", "Load Partner Dashboard", 
     "1. Login as partner\n2. View dashboard\n3. Check widgets", 
     "https://nutrio.me/partner/dashboard", "Dashboard loaded", "", "", "", "Critical", ""],
    
    ["TC221", "Partner", "Dashboard", "Today's Orders", "View Today's Orders", 
     "1. View dashboard\n2. Check orders widget\n3. View count", 
     "https://nutrio.me/partner/dashboard", "Today's orders displayed", "", "", "", "High", ""],
    
    ["TC222", "Partner", "Dashboard", "Earnings Summary", "View Earnings Summary", 
     "1. View dashboard\n2. Check earnings\n3. View today's\n4. View weekly", 
     "https://nutrio.me/partner/dashboard", "Earnings summary displayed", "", "", "", "High", ""],
    
    ["TC223", "Partner", "Dashboard", "Quick Actions", "Use Quick Actions", 
     "1. Click 'View Orders'\n2. Return\n3. Click 'Update Menu'", 
     "https://nutrio.me/partner/dashboard", "Quick actions work", "", "", "", "Medium", ""],
    
    ["TC224", "Partner", "Dashboard", "Real-time Updates", "Real-time Order Updates", 
     "1. Keep dashboard open\n2. Customer places order\n3. Verify appears", 
     "https://nutrio.me/partner/dashboard", "Order appears automatically", "", "", "", "High", ""],
    
    ["TC225", "Partner", "Dashboard", "Performance Charts", "View Performance Charts", 
     "1. View dashboard\n2. Scroll to charts\n3. View orders\n4. View earnings", 
     "https://nutrio.me/partner/dashboard", "Charts displayed", "", "", "", "Low", ""],
    
    ["TC226", "Partner", "Dashboard", "Quick Stats", "View Quick Stats Cards", 
     "1. View dashboard\n2. Check stats cards\n3. Verify accuracy", 
     "https://nutrio.me/partner/dashboard", "Stats cards displayed", "", "", "", "High", ""],
    
    # ORDERS
    ["TC230", "Partner", "Orders", "View Active Orders", "View Active Orders", 
     "1. Go to Orders\n2. View active\n3. Check details", 
     "https://nutrio.me/partner/orders", "Active orders displayed", "", "", "", "Critical", ""],
    
    ["TC231", "Partner", "Orders", "View Order History", "View Order History", 
     "1. Click History tab\n2. View past\n3. Check dates", 
     "https://nutrio.me/partner/orders", "Order history displayed", "", "", "", "High", ""],
    
    ["TC232", "Partner", "Orders", "Accept Order", "Accept New Order", 
     "1. New order notification\n2. Click Accept\n3. Confirm", 
     "https://nutrio.me/partner/orders", "Order accepted", "", "", "", "Critical", ""],
    
    ["TC233", "Partner", "Orders", "Update Status", "Update Order Status", 
     "1. Open order\n2. Click 'Mark Preparing'\n3. Later 'Mark Ready'", 
     "https://nutrio.me/partner/orders", "Status updated", "", "", "", "Critical", ""],
    
    ["TC234", "Partner", "Orders", "View Order Details", "View Order Details", 
     "1. Click order\n2. View details\n3. Check items\n4. Check customer", 
     "https://nutrio.me/partner/orders/[id]", "Order details displayed", "", "", "", "High", ""],
    
    ["TC235", "Partner", "Orders", "Print Order", "Print Order Ticket", 
     "1. Open order\n2. Click Print\n3. Verify format", 
     "https://nutrio.me/partner/orders", "Print dialog opens", "", "", "", "Low", ""],
    
    ["TC236", "Partner", "Orders", "Filter by Status", "Filter Orders by Status", 
     "1. On orders\n2. Click filter\n3. Select status\n4. Apply", 
     "https://nutrio.me/partner/orders", "Orders filtered", "", "", "", "Medium", ""],
    
    ["TC237", "Partner", "Orders", "Search Orders", "Search Orders", 
     "1. Enter order ID\n2. Search\n3. View results", 
     "https://nutrio.me/partner/orders", "Search results displayed", "", "", "", "Medium", ""],
    
    ["TC238", "Partner", "Orders", "Order Timeline", "View Order Timeline", 
     "1. Open order\n2. View timeline\n3. Check timestamps", 
     "https://nutrio.me/partner/orders/[id]", "Timeline displayed", "", "", "", "Medium", ""],
    
    ["TC239", "Partner", "Orders", "Customer Details", "View Customer in Order", 
     "1. Open order\n2. View customer\n3. Check name\n4. Check phone", 
     "https://nutrio.me/partner/orders/[id]", "Customer info displayed", "", "", "", "High", ""],
    
    # MENU
    ["TC240", "Partner", "Menu", "View Menu", "View Current Menu", 
     "1. Go to Menu\n2. View items\n3. Check photos", 
     "https://nutrio.me/partner/menu", "Menu displayed", "", "", "", "Critical", ""],
    
    ["TC241", "Partner", "Menu", "Add Menu Item", "Add New Menu Item", 
     "1. Click 'Add'\n2. Fill name\n3. Add description\n4. Add nutrition\n5. Upload photo\n6. Save", 
     "https://nutrio.me/partner/menu/new", "Item added", "", "", "", "High", ""],
    
    ["TC242", "Partner", "Menu", "Edit Menu Item", "Edit Menu Item", 
     "1. Click item\n2. Click Edit\n3. Change details\n4. Save", 
     "https://nutrio.me/partner/menu/[id]/edit", "Item updated", "", "", "", "High", ""],
    
    ["TC243", "Partner", "Menu", "Delete Menu Item", "Delete Menu Item", 
     "1. Click item\n2. Click Delete\n3. Confirm", 
     "https://nutrio.me/partner/menu", "Item deleted", "", "", "", "Medium", ""],
    
    ["TC244", "Partner", "Menu", "Toggle Availability", "Toggle Item Availability", 
     "1. Find item\n2. Toggle switch\n3. Verify status", 
     "https://nutrio.me/partner/menu", "Availability toggled", "", "", "", "High", ""],
    
    ["TC245", "Partner", "Menu", "Upload Photo", "Upload Meal Photo", 
     "1. Add/Edit meal\n2. Click Upload\n3. Select image\n4. Save", 
     "https://nutrio.me/partner/menu", "Photo uploaded", "", "", "", "Medium", ""],
    
    ["TC246", "Partner", "Menu", "Add Nutrition Info", "Add Nutrition Information", 
     "1. Edit meal\n2. Add calories\n3. Add protein/carbs/fat\n4. Save", 
     "https://nutrio.me/partner/menu", "Nutrition saved", "", "", "", "Medium", ""],
    
    ["TC247", "Partner", "Menu", "Duplicate Item", "Duplicate Menu Item", 
     "1. Find item\n2. Click Duplicate\n3. Modify\n4. Save as new", 
     "https://nutrio.me/partner/menu", "Item duplicated", "", "", "", "Low", ""],
    
    ["TC248", "Partner", "Menu", "Bulk Toggle", "Bulk Toggle Availability", 
     "1. Select multiple\n2. Click Toggle\n3. Verify all changed", 
     "https://nutrio.me/partner/menu", "All selected toggled", "", "", "", "Low", ""],
    
    ["TC249", "Partner", "Menu", "Image Crop", "Crop Uploaded Image", 
     "1. Upload photo\n2. Click crop\n3. Adjust\n4. Save", 
     "https://nutrio.me/partner/menu", "Image cropped", "", "", "", "Low", ""],
    
    ["TC250", "Partner", "Menu", "Preview Menu", "Preview Menu as Customer", 
     "1. Click Preview\n2. View as customer\n3. Check display\n4. Close", 
     "https://nutrio.me/partner/menu", "Preview displayed", "", "", "", "Medium", ""],
    
    ["TC251", "Partner", "Menu", "Export Menu", "Export Menu Data", 
     "1. Go to menu\n2. Click Export\n3. Select format\n4. Download", 
     "https://nutrio.me/partner/menu", "Menu exported", "", "", "", "Low", ""],
    
    ["TC252", "Partner", "Menu", "Import Menu", "Import Menu Items", 
     "1. Prepare file\n2. Click Import\n3. Upload\n4. Map fields\n5. Import", 
     "https://nutrio.me/partner/menu", "Items imported", "", "", "", "Low", ""],
    
    # ADDONS
    ["TC260", "Partner", "Addons", "View Add-ons", "View Meal Add-ons", 
     "1. Go to Add-ons\n2. View categories\n3. View items", 
     "https://nutrio.me/partner/addons", "Add-ons displayed", "", "", "", "Medium", ""],
    
    ["TC261", "Partner", "Addons", "Add Category", "Add Add-on Category", 
     "1. Click Add Category\n2. Enter name\n3. Save", 
     "https://nutrio.me/partner/addons", "Category created", "", "", "", "Medium", ""],
    
    ["TC262", "Partner", "Addons", "Add Add-on Item", "Add Add-on Item", 
     "1. Select category\n2. Click Add Item\n3. Fill details\n4. Set price\n5. Save", 
     "https://nutrio.me/partner/addons", "Add-on item added", "", "", "", "Medium", ""],
    
    ["TC263", "Partner", "Addons", "Edit Add-on", "Edit Add-on", 
     "1. Find add-on\n2. Click Edit\n3. Change\n4. Save", 
     "https://nutrio.me/partner/addons", "Add-on updated", "", "", "", "Medium", ""],
    
    ["TC264", "Partner", "Addons", "Delete Add-on", "Delete Add-on", 
     "1. Find add-on\n2. Click Delete\n3. Confirm", 
     "https://nutrio.me/partner/addons", "Add-on deleted", "", "", "", "Medium", ""],
    
    # EARNINGS
    ["TC270", "Partner", "Earnings", "View Earnings", "View Earnings Dashboard", 
     "1. Go to Earnings\n2. View summary\n3. Check today's\n4. Check weekly", 
     "https://nutrio.me/partner/earnings", "Earnings displayed", "", "", "", "Critical", ""],
    
    ["TC271", "Partner", "Earnings", "View Payout History", "View Payout History", 
     "1. Click History\n2. View past payouts\n3. Check dates", 
     "https://nutrio.me/partner/payouts", "Payout history displayed", "", "", "", "High", ""],
    
    ["TC272", "Partner", "Earnings", "Payout Details", "View Payout Details", 
     "1. Click payout\n2. View breakdown\n3. Check daily", 
     "https://nutrio.me/partner/payouts/[id]", "Details displayed", "", "", "", "Medium", ""],
    
    ["TC273", "Partner", "Earnings", "Earnings Charts", "View Earnings Charts", 
     "1. Go to earnings\n2. View charts\n3. Switch views\n4. Hover details", 
     "https://nutrio.me/partner/earnings", "Charts displayed", "", "", "", "Low", ""],
    
    ["TC274", "Partner", "Earnings", "Top Meals", "View Top Performing Meals", 
     "1. Scroll to Top Meals\n2. View best sellers\n3. Check quantities", 
     "https://nutrio.me/partner/earnings", "Top meals displayed", "", "", "", "Medium", ""],
    
    ["TC275", "Partner", "Earnings", "Download Invoice", "Download Payout Invoice", 
     "1. Go to payouts\n2. Click payout\n3. Download Invoice\n4. Verify PDF", 
     "https://nutrio.me/partner/payouts", "Invoice downloaded", "", "", "", "Medium", ""],
    
    ["TC276", "Partner", "Earnings", "Dispute Payout", "Dispute a Payout", 
     "1. Find payout\n2. Click Dispute\n3. Enter reason\n4. Submit", 
     "https://nutrio.me/partner/payouts", "Dispute submitted", "", "", "", "Medium", ""],
    
    ["TC277", "Partner", "Earnings", "Tax Report", "Generate Tax Report", 
     "1. Go to earnings\n2. Click Tax Report\n3. Select year\n4. Generate", 
     "https://nutrio.me/partner/payouts", "Tax report generated", "", "", "", "Low", ""],
    
    # PROFILE
    ["TC280", "Partner", "Profile", "View Profile", "View Restaurant Profile", 
     "1. Go to Profile\n2. View info\n3. Check hours\n4. Check capacity", 
     "https://nutrio.me/partner/profile", "Profile displayed", "", "", "", "High", ""],
    
    ["TC281", "Partner", "Profile", "Edit Profile", "Edit Restaurant Info", 
     "1. Click Edit\n2. Change description\n3. Change hours\n4. Save", 
     "https://nutrio.me/partner/profile/[id]/edit", "Profile updated", "", "", "", "Medium", ""],
    
    ["TC282", "Partner", "Profile", "Update Bank", "Update Bank Details", 
     "1. Go to profile\n2. Edit bank info\n3. Save", 
     "https://nutrio.me/partner/profile", "Bank details updated", "", "", "", "High", ""],
    
    ["TC283", "Partner", "Profile", "Set Capacity", "Set Daily Capacity", 
     "1. Go to profile\n2. Change capacity\n3. Save", 
     "https://nutrio.me/partner/profile", "Capacity updated", "", "", "", "High", ""],
    
    ["TC284", "Partner", "Profile", "Toggle Orders", "Toggle Accepting Orders", 
     "1. Go to profile\n2. Toggle accepting\n3. Save\n4. Verify", 
     "https://nutrio.me/partner/profile", "Status changed", "", "", "", "High", ""],
    
    ["TC285", "Partner", "Profile", "Update Logo", "Update Restaurant Logo", 
     "1. Go to profile\n2. Click Update Logo\n3. Upload\n4. Save", 
     "https://nutrio.me/partner/profile/[id]/edit", "Logo updated", "", "", "", "Low", ""],
    
    ["TC286", "Partner", "Profile", "Update Photos", "Update Restaurant Photos", 
     "1. Go to profile\n2. Add/Remove photos\n3. Save", 
     "https://nutrio.me/partner/profile/[id]/edit", "Photos updated", "", "", "", "Low", ""],
    
    ["TC287", "Partner", "Profile", "Change Password", "Change Password", 
     "1. Go to profile\n2. Click Change Password\n3. Enter current\n4. Enter new\n5. Save", 
     "https://nutrio.me/partner/profile", "Password changed", "", "", "", "High", ""],
    
    ["TC288", "Partner", "Profile", "Business Hours", "Set Special Hours", 
     "1. Go to hours\n2. Set regular\n3. Add special\n4. Save", 
     "https://nutrio.me/partner/profile", "Hours saved", "", "", "", "Medium", ""],
    
    ["TC289", "Partner", "Profile", "Delivery Zones", "Set Delivery Zones", 
     "1. Go to delivery\n2. View map\n3. Draw zone\n4. Set minimum\n5. Save", 
     "https://nutrio.me/partner/profile", "Zone saved", "", "", "", "Low", ""],
    
    ["TC290", "Partner", "Profile", "Team Members", "Add Team Member", 
     "1. Go to team\n2. Click Add\n3. Enter email\n4. Set role\n5. Send", 
     "https://nutrio.me/partner/profile/new", "Invitation sent", "", "", "", "Low", ""],
    
    ["TC291", "Partner", "Profile", "Remove Team Member", "Remove Team Member", 
     "1. Go to team\n2. Find member\n3. Click Remove\n4. Confirm", 
     "https://nutrio.me/partner/profile", "Member removed", "", "", "", "Low", ""],
    
    ["TC292", "Partner", "Profile", "Notification Preferences", "Set Notification Preferences", 
     "1. Go to profile\n2. Click Notifications\n3. Toggle options\n4. Save", 
     "https://nutrio.me/partner/profile", "Preferences saved", "", "", "", "Low", ""],
    
    # ANALYTICS
    ["TC300", "Partner", "Analytics", "View Analytics", "View Business Analytics", 
     "1. Go to Analytics\n2. View trends\n3. Check insights\n4. Check peak hours", 
     "https://nutrio.me/partner/analytics", "Analytics displayed", "", "", "", "Medium", ""],
    
    ["TC301", "Partner", "Analytics", "Customer Feedback", "View Customer Reviews", 
     "1. Go to Reviews\n2. View all\n3. Filter by rating\n4. Respond", 
     "https://nutrio.me/partner/reviews", "Reviews displayed", "", "", "", "Medium", ""],
    
    ["TC302", "Partner", "Analytics", "Performance Metrics", "View Performance Metrics", 
     "1. View fulfillment rate\n2. View prep time\n3. View on-time\n4. Compare", 
     "https://nutrio.me/partner/analytics", "Metrics displayed", "", "", "", "Medium", ""],
    
    ["TC303", "Partner", "Analytics", "AI Insights", "View AI Business Insights", 
     "1. Go to AI Insights\n2. View forecast\n3. Check popular times\n4. Review", 
     "https://nutrio.me/partner/ai-insights", "AI insights displayed", "", "", "", "Medium", ""],
    
    # BOOST
    ["TC310", "Partner", "Boost", "View Boost", "View Boost Options", 
     "1. Go to Boost\n2. View packages\n3. Check pricing", 
     "https://nutrio.me/partner/boost", "Boost options displayed", "", "", "", "Low", ""],
    
    ["TC311", "Partner", "Boost", "Purchase Boost", "Purchase Boost Package", 
     "1. Select package\n2. Complete payment\n3. Verify boosted", 
     "https://nutrio.me/partner/boost", "Restaurant boosted", "", "", "", "Low", ""],
    
    # NOTIFICATIONS
    ["TC320", "Partner", "Notifications", "View Notifications", "View Notifications", 
     "1. Go to Notifications\n2. View all\n3. Mark read", 
     "https://nutrio.me/partner/notifications", "Notifications displayed", "", "", "", "Medium", ""],
    
    # SUPPORT
    ["TC330", "Partner", "Support", "Contact Support", "Contact Support", 
     "1. Click Support\n2. Select issue\n3. Describe\n4. Submit", 
     "https://nutrio.me/partner/support", "Ticket created", "", "", "", "High", ""],
    
    ["TC331", "Partner", "Support", "View Knowledge Base", "View Knowledge Base", 
     "1. Click Help\n2. Browse articles\n3. Search\n4. View", 
     "https://nutrio.me/partner/support", "Knowledge base displayed", "", "", "", "Low", ""],
    
    ["TC332", "Partner", "Support", "Live Chat", "Start Live Chat", 
     "1. Click Chat\n2. Start conversation\n3. Send message\n4. Receive response", 
     "https://nutrio.me/partner/support", "Chat connected", "", "", "", "Medium", ""],
    
    # SETTINGS
    ["TC340", "Partner", "Settings", "View Settings", "View Partner Settings", 
     "1. Go to Settings\n2. View options\n3. Check configuration", 
     "https://nutrio.me/partner/settings", "Settings displayed", "", "", "", "High", ""],
    
    ["TC341", "Partner", "Settings", "Update Settings", "Update Settings", 
     "1. Modify settings\n2. Save changes\n3. Verify", 
     "https://nutrio.me/partner/settings", "Settings saved", "", "", "", "High", ""],
]

print(f"\nPrepared {len(admin_tests)} Admin tests")
print(f"Prepared {len(partner_tests)} Partner tests")

# Create DataFrames
admin_new_df = pd.DataFrame(admin_tests, columns=list(admin_df.columns))
partner_new_df = pd.DataFrame(partner_tests, columns=list(partner_df.columns))

# Combine
admin_combined = pd.concat([admin_df, admin_new_df], ignore_index=True)
partner_combined = pd.concat([partner_df, partner_new_df], ignore_index=True)

print(f"\nAdmin tests: {len(admin_df)} + {len(admin_new_df)} = {len(admin_combined)}")
print(f"Partner tests: {len(partner_df)} + {len(partner_new_df)} = {len(partner_combined)}")

# Write back
with pd.ExcelWriter(file_path, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
    customer_df.to_excel(writer, sheet_name='Customer Tests', index=False)
    admin_combined.to_excel(writer, sheet_name='Admin Tests', index=False)
    partner_combined.to_excel(writer, sheet_name='Partner Tests', index=False)
    driver_df.to_excel(writer, sheet_name='Driver Tests', index=False)
    system_df.to_excel(writer, sheet_name='System Tests', index=False)

print("\n" + "=" * 80)
print("ADMIN AND PARTNER TESTS ADDED!")
print("=" * 80)
print(f"Total tests now: {len(customer_df) + len(admin_combined) + len(partner_combined) + len(driver_df) + len(system_df)}")
