export const ROUTES = {
  // Auth
  AUTH: '/auth',
  SIGN_IN: '/auth',
  SIGN_UP: '/auth',
  FORGOT_PASSWORD: '/auth',
  RESET_PASSWORD: '/auth',
  OTP: '/auth',

  // Customer core
  DASHBOARD: '/dashboard',
  MEALS: '/meals',
  ORDERS: '/orders',
  ORDER_DETAIL: (id: string) => `/orders/${id}`,
  SUBSCRIPTION: '/subscription',
  SUBSCRIPTION_PLANS: '/subscription/plans',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  WALLET: '/wallet',
  CHECKOUT: '/checkout',
  SCHEDULE: '/schedule',
  TRACKER: '/tracker',
  NOTIFICATIONS: '/notifications',
  FAVORITES: '/favorites',
  ADDRESSES: '/addresses',
  ONBOARDING: '/onboarding',

  // Nutrition & health
  PROGRESS: '/progress',
  BODY_METRICS: '/body-metrics',
  WEIGHT_TRACKING: '/weight-tracking',
  WATER_TRACKER: '/water-tracker',
  STEP_COUNTER: '/step-counter',
  LOG_ACTIVITY: '/log-activity',
  DIETARY: '/dietary',
  NUTRITION_GOALS: '/nutrition-goals',
  AI_REPORT: '/ai-report',
  RECOVERY_INSIGHTS: '/recovery-insights',
  MEDICATIONS: '/medications',

  // Social & community
  COMMUNITY: '/community',
  FRIENDS: '/friends',
  FRIEND_LEADERBOARD: '/friend-leaderboard',
  LEADERBOARD: '/leaderboard',
  COACHES: '/coaches',
  COACH_MESSAGES: '/coach-messages',

  // Content
  RECIPES: '/recipes',
  RECIPE_NEW: '/recipes/new',
  RECIPE_DETAIL: (id: string) => `/recipes/${id}`,
  MEAL_PLAN: '/meal-plan',
  MEAL_DETAIL: (id: string) => `/meals/${id}`,
  RESTAURANT_DETAIL: (id: string) => `/restaurant/${id}`,

  // Commerce
  REWARDS: '/rewards',
  AFFILIATE: '/affiliate',
  REFERRAL_TRACKING: '/referral-tracking',
  MARKETPLACE: '/marketplace',
  INVOICE_HISTORY: '/invoice-history',

  // Support
  SUPPORT: '/support',
  CONTACT: '/contact',
  FAQ: '/faq',

  // Info
  ABOUT: '/about',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  POLICIES: '/policies',

  // Other
  PERSONAL_INFO: '/personal-info',
  LIVE_MAP: '/live-map',
  WALKTHROUGH: '/walkthrough',
  GOOGLE_FIT_CALLBACK: '/google-fit-callback',
  DELIVERY_TRACKING: '/delivery-tracking',

  // Admin
  ADMIN: '/admin',
  ADMIN_DASHBOARD: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_RESTAURANTS: '/admin/restaurants',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_ANALYTICS: '/admin/analytics',

  // Partner
  PARTNER: '/partner',
  PARTNER_AUTH: '/partner/auth',
  PARTNER_DASHBOARD: '/partner',
  PARTNER_MENU: '/partner/menu',
  PARTNER_ORDERS: '/partner/orders',

  // Driver
  DRIVER: '/driver',
  DRIVER_AUTH: '/driver/auth',
  DRIVER_DASHBOARD: '/driver',
  DRIVER_DELIVERIES: '/driver/deliveries',

  // Fleet
  FLEET: '/fleet',
  FLEET_LOGIN: '/fleet/login',
} as const;
