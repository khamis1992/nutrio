import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routeFiles = [
  "src/App.tsx",
  "src/customer/routes.tsx",
  "src/fleet/routes.tsx",
];

const navFiles = [
  "src/components/AdminSidebar.tsx",
  "src/components/PartnerSidebar.tsx",
  "src/components/layout/BottomTabBar.tsx",
  "src/components/coach/CoachBottomTabBar.tsx",
  "src/components/driver/DriverLayout.tsx",
  "src/components/CustomerLayout.tsx",
];

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const routeValues = [];
const redirectValues = [];

for (const file of routeFiles) {
  const source = read(file);
  for (const match of source.matchAll(/<Route\b[^>]*\bpath=["']([^"']+)["']/g)) {
    routeValues.push({ file, path: match[1] });
  }
  for (const match of source.matchAll(/<Navigate\b[^>]*\bto=["']([^"']+)["']/g)) {
    redirectValues.push({ file, to: match[1] });
  }
}

const registered = new Set();
const nestedRouteScopes = [
  {
    prefix: "/admin",
    paths: new Set([
      "restaurants",
      "restaurants/:id",
      "featured",
      "meal-approvals",
      "nutrition-quality",
      "health-programs",
      "corporate-benefits",
      "users",
      "users/:userId",
      "orders",
      "subscriptions",
      "subscriptions/freezes",
      "analytics",
      "income",
      "profit",
      "settings",
      "exports",
      "payouts",
      "customer-wallets",
      "affiliate-payouts",
      "premium-analytics",
      "affiliate-applications",
      "partner-integrations",
      "affiliate-milestones",
      "streak-rewards",
      "community-challenges",
      "diet-tags",
      "promotions",
      "announcements",
      "support",
      "notifications",
      "drivers",
      "deliveries",
      "ip-management",
      "security",
      "freeze-management",
      "retention-analytics",
      "analytics/retention",
      "audit/rollovers",
      "coach-applications",
      "coach-commission",
      "ai-engine",
    ]),
  },
  {
    prefix: "/partner",
    paths: new Set([
      "menu",
      "addons",
      "orders",
      "settings",
      "analytics",
      "notifications",
      "reviews",
      "profile",
      "payouts",
      "boost",
      "earnings",
    ]),
  },
  {
    prefix: "/driver",
    paths: new Set([
      "orders",
      "orders/:id",
      "history",
      "earnings",
      "payouts",
      "profile",
      "settings",
      "support",
      "notifications",
    ]),
  },
  {
    prefix: "/coach",
    paths: new Set([
      "insights",
      "chat",
      "earnings",
      "settings",
      "client/:clientId",
      "schedule",
    ]),
  },
  {
    prefix: "/fleet",
    paths: new Set([
      "dispatch",
      "orders",
      "routes",
      "auto-dispatch",
      "drivers",
      "drivers/new",
      "drivers/:id",
      "vehicles",
      "tracking",
      "payouts",
      "payouts/process",
      "analytics",
      "branch-orders",
    ]),
  },
];

for (const route of routeValues) {
  if (route.path.startsWith("/")) {
    registered.add(route.path);
    continue;
  }

  for (const { prefix, paths } of nestedRouteScopes) {
    if (!paths.has(route.path)) continue;
    registered.add(`${prefix}/${route.path}`.replace(/\/index$/, ""));
  }
}
registered.add("*");

const normalizeTarget = (target) => target.split("?")[0].replace(/\/$/, "") || "/";

const routeMatches = (target) => {
  const cleanTarget = normalizeTarget(target);
  if (registered.has(cleanTarget)) return true;

  const targetParts = cleanTarget.split("/").filter(Boolean);
  return [...registered].some((route) => {
    const routeParts = route.split("/").filter(Boolean);
    if (routeParts.length !== targetParts.length) return false;
    return routeParts.every((part, index) => part.startsWith(":") || part === targetParts[index]);
  });
};

const navTargets = [];
for (const file of navFiles) {
  const source = read(file);
  const patterns = [
    /\bto:\s*["'](\/[^"']+)["']/g,
    /\bpath:\s*["'](\/[^"']+)["']/g,
    /\bto=["'](\/[^"']+)["']/g,
    /HIDDEN_NAV_PATHS\s*=\s*\[[\s\S]*?\]/m,
  ];

  for (const pattern of patterns.slice(0, 3)) {
    for (const match of source.matchAll(pattern)) {
      navTargets.push({ file, target: match[1] });
    }
  }

  const hiddenList = source.match(patterns[3]);
  if (hiddenList) {
    for (const match of hiddenList[0].matchAll(/["'](\/[^"']+)["']/g)) {
      navTargets.push({ file, target: match[1] });
    }
  }
}

const duplicateRoutes = [...registered]
  .map((route) => ({
    route,
    count: routeValues.filter((item) => item.path === route).length,
  }))
  .filter((item) => item.count > 1);

const brokenRedirects = redirectValues.filter((item) => !routeMatches(item.to));
const brokenNav = navTargets.filter((item) => !routeMatches(item.target));

if (duplicateRoutes.length || brokenRedirects.length || brokenNav.length) {
  console.error("Route map audit failed.");
  if (duplicateRoutes.length) {
    console.error("\nDuplicate route declarations:");
    duplicateRoutes.forEach((item) => console.error(`- ${item.route} (${item.count})`));
  }
  if (brokenRedirects.length) {
    console.error("\nRedirects to missing routes:");
    brokenRedirects.forEach((item) => console.error(`- ${item.file}: ${item.to}`));
  }
  if (brokenNav.length) {
    console.error("\nNavigation targets without registered routes:");
    brokenNav.forEach((item) => console.error(`- ${item.file}: ${item.target}`));
  }
  process.exit(1);
}

console.log(`Route map audit passed: ${registered.size} routes, ${navTargets.length} navigation targets.`);
