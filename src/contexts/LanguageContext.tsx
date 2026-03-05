import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "en" | "ar";

// ─── Translation Dictionary ───────────────────────────────────────────────────
export const translations = {
  en: {
    // Navigation
    nav_home: "Home",
    nav_restaurants: "Restaurants",
    nav_schedule: "Schedule",
    nav_affiliate: "Affiliate",
    nav_profile: "Profile",
    // BMI labels
    normal: "Normal",
    overweight: "Overweight",
    obese: "Obese",
    underweight: "Underweight",
    // Tracker
    starting: "Starting",
    // Profile
    save_changes: "Save Changes",
    profile_settings: "Profile & Settings",
    when_restaurants_add_items: "When restaurants add new items",
    tailor_meals_offers: "Tailor meals and offers to your habits",
    help_improve_app: "Help us improve the app with anonymous data",
    notification_settings: "Notification Settings",
    // Profile page
    order_updates: "Order Updates",
    status_changes_orders: "Status changes for your active orders",
    discounts_special_deals: "Discounts and special deals",
    choose_notifications: "Choose what you want to be notified about",
    control_data_usage: "Control how your data is used",
    manage_account_status: "Manage your account status",
    manage_addresses: "Manage your saved delivery locations",
    delete_account_warning: "This action cannot be undone. All your data including meal schedules, progress logs, and preferences will be permanently deleted.",
    // Dashboard
    on_fire_message: "You're on fire! Keep logging your meals.",
    days_to_milestone: "days to next milestone",
    days_this_week: "days this week",
    weekly_goal: "Weekly Goal",
    no_featured_restaurants: "No featured restaurants yet",
    check_back_restaurants: "Check back soon for our highlighted partner restaurants!",
    // Auth & Progress
    on_track_nutrition: "On track with your nutrition plan",
    eat_smart: "Eat Smart,",
    live_better: "Live Better",



    // Common
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    edit: "Edit",
    delete: "Delete",
    confirm: "Confirm",
    loading: "Loading...",
    saving: "Saving…",
    search: "Search",
    filter: "Filter",
    all: "All",
    yes: "Yes",
    no: "No",
    back: "Back",
    next: "Next",
    done: "Done",
    submit: "Submit",
    update: "Update",
    add: "Add",
    remove: "Remove",
    view: "View",
    share: "Share",
    download: "Download",
    upload: "Upload",
    select: "Select",
    change: "Change",
    apply: "Apply",
    reset: "Reset",
    clear: "Clear",
    ok: "OK",
    error: "Error",
    success: "Success",
    warning: "Warning",
    info: "Info",
    retry: "Retry",
    reload: "Reload",

    // Dashboard
    good_morning: "Good morning ☀️",
    good_afternoon: "Good afternoon 🌤️",
    good_evening: "Good evening 🌙",
    todays_progress: "Today's Progress",
    calories: "Calories",
    protein: "Protein",
    carbs: "Carbs",
    fat: "Fat",
    water: "Water",
    steps: "Steps",
    weight: "Weight",
    goal: "Goal",
    streak: "Streak",
    days: "days",
    day: "day",
    week: "Week",
    month: "Month",
    year: "Year",
    today: "Today",
    yesterday: "Yesterday",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    view_all: "View All",
    see_all: "See All",
    no_data: "No data available",
    sign_out: "Sign Out",
    signed_out: "Signed out",
    signed_out_desc: "You have been successfully signed out.",

    // Meals / Restaurants
    restaurants: "Restaurants",
    meals: "Meals",
    meal: "Meal",
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
    search_food: "Search food...",
    search_restaurants: "Search restaurants...",
    all_restaurants: "All Restaurants",
    your_favorites: "Your Favorites",
    favorite_meals: "Favorite Meals",
    no_restaurants_found: "No restaurants found",
    no_meals_found: "No meals found",
    no_favorites_yet: "No favorites yet",
    no_favorite_meals_yet: "No favorite meals yet",
    available_now: "Available now",
    currently_unavailable: "Currently unavailable",
    delicious_healthy_meals: "Delicious healthy meals",
    healthy_and_delicious: "Healthy & delicious meals",
    fastest: "Fastest",
    popular: "Popular",
    top_rated: "Top Rated",
    favorites: "Favorites",
    filters: "Filters",
    under_300: "Under 300",
    add_to_cart: "Add to Cart",
    order_now: "Order Now",
    calories_kcal: "Calories (kcal)",
    kcal: "kcal",
    g: "g",
    ml: "mL",
    cups: "cups",
    kg: "kg",
    cm: "cm",

    // Schedule
    schedule: "Schedule",
    set_delivery_time: "Set delivery time",
    delivery_time_set: "Delivery Time Set",

    // Progress / Tracker
    progress: "Progress",
    tracker: "Tracker",
    insights: "Insights",
    bmi: "BMI",
    edit_bmi: "Edit BMI",
    height: "Height",
    add_steps: "Add steps",
    step_goal: "Step Goal",
    water_intake: "Water Intake",
    weight_goal: "Weight Goal",
    calorie_goal: "Calorie Goal",
    protein_goal: "Protein Goal",
    log_meal: "Log Meal",
    log_activity: "Log Activity",
    weekly_report: "Weekly Report",
    download_report: "Download Report",
    generating_report: "Generating report...",
    report_downloaded: "Report downloaded!",
    report_failed: "Failed to generate report",
    scan_food: "Scan Food",
    take_photo: "Take Photo",
    upload_from_gallery: "Upload from Gallery",
    scan_your_food: "Scan Your Food",
    scan_desc: "Take a photo or upload from your gallery to identify the food and log it instantly.",
    recent: "Recent",
    manual_log: "Manual Log",
    select_items_to_add: "Select items to add",
    use_camera_to_capture: "Use your camera to capture food",
    pick_existing_photo: "Pick an existing photo",

    // Profile / Settings
    profile: "Profile",
    settings: "Settings",
    profile_and_settings: "Profile & Settings",
    personal_info: "Personal Info",
    account_actions: "Account Actions",
    manage_account: "Manage your account status",
    delete_account: "Delete Account",
    language: "Language",
    select_language: "Select your preferred language",
    english: "English",
    arabic: "العربية",
    notifications: "Notifications",
    privacy_settings: "Privacy Settings",
    control_data: "Control how your data is used",
    usage_analytics: "Usage Analytics",
    usage_analytics_desc: "Help us improve the app with anonymous data",
    personalised_recommendations: "Personalised Recommendations",
    personalised_desc: "Tailor meals and offers to your habits",
    new_meals_available: "New Meals Available",
    new_meals_desc: "When restaurants add new items",
    promotions_offers: "Promotions & Offers",
    promotions_desc: "Discounts and special deals",
    profile_updated: "Profile updated",
    personal_info_saved: "Your personal information has been saved.",
    password_updated: "Password updated",
    passwords_dont_match: "Passwords don't match",
    password_min_length: "Password must be at least 6 characters.",
    contact_support: "Contact support",
    view_affiliate_dashboard: "View Affiliate Dashboard",
    apply_affiliate: "Apply for Affiliate Program",

    // Auth
    sign_in: "Sign In",
    sign_up: "Sign Up",
    create_free_account: "Create Free Account",
    email: "Email",
    password: "Password",
    forgot_password: "Forgot Password?",
    reset_password: "Reset Password",
    dont_have_account: "Don't have an account?",
    already_have_account: "Already have an account?",

    // Goals
    weight_loss: "Weight Loss",
    muscle_gain: "Muscle Gain",
    maintenance: "Maintenance",
    general_health: "General Health",
    not_enough_data: "Not enough data yet",
    no_active_goal: "No active goal",
    set_nutrition_goal: "Set a nutrition goal first so we can analyze your progress.",
    goal_optimization: "Goal optimization based on your data",

    // Wallet / Orders
    wallet: "Wallet",
    order_history: "Order History",
    invoice_history: "Invoice History",
    checkout: "Checkout",
    total: "Total",
    subtotal: "Subtotal",
    delivery_fee: "Delivery Fee",
    discount: "Discount",
    payment: "Payment",
    place_order: "Place Order",

    // Addresses
    addresses: "Addresses",
    add_address: "Add Address",
    delivery_address: "Delivery Address",

    // Subscription
    subscription: "Subscription",
    subscribe: "Subscribe",
    current_plan: "Current Plan",
    upgrade: "Upgrade",

    // Support / About
    support: "Support",
    about: "About",
    faq: "FAQ",
    contact: "Contact",
    privacy_policy: "Privacy Policy",
    terms: "Terms & Conditions",
    policies: "Policies",

    // Notifications
    notification: "Notification",
    mark_all_read: "Mark all as read",
    no_notifications: "No notifications",

    // Water tracker
    add_water: "Add Water",
    water_goal: "Water Goal",
    glasses: "glasses",
    liters: "liters",

    // Weight tracking
    log_weight: "Log Weight",
    update_weight: "Update Weight",
    weight_updated: "Weight updated",
    weight_logged: "kg logged.",
    failed_to_update: "Failed to update",
    water_added: "Water added",

    // Step counter
    step_counter: "Step Counter",
    steps_today: "Steps Today",
    distance: "Distance",
    active_time: "Active Time",

    // Onboarding
    get_started: "Get Started",
    skip: "Skip",
    continue: "Continue",
    welcome: "Welcome",
    welcome_to_nutrio: "Welcome to Nutrio",
    fuel_your_body: "FUEL Your Body Smart",

    // Errors
    something_went_wrong: "Something went wrong",
    we_apologize: "We apologize for the inconvenience. The error has been reported and we'll fix it soon.",
    reload_page: "Reload Page",
    not_found: "Page Not Found",
    go_home: "Go Home",

    // Time zones
    timezone_qatar: "Qatar (GMT +3)",

    // Gender
    he_him: "He/Him",
    she_her: "She/Her",

    // Expected impact
    expected_impact: "Expected impact",
    hide_impact: "Hide impact",

    // Show results
    show_results: "Show",
    restaurants_label: "Restaurants",
    meals_label: "Meals",

    // Report
    overall_score: "OVERALL SCORE",
    weekly_performance: "WEEKLY PERFORMANCE",
    habit_intelligence: "& HABIT INTELLIGENCE",
    weekly_report_title: "Weekly Report",
    prepared_for: "PREPARED FOR",
    generated: "Generated",

    // Auth page
    personalized_plans: "Personalized Plans",
    calorie_macro_tracking: "Calorie & Macro Tracking",
    restaurant_integration: "Restaurant Integration",
    progress_insights: "Progress & Insights",
    welcome_feature_desc: "Get meal plans tailored to your goals, dietary preferences, and lifestyle.",
    create_account: "Create Account",
    full_name: "Full Name",
    confirm_password: "Confirm Password",
    verify_email: "Verify Your Email",
    otp_sent_to: "We sent a 6-digit code to",
    enter_otp: "Enter the 6-digit code",
    verify_code: "Verify Code",
    resend_code: "Resend Code",
    back_to_signup: "Back to Sign Up",
    send_reset_link: "Send Reset Link",
    back_to_signin: "Back to Sign In",
    sign_in_required: "Sign in required",
    sign_in_required_desc: "Please sign in or create an account to continue.",
    complete: "Complete",
    male: "Male",
    female: "Female",

    // Onboarding
    lose_weight: "Lose Weight",
    lose_weight_desc: "Reduce body fat while maintaining muscle",
    build_muscle: "Build Muscle",
    build_muscle_desc: "Gain lean muscle mass with proper nutrition",
    maintain: "Maintain",
    maintain_desc: "Keep your current weight and improve health",
    maintenance_goal: "Maintenance",
    sedentary: "Sedentary",
    sedentary_desc: "Little or no exercise",
    lightly_active: "Lightly Active",
    lightly_active_desc: "Light exercise 1-3 days/week",
    moderately_active: "Moderately Active",
    moderately_active_desc: "Moderate exercise 3-5 days/week",
    very_active: "Very Active",
    very_active_desc: "Hard exercise 6-7 days/week",
    extra_active: "Extra Active",
    extra_active_desc: "Very hard exercise & physical job",

    // Main Menu
    food_and_meals: "Food & Meals",
    plan_weekly_meals: "Plan your weekly meals",
    browse_all_restaurants: "Browse all restaurants",
    progress_and_goals: "Progress & Goals",
    track_weight_nutrition: "Track weight, nutrition & health metrics",
    updated: "Updated",
    orders_and_subscription: "Orders & Subscription",
    view_past_orders: "View past orders",
    manage_your_plan: "Manage your plan",
    upgrade_your_plan: "Upgrade your plan",
    live_tracking: "Live Tracking",
    track_your_orders: "Track your orders",
    settings_and_account: "Settings & Account",
    personal_info_preferences: "Personal info & preferences",
    app_preferences: "App preferences",
    delivery_locations: "Delivery locations",
    earn_rewards: "Earn Rewards",
    earn_with_audience: "Earn with your audience",
    affiliate: "Affiliate",
    menu: "Menu",
    saved_restaurants: "saved restaurants",

    // MealWizard
    snacks_salad: "Snacks & Salad",
    breakfast_desc: "Start your day with energy",
    lunch_desc: "Fuel your afternoon",
    dinner_desc: "End your day right",
    snacks_desc: "Healthy extras",
    back_to_restaurants: "Back to Restaurants",
    partner_restaurant: "Partner Restaurant",

    // Progress page
    great: "Great",
    good: "Good",
    keep_going: "Keep Going",
    first_week_complete: "First Week Complete",
    logged_meals_7_days: "Logged meals for 7 days",
    protein_pro: "Protein Pro",
    hit_protein_goal_5_days: "Hit protein goal 5 days",
    hydration_hero: "Hydration Hero",
    drank_8_glasses: "Drank 8 glasses for a week",
    analyzing_21_days: "Analyzing your last 21 days…",
    log_meals_4_days: "Log meals for at least 4 days to unlock personalized suggestions.",
    set_nutrition_goal_first: "Set a nutrition goal first so we can analyze your progress.",
    high_confidence_changes: "high-confidence changes",
    high_confidence: "High confidence",
    suggestion: "Suggestion",
    exploratory: "Exploratory",
    safety_tip: "Safety tip",

    // TrackerInsights
    smart_adjustments: "Smart Adjustments",
    suggestions_based_on: "suggestions based on",

    // LogMealDialog
    log_food: "Log Food",
    search_food_items: "Search food items...",
    quick_log: "Quick Log",
    my_meals: "My Meals",
    food_name: "Food Name",
    amount: "Amount",
    unit: "Unit",
    add_food: "Add Food",
    nutrition_info: "Nutrition Info",
    per_serving: "Per serving",
    add_to_log: "Add to Log",
    serving_size: "Serving Size",

    // Schedule page
    meal_schedule: "Meal Schedule",
    plan_your_meals: "Plan your meals for the week",
    add_meal: "Add Meal",
    no_meals_scheduled: "No meals scheduled",
    delivery_timezone: "Delivery Timezone",

    // Profile page
    he_him_pronoun: "He/Him",
    she_her_pronoun: "She/Her",
    your_name: "Your Name",
    enter_email: "Enter your email",
    nutrition_goals: "Nutrition Goals",
    daily_calories: "Daily Calories",
    daily_protein: "Daily Protein",
    daily_carbs: "Daily Carbs",
    daily_fat: "Daily Fat",
  },

  // ──────────────────────────────────────────────────────────────────────────────

  ar: {
    // Navigation
    nav_home: "الرئيسية",
    nav_restaurants: "المطاعم",
    nav_schedule: "الجدول",
    nav_affiliate: "الشراكة",
    nav_profile: "الملف الشخصي",
    // BMI labels
    normal: "طبيعي",
    overweight: "زيادة وزن",
    obese: "سمنة",
    underweight: "نقص وزن",
    // Tracker
    starting: "البداية",
    // Profile
    save_changes: "حفظ التغييرات",
    profile_settings: "الملف الشخصي والإعدادات",
    when_restaurants_add_items: "عند إضافة المطاعم لعناصر جديدة",
    tailor_meals_offers: "تخصيص الوجبات والعروض حسب عاداتك",
    help_improve_app: "ساعدنا في تحسين التطبيق ببيانات مجهولة",
    notification_settings: "إعدادات الإشعارات",
    // Profile page
    order_updates: "تحديثات الطلبات",
    status_changes_orders: "تغييرات حالة طلباتك النشطة",
    discounts_special_deals: "خصومات وصفقات خاصة",
    choose_notifications: "اختر ما تريد الإشعار به",
    control_data_usage: "تحكم في كيفية استخدام بياناتك",
    manage_account_status: "إدارة حالة حسابك",
    manage_addresses: "إدارة عناوين التوصيل المحفوظة",
    delete_account_warning: "لا يمكن التراجع عن هذا الإجراء. سيتم حذف جميع بياناتك بما في ذلك جداول الوجبات وسجلات التقدم والتفضيلات بشكل دائم.",
    // Dashboard
    on_fire_message: "أنت رائع! استمر في تسجيل وجباتك.",
    days_to_milestone: "أيام حتى الهدف التالي",
    days_this_week: "أيام هذا الأسبوع",
    weekly_goal: "الهدف الأسبوعي",
    no_featured_restaurants: "لا توجد مطاعم مميزة حتى الآن",
    check_back_restaurants: "تحقق لاحقاً لمطاعمنا الشريكة المميزة!",
    // Auth & Progress
    on_track_nutrition: "على المسار الصحيح مع خطة تغذيتك",
    eat_smart: "تناول بذكاء،",
    live_better: "عش بشكل أفضل",



    // Common
    save: "حفظ",
    cancel: "إلغاء",
    close: "إغلاق",
    edit: "تعديل",
    delete: "حذف",
    confirm: "تأكيد",
    loading: "جاري التحميل...",
    saving: "جاري الحفظ…",
    search: "بحث",
    filter: "تصفية",
    all: "الكل",
    yes: "نعم",
    no: "لا",
    back: "رجوع",
    next: "التالي",
    submit: "إرسال",
    update: "تحديث",
    add: "إضافة",
    remove: "إزالة",
    view: "عرض",
    share: "مشاركة",
    download: "تنزيل",
    upload: "رفع",
    select: "اختيار",
    change: "تغيير",
    apply: "تطبيق",
    reset: "إعادة تعيين",
    clear: "مسح",
    ok: "موافق",
    error: "خطأ",
    success: "نجاح",
    warning: "تحذير",
    info: "معلومة",
    retry: "إعادة المحاولة",
    reload: "إعادة تحميل",

    // Dashboard
    good_morning: "صباح الخير ☀️",
    good_afternoon: "مساء الخير 🌤️",
    good_evening: "مساء النور 🌙",
    todays_progress: "تقدم اليوم",
    calories: "السعرات الحرارية",
    protein: "البروتين",
    carbs: "الكربوهيدرات",
    fat: "الدهون",
    water: "الماء",
    steps: "الخطوات",
    weight: "الوزن",
    goal: "الهدف",
    streak: "الاستمرارية",
    days: "أيام",
    day: "يوم",
    week: "أسبوع",
    month: "شهر",
    year: "سنة",
    today: "اليوم",
    yesterday: "أمس",
    weekly: "أسبوعي",
    monthly: "شهري",
    yearly: "سنوي",
    view_all: "عرض الكل",
    see_all: "مشاهدة الكل",
    no_data: "لا توجد بيانات",
    sign_out: "تسجيل الخروج",
    signed_out: "تم تسجيل الخروج",
    signed_out_desc: "تم تسجيل خروجك بنجاح.",

    // Meals / Restaurants
    restaurants: "المطاعم",
    meals: "الوجبات",
    meal: "وجبة",
    breakfast: "الإفطار",
    lunch: "الغداء",
    dinner: "العشاء",
    snack: "وجبة خفيفة",
    search_food: "ابحث عن طعام...",
    search_restaurants: "ابحث عن مطاعم...",
    all_restaurants: "جميع المطاعم",
    your_favorites: "المفضلة لديك",
    favorite_meals: "الوجبات المفضلة",
    no_restaurants_found: "لم يتم العثور على مطاعم",
    no_meals_found: "لم يتم العثور على وجبات",
    no_favorites_yet: "لا توجد مفضلات بعد",
    no_favorite_meals_yet: "لا توجد وجبات مفضلة بعد",
    available_now: "متاح الآن",
    currently_unavailable: "غير متاح حالياً",
    delicious_healthy_meals: "وجبات صحية ولذيذة",
    healthy_and_delicious: "وجبات صحية ولذيذة",
    fastest: "الأسرع",
    popular: "الأكثر شعبية",
    top_rated: "الأعلى تقييماً",
    favorites: "المفضلة",
    filters: "الفلاتر",
    under_300: "أقل من 300",
    add_to_cart: "أضف إلى السلة",
    order_now: "اطلب الآن",
    calories_kcal: "السعرات الحرارية (kcal)",
    kcal: "سعرة",
    g: "غ",
    ml: "مل",
    cups: "أكواب",
    kg: "كغ",
    cm: "سم",

    // Schedule
    schedule: "الجدول",
    set_delivery_time: "تحديد وقت التوصيل",
    delivery_time_set: "تم تحديد وقت التوصيل",

    // Progress / Tracker
    progress: "التقدم",
    tracker: "المتتبع",
    insights: "التحليلات",
    bmi: "مؤشر كتلة الجسم",
    edit_bmi: "تعديل مؤشر كتلة الجسم",
    height: "الطول",
    add_steps: "إضافة خطوات",
    step_goal: "هدف الخطوات",
    water_intake: "استهلاك الماء",
    weight_goal: "هدف الوزن",
    calorie_goal: "هدف السعرات",
    protein_goal: "هدف البروتين",
    log_meal: "تسجيل وجبة",
    log_activity: "تسجيل نشاط",
    weekly_report: "التقرير الأسبوعي",
    download_report: "تنزيل التقرير",
    generating_report: "جاري إنشاء التقرير...",
    report_downloaded: "تم تنزيل التقرير!",
    report_failed: "فشل إنشاء التقرير",
    scan_food: "مسح الطعام",
    take_photo: "التقاط صورة",
    upload_from_gallery: "رفع من المعرض",
    scan_your_food: "امسح طعامك",
    scan_desc: "التقط صورة أو ارفع من معرضك لتحديد الطعام وتسجيله فوراً.",
    recent: "الأخيرة",
    manual_log: "تسجيل يدوي",
    select_items_to_add: "اختر العناصر للإضافة",
    use_camera_to_capture: "استخدم الكاميرا لالتقاط الطعام",
    pick_existing_photo: "اختر صورة موجودة",

    // Profile / Settings
    profile: "الملف الشخصي",
    settings: "الإعدادات",
    profile_and_settings: "الملف الشخصي والإعدادات",
    personal_info: "المعلومات الشخصية",
    account_actions: "إجراءات الحساب",
    manage_account: "إدارة حالة حسابك",
    delete_account: "حذف الحساب",
    language: "اللغة",
    select_language: "اختر لغتك المفضلة",
    english: "English",
    arabic: "العربية",
    notifications: "الإشعارات",
    privacy_settings: "إعدادات الخصوصية",
    control_data: "تحكم في كيفية استخدام بياناتك",
    usage_analytics: "تحليلات الاستخدام",
    usage_analytics_desc: "ساعدنا في تحسين التطبيق ببيانات مجهولة",
    personalised_recommendations: "توصيات مخصصة",
    personalised_desc: "تخصيص الوجبات والعروض وفق عاداتك",
    new_meals_available: "وجبات جديدة متاحة",
    new_meals_desc: "عندما تضيف المطاعم عناصر جديدة",
    promotions_offers: "العروض والخصومات",
    promotions_desc: "الخصومات والصفقات الخاصة",
    profile_updated: "تم تحديث الملف الشخصي",
    personal_info_saved: "تم حفظ معلوماتك الشخصية.",
    password_updated: "تم تحديث كلمة المرور",
    passwords_dont_match: "كلمات المرور غير متطابقة",
    password_min_length: "يجب أن تكون كلمة المرور 6 أحرف على الأقل.",
    contact_support: "التواصل مع الدعم",
    view_affiliate_dashboard: "عرض لوحة الشراكة",
    apply_affiliate: "التقدم لبرنامج الشراكة",

    // Auth
    sign_in: "تسجيل الدخول",
    sign_up: "إنشاء حساب",
    create_free_account: "إنشاء حساب مجاني",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    forgot_password: "نسيت كلمة المرور؟",
    reset_password: "إعادة تعيين كلمة المرور",
    dont_have_account: "ليس لديك حساب؟",
    already_have_account: "لديك حساب بالفعل؟",

    // Goals
    weight_loss: "خسارة الوزن",
    muscle_gain: "بناء العضلات",
    maintenance: "الحفاظ على الوزن",
    general_health: "الصحة العامة",
    not_enough_data: "لا توجد بيانات كافية بعد",
    no_active_goal: "لا يوجد هدف نشط",
    set_nutrition_goal: "حدد هدفاً غذائياً أولاً حتى نتمكن من تحليل تقدمك.",
    goal_optimization: "تحسين الهدف بناءً على بياناتك",

    // Wallet / Orders
    wallet: "المحفظة",
    order_history: "سجل الطلبات",
    invoice_history: "سجل الفواتير",
    checkout: "الدفع",
    total: "الإجمالي",
    subtotal: "المجموع الفرعي",
    delivery_fee: "رسوم التوصيل",
    discount: "الخصم",
    payment: "الدفع",
    place_order: "تأكيد الطلب",

    // Addresses
    addresses: "العناوين",
    add_address: "إضافة عنوان",
    delivery_address: "عنوان التوصيل",

    // Subscription
    subscription: "الاشتراك",
    subscribe: "اشترك",
    current_plan: "الخطة الحالية",
    upgrade: "ترقية",

    // Support / About
    support: "الدعم",
    about: "حول",
    faq: "الأسئلة الشائعة",
    contact: "تواصل معنا",
    privacy_policy: "سياسة الخصوصية",
    terms: "الشروط والأحكام",
    policies: "السياسات",

    // Notifications
    notification: "إشعار",
    mark_all_read: "تحديد الكل كمقروء",
    no_notifications: "لا توجد إشعارات",

    // Water tracker
    add_water: "إضافة ماء",
    water_goal: "هدف الماء",
    glasses: "أكواب",
    liters: "لتر",

    // Weight tracking
    log_weight: "تسجيل الوزن",
    update_weight: "تحديث الوزن",
    weight_updated: "تم تحديث الوزن",
    weight_logged: "كغ تم تسجيله.",
    failed_to_update: "فشل التحديث",
    water_added: "تمت إضافة الماء",

    // Step counter
    step_counter: "عداد الخطوات",
    steps_today: "خطوات اليوم",
    distance: "المسافة",
    active_time: "وقت النشاط",

    // Onboarding
    get_started: "ابدأ الآن",
    skip: "تخطي",
    continue: "متابعة",
    done: "تم",
    welcome: "مرحباً",
    welcome_to_nutrio: "مرحباً بك في نوتريو",
    fuel_your_body: "غذِّ جسمك بذكاء",

    // Errors
    something_went_wrong: "حدث خطأ ما",
    we_apologize: "نعتذر عن الإزعاج. تم الإبلاغ عن الخطأ وسنصلحه قريباً.",
    reload_page: "إعادة تحميل الصفحة",
    not_found: "الصفحة غير موجودة",
    go_home: "الذهاب للرئيسية",

    // Time zones
    timezone_qatar: "قطر (GMT +3)",

    // Gender
    he_him: "هو/له",
    she_her: "هي/لها",

    // Expected impact
    expected_impact: "التأثير المتوقع",
    hide_impact: "إخفاء التأثير",

    // Show results
    show_results: "عرض",
    restaurants_label: "مطاعم",
    meals_label: "وجبات",

    // Report
    overall_score: "النتيجة الإجمالية",
    weekly_performance: "الأداء الأسبوعي",
    habit_intelligence: "وذكاء العادات",
    weekly_report_title: "التقرير الأسبوعي",
    prepared_for: "معد لـ",
    generated: "تم الإنشاء",

    // Auth page
    personalized_plans: "خطط مخصصة",
    calorie_macro_tracking: "تتبع السعرات والمغذيات",
    restaurant_integration: "تكامل المطاعم",
    progress_insights: "التقدم والتحليلات",
    welcome_feature_desc: "احصل على خطط وجبات مصممة لأهدافك وتفضيلاتك الغذائية ونمط حياتك.",
    create_account: "إنشاء حساب",
    full_name: "الاسم الكامل",
    confirm_password: "تأكيد كلمة المرور",
    verify_email: "تحقق من بريدك الإلكتروني",
    otp_sent_to: "أرسلنا رمزاً مكوناً من 6 أرقام إلى",
    enter_otp: "أدخل الرمز المكون من 6 أرقام",
    verify_code: "التحقق من الرمز",
    resend_code: "إعادة إرسال الرمز",
    back_to_signup: "العودة للتسجيل",
    send_reset_link: "إرسال رابط الاستعادة",
    back_to_signin: "العودة لتسجيل الدخول",
    sign_in_required: "تسجيل الدخول مطلوب",
    sign_in_required_desc: "يرجى تسجيل الدخول أو إنشاء حساب للمتابعة.",
    complete: "إتمام",
    male: "ذكر",
    female: "أنثى",

    // Onboarding
    lose_weight: "إنقاص الوزن",
    lose_weight_desc: "تقليل الدهون مع الحفاظ على العضلات",
    build_muscle: "بناء العضلات",
    build_muscle_desc: "اكتساب كتلة عضلية بتغذية مناسبة",
    maintain: "الحفاظ على الوزن",
    maintain_desc: "الحفاظ على وزنك الحالي وتحسين صحتك",
    maintenance_goal: "الحفاظ على الوزن",
    sedentary: "خامل",
    sedentary_desc: "نشاط بدني قليل أو معدوم",
    lightly_active: "نشط قليلاً",
    lightly_active_desc: "تمارين خفيفة 1-3 أيام/أسبوع",
    moderately_active: "نشط بشكل معتدل",
    moderately_active_desc: "تمارين معتدلة 3-5 أيام/أسبوع",
    very_active: "نشط جداً",
    very_active_desc: "تمارين شاقة 6-7 أيام/أسبوع",
    extra_active: "نشط بشكل استثنائي",
    extra_active_desc: "تمارين شاقة جداً وعمل بدني",

    // Main Menu
    food_and_meals: "الطعام والوجبات",
    plan_weekly_meals: "خطط وجباتك الأسبوعية",
    browse_all_restaurants: "تصفح جميع المطاعم",
    progress_and_goals: "التقدم والأهداف",
    track_weight_nutrition: "تتبع الوزن والتغذية ومقاييس الصحة",
    updated: "محدّث",
    orders_and_subscription: "الطلبات والاشتراك",
    view_past_orders: "عرض الطلبات السابقة",
    manage_your_plan: "إدارة خطتك",
    upgrade_your_plan: "ترقية خطتك",
    live_tracking: "التتبع المباشر",
    track_your_orders: "تتبع طلباتك",
    settings_and_account: "الإعدادات والحساب",
    personal_info_preferences: "المعلومات الشخصية والتفضيلات",
    app_preferences: "تفضيلات التطبيق",
    delivery_locations: "مواقع التوصيل",
    earn_rewards: "اكسب مكافآت",
    earn_with_audience: "اكسب مع جمهورك",
    affiliate: "الشراكة",
    menu: "القائمة",
    saved_restaurants: "مطاعم محفوظة",

    // MealWizard
    snacks_salad: "وجبات خفيفة وسلطات",
    breakfast_desc: "ابدأ يومك بطاقة",
    lunch_desc: "أمدّ نشاطك بعد الظهر",
    dinner_desc: "اختم يومك بشكل صحيح",
    snacks_desc: "إضافات صحية",
    back_to_restaurants: "العودة للمطاعم",
    partner_restaurant: "مطعم شريك",

    // Progress page
    great: "ممتاز",
    good: "جيد",
    keep_going: "واصل",
    first_week_complete: "اكتملت الأسبوع الأول",
    logged_meals_7_days: "سجّلت وجبات لمدة 7 أيام",
    protein_pro: "محترف البروتين",
    hit_protein_goal_5_days: "حققت هدف البروتين 5 أيام",
    hydration_hero: "بطل الترطيب",
    drank_8_glasses: "شربت 8 أكواب لمدة أسبوع",
    analyzing_21_days: "تحليل آخر 21 يوماً…",
    log_meals_4_days: "سجّل وجباتك لمدة 4 أيام على الأقل لفتح الاقتراحات المخصصة.",
    set_nutrition_goal_first: "حدد هدفاً غذائياً أولاً حتى نتمكن من تحليل تقدمك.",
    high_confidence_changes: "تغييرات عالية الثقة",
    high_confidence: "ثقة عالية",
    suggestion: "اقتراح",
    exploratory: "استكشافي",
    safety_tip: "نصيحة أمان",

    // TrackerInsights
    smart_adjustments: "تعديلات ذكية",
    suggestions_based_on: "اقتراحات بناءً على",

    // LogMealDialog
    log_food: "تسجيل طعام",
    search_food_items: "ابحث عن أصناف الطعام...",
    quick_log: "تسجيل سريع",
    my_meals: "وجباتي",
    food_name: "اسم الطعام",
    amount: "الكمية",
    unit: "الوحدة",
    add_food: "إضافة طعام",
    nutrition_info: "المعلومات الغذائية",
    per_serving: "لكل حصة",
    add_to_log: "إضافة للسجل",
    serving_size: "حجم الحصة",

    // Schedule page
    meal_schedule: "جدول الوجبات",
    plan_your_meals: "خطط وجباتك للأسبوع",
    add_meal: "إضافة وجبة",
    no_meals_scheduled: "لا توجد وجبات مجدولة",
    delivery_timezone: "منطقة التوصيل الزمنية",

    // Profile page
    he_him_pronoun: "هو/له",
    she_her_pronoun: "هي/لها",
    your_name: "اسمك",
    enter_email: "أدخل بريدك الإلكتروني",
    nutrition_goals: "الأهداف الغذائية",
    daily_calories: "السعرات اليومية",
    daily_protein: "البروتين اليومي",
    daily_carbs: "الكربوهيدرات اليومية",
    daily_fat: "الدهون اليومية",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

// ─── Context ──────────────────────────────────────────────────────────────────
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => translations.en[key],
  isRTL: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return (localStorage.getItem("nutrio_language") as Language) || "en";
    } catch {
      return "en";
    }
  });

  const isRTL = language === "ar";

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("nutrio_language", lang);
    } catch {}
  };

  // Apply dir and lang attributes to the document root
  useEffect(() => {
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", language);
    if (isRTL) {
      document.documentElement.classList.add("rtl");
    } else {
      document.documentElement.classList.remove("rtl");
    }
  }, [language, isRTL]);

  const t = (key: TranslationKey): string => {
    return translations[language][key] ?? translations.en[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLanguage() {
  return useContext(LanguageContext);
}
