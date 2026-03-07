import re

# Read the file
with open('src/contexts/LanguageContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to match lines with duplicate keys in English section (lines 620-714 range)
# We'll remove duplicate keys from "Profile page extensions" section

# Remove duplicate keys in English section (lines 620-714)
english_pattern = r'(// Profile page extensions\s*loading_profile: "Loading profile\.\.\.",\s*free_plan: "Free Plan",\s*joined: "Joined",\s*personal_info_desc: "Name, gender, age and email address",\s*full_name_label: "Full Name",\s*(?:.*?\n{0,2})+?)*?(// Profile / Settings\n\s*profile: "Profile",)'

# Simpler approach: find and remove the entire "Profile page extensions" block
# which contains duplicates

lines = content.split('\n')
result_lines = []
skip_until = -1
in_profile_extensions = False

for i, line in enumerate(lines):
    # Check if we're starting the profile page extensions section
    if 'Profile page extensions' in line and i > 600:
        in_profile_extensions = True
        skip_until = i
        continue
    
    # If we're in the extensions section, check if we should skip
    if in_profile_extensions:
        # Check if this line has a duplicate key from earlier in the file
        duplicate_keys = ['loading_profile', 'free_plan', 'joined', 'personal_info_desc', 'full_name_label', 'package_label', 'top_up_amount', 'bonus_credit', 'total_credit', 'redirected_to_sadad', 'confirm_top_up', 'review_top_up_details']
        
        # Check if this line contains a duplicate key
        is_duplicate = False
        for key in duplicate_keys:
            if key + ':' in line and not 'manage_addresses_action' in line and not 'delivery_addresses' in line and not 'dietary_and_allergies' in line and not 'manage_dietary_preferences' in line and not 'dietary_preferences' in line and not 'no_dietary_tags_available' in line and not 'allergies_and_intolerances' in line and not 'terms_and_conditions' in line and not 'privacy_policy_label' in line and not 'get_help_report_issues' in line and not 'chat_on_whatsapp' in line and not 'email_support' in line and not 'call_us' in line and not 'submit_a_ticket' in line and not 'view_faq' in line and not 'support_hours' in line and not 'my_wallet' in line and not 'top_up_manage_balance' in line and not 'payment_successful' in line and not 'payment_failed' in line and not 'simulation_mode' in line and not 'daily_streaks' in line and not 'order_daily_earn_bonuses' in line and not 'wallet_bonuses' in line and not 'get_bonus_credits' in line and not 'affiliate_program' in line and not 'earn_more' in line and not 'become_affiliate' in line and not 'change_password' in line and not 'update_account_password' in line and not 'new_password_label' in line and not 'updating' in line and not 'update_password_btn' in line and not 'phone_number' in line and not 'affiliateApproved' in line and not 'affiliatePending' in line and not 'affiliateNotApproved' in line and not 'affiliateRejectionReason' in line and not 'affiliateJoinProgram' in line and not 'affiliateJoinDescription' in line and not 'affiliateEarnCommissions' in line and not 'affiliate3TierRewards' in line and not 'affiliateMonthlyPayouts' in line and not 'affiliateNotePlaceholder' in line and not 'submitApplication' in line and not 'applyNow' in line and not 'affiliateApplicationSubmitted' in line and not 'affiliateApplicationSubmittedDescription' in line and not 'affiliateApplicationFailed' in line and not 'faq' in line:
                is_duplicate = True
                break
        
        if is_duplicate:
            continue
        
        # Check if we've reached the next comment section (not a duplicate)
        if line.strip().startswith('//') and not 'Profile page extensions' in line:
            in_profile_extensions = False
    
    result_lines.append(line)

# Write the result
with open('src/contexts/LanguageContext.tsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(result_lines))

print("Fixed duplicate keys")
