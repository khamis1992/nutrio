# Arabic Translation Project - Phase 1 Requirements

## Requirements Summary

| Total | Active | Completed | Blocked | Out of Scope |
|-------|--------|-----------|---------|--------------|
| 5 | 5 | 0 | 0 | 0 |

---

## Translation Key Analysis

The LanguageContext.tsx file already contains most required English/Arabic translation keys. An analysis found that the following Profile page-specific keys need verification or addition for TRANS-01:

**Existing keys that cover Profile page:**
- `loading_profile`, `free_plan`, `joined`, `personal_info_desc`, `full_name_label`, `years_label`, `age_label`, `age_default_placeholder`, `email_address`, `manage_addresses_action`, `delivery_addresses`, `dietary_and_allergies`, `manage_dietary_preferences`, `dietary_preferences`, `no_dietary_tags_available`, `allergies_and_intolerances`, `terms_and_conditions`, `privacy_policy_label`, `get_help_report_issues`, `chat_on_whatsapp`, `email_support`, `call_us`, `submit_a_ticket`, `view_faq`, `support_hours`, `my_wallet`, `top_up_manage_balance`, `payment_successful`, `payment_failed`, `simulation_mode`, `confirm_top_up`, `review_top_up_details`, `package_label`, `top_up_amount`, `bonus_credit`, `total_credit`, `bonus`, `credit`, `debit`, `refund`, `cashback`, `redirected_to_sadad`, `daily_streaks`, `order_daily_earn_bonuses`, `wallet_bonuses`, `get_bonus_credits`, `affiliate_program`, `earn_more`, `referrals`, `become_affiliate`, `change_password`, `update_account_password`, `new_password_label`, `updating`, `update_password_btn`, `phone_number`, `affiliateApproved`, `affiliateApprovedDescription`, `affiliatePending`, `affiliatePendingDescription`, `affiliateNotApproved`, `affiliateNotApprovedDescription`, `affiliateRejectionReason`, `affiliateJoinProgram`, `affiliateJoinDescription`, `affiliateEarnCommissions`, `affiliate3TierRewards`, `affiliateMonthlyPayouts`, `affiliateNotePlaceholder`, `submitApplication`, `applyNow`, `affiliateApplicationSubmitted`, `affiliateApplicationSubmittedDescription`, `affiliateApplicationFailed`, `notification_settings`, `order_updates`, `status_changes_orders`, `discounts_special_deals`, `choose_notifications`, `control_data_usage`, `manage_account_status`, `delete_account_warning`, `delete_account`, `account_actions`, `enter_full_name`, `enter_new_password`, `confirm_new_password`

**Keys identified for TRANS-01 verification:**
- `password_updated`, `passwords_dont_match`, `password_min_length`, `profile_updated`, `personal_info_saved`, `error_saving_profile`, `removed`, `added`, `failed_update_dietary_preference`, `passwords_match_warning`, `password_changed_success`, `error_updating_password`, `contact_support`, `successful`, `please_try_again`, `password_too_short`, `password_must_be_at_least_6_characters`, `password_updated_description`, `updated_successfully`, `added_successfully`, `removed_successfully`, `failed_load_dietary_preferences`, `contact_support_delete_account`

---

## Active Requirements

### TRANS-01: Add Missing Translation Keys

**Category:** Translation Keys

**Description:** Add missing translation keys for Profile page error/success messages (e.g., "Error", "Removed", "Added", "Profile updated", etc.)

**Status:** Pending

**Target Phase:** Phase 1

**Details:** The Profile page requires specific error and success message keys that may not be present in the existing translation context. These messages include toast notifications for profile updates, password changes, dietary preference toggles, and other user actions.

---

### TRANS-02: Replace Hardcoded English Strings

**Category:** Translation Keys

**Description:** Replace hardcoded English strings in Profile page component with translation key references

**Status:** Pending

**Target Phase:** Phase 2

**Details:** The Profile.tsx component contains numerous hardcoded English strings that need to be replaced with translation key references using the `t()` function from LanguageContext. This includes form labels, button text, section headers, notifications, and all other user-facing text.

---

### TRANS-03: Verify RTL Rendering

**Category:** Localization

**Description:** Verify Arabic text renders correctly for RTL (Right-to-Left) language support

**Status:** Pending

**Target Phase:** Phase 3

**Details:** Arabic is a right-to-left language that requires proper layout direction. This requirement ensures that when Arabic is selected, the Profile page displays with RTL layout including correct text alignment, icon positioning, and form element ordering.

---

### TRANS-04: Language Switching Validation

**Category:** Testing

**Description:** Test language switching works without breaking existing functionality

**Status:** Pending

**Target Phase:** Phase 4

**Details:** Users should be able to switch between English and Arabic dynamically without page reloads or loss of functionality. This includes verifying all interactive elements (forms, buttons, accordions) work correctly in both languages.

---

### TRANS-05: Cross-Language Coverage

**Category:** Testing

**Description:** Profile page displays correctly in both English and Arabic

**Status:** Pending

**Target Phase:** Phase 5

**Details:** All Profile page sections must be fully localized with proper text in both English and Arabic. This is the final verification that ensures complete language coverage before declaring Phase 1 complete.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRANS-01 | Phase 1 | Pending |
| TRANS-02 | Phase 2 | Pending |
| TRANS-03 | Phase 3 | Pending |
| TRANS-04 | Phase 4 | Pending |
| TRANS-05 | Phase 5 | Pending |

---

*Requirements file created for Nutrio Fuel Arabic Translation Project - Phase 1*
