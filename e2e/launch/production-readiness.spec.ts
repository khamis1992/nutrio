import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { loadEnv } from "vite";

import { appUrl, getTestUser, type TestRole } from "../config";
import {
  loginAsAdmin,
  loginAsCoach,
  loginAsCustomer,
  loginAsDriver,
  loginAsFleet,
  loginAsPartner,
} from "../utils/helpers";

type LaunchRole = TestRole;
type OperationalRole = Exclude<LaunchRole, "coach">;

type PortalSession = {
  accessToken: string;
  email: string;
  userId: string;
};

type Portal = {
  context: BrowserContext;
  page: Page;
  session: PortalSession;
  client: SupabaseClient;
  requestFailures: string[];
  businessMutations: string[];
};

const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required for the launch gate.",
  );
}

const loginByRole: Record<LaunchRole, (page: Page) => Promise<void>> = {
  customer: loginAsCustomer,
  admin: loginAsAdmin,
  partner: loginAsPartner,
  driver: loginAsDriver,
  fleet: loginAsFleet,
  coach: loginAsCoach,
};

const businessTablePattern =
  /\/rest\/v1\/(?:orders|meal_schedules|delivery_jobs|restaurants|drivers)(?:\?|$)/i;
const requestedScheduleId = process.env.E2E_SHARED_SCHEDULE_ID?.trim();
const activeDeliveryStatuses = ["assigned", "accepted", "picked_up", "in_transit"];
const activeScheduleStatuses = ["ready", "out_for_delivery"];

async function readPortalSession(page: Page): Promise<PortalSession> {
  const session = await page.evaluate(() => {
    const storedEntries = [
      ...Object.entries(localStorage),
      ...Object.entries(sessionStorage),
    ];

    for (const [key, value] of storedEntries) {
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

      const parsed = JSON.parse(value) as Record<string, unknown>;
      const candidate =
        (parsed.currentSession as Record<string, unknown> | undefined) ||
        (parsed.session as Record<string, unknown> | undefined) ||
        parsed;
      const user = candidate.user as Record<string, unknown> | undefined;
      const accessToken = candidate.access_token;

      if (
        typeof accessToken === "string" &&
        user &&
        typeof user.id === "string" &&
        typeof user.email === "string"
      ) {
        return {
          accessToken,
          email: user.email,
          userId: user.id,
        };
      }
    }

    return null;
  });

  if (!session) {
    throw new Error("The authenticated Supabase session was not found in browser storage.");
  }

  return session;
}

async function openPortal(browser: Browser, role: LaunchRole): Promise<Portal> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requestFailures: string[] = [];
  const businessMutations: string[] = [];

  await loginByRole[role](page);
  const session = await readPortalSession(page);
  const expectedCredentials = getTestUser(role);

  expect(session.email.toLowerCase(), `${role} authenticated as the wrong user`).toBe(
    expectedCredentials.email.toLowerCase(),
  );

  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      /\/(?:rest|functions)\/v1\//i.test(response.url())
    ) {
      requestFailures.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  page.on("request", (request) => {
    if (
      businessTablePattern.test(request.url()) &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    ) {
      businessMutations.push(`${request.method()} ${request.url()}`);
    }
  });

  const client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    },
  });

  return { context, page, session, client, requestFailures, businessMutations };
}

function expectNoPortalErrors(role: LaunchRole, portal: Portal) {
  expect(
    portal.requestFailures,
    `${role} received failing Supabase responses:\n${portal.requestFailures.join("\n")}`,
  ).toEqual([]);
  expect(
    portal.businessMutations,
    `${role} launch verification mutated business data:\n${portal.businessMutations.join("\n")}`,
  ).toEqual([]);
}

test.describe("Nutrio six-portal launch gate", () => {
  test("the same scheduled delivery is visible and consistent in every portal", async ({
    browser,
  }) => {
    const roles: OperationalRole[] = ["customer", "partner", "admin", "driver", "fleet"];
    const portals = {} as Record<OperationalRole, Portal>;

    try {
      for (const role of roles) {
        portals[role] = await openPortal(browser, role);
      }

      const { data: driver, error: driverError } = await portals.driver.client
        .from("drivers")
        .select("id, user_id")
        .eq("user_id", portals.driver.session.userId)
        .single();
      expect(driverError, "Driver account is not linked to a driver record").toBeNull();
      expect(driver?.id).toBeTruthy();

      let activeJobsQuery = portals.admin.client
        .from("delivery_jobs")
        .select("id, schedule_id, restaurant_id, driver_id, status")
        .eq("driver_id", driver!.id)
        .in("status", activeDeliveryStatuses)
        .not("schedule_id", "is", null)
        .order("created_at", { ascending: false });
      if (requestedScheduleId) {
        activeJobsQuery = activeJobsQuery.eq("schedule_id", requestedScheduleId);
      }
      const { data: activeJobs, error: activeJobsError } = await activeJobsQuery;
      expect(activeJobsError, "Admin cannot read the driver's active jobs").toBeNull();
      expect(
        activeJobs?.length,
        requestedScheduleId
          ? `E2E_SHARED_SCHEDULE_ID ${requestedScheduleId} is not assigned to the test driver`
          : "No assigned schedule delivery is available as a launch sentinel; create one through the real customer, partner, and fleet workflow or set E2E_SHARED_SCHEDULE_ID",
      ).toBeGreaterThan(0);

      const scheduleIds = (activeJobs || [])
        .map((job) => job.schedule_id)
        .filter((id): id is string => Boolean(id));
      const { data: schedules, error: schedulesError } = await portals.admin.client
        .from("meal_schedules")
        .select("id, user_id, meal_id, restaurant_id, scheduled_date, order_status, delivery_type")
        .in("id", scheduleIds)
        .in("order_status", activeScheduleStatuses)
        .neq("delivery_type", "pickup");
      expect(schedulesError, "Admin cannot read launch-sentinel schedules").toBeNull();
      expect(
        schedules?.length,
        "No active delivery schedule is assigned to the test driver",
      ).toBeGreaterThan(0);

      const schedule = schedules![0];
      const job = activeJobs!.find((candidate) => candidate.schedule_id === schedule.id);
      expect(job, "The launch schedule has no matching delivery job").toBeTruthy();
      if (["picked_up", "in_transit"].includes(job!.status)) {
        expect(schedule.order_status).toBe("out_for_delivery");
      }

      const { data: meal, error: mealError } = await portals.admin.client
        .from("meals")
        .select("id, name, restaurant_id")
        .eq("id", schedule.meal_id)
        .single();
      expect(mealError).toBeNull();

      const restaurantId = schedule.restaurant_id || job!.restaurant_id || meal!.restaurant_id;
      expect(restaurantId, "Launch schedule cannot be linked to a restaurant").toBeTruthy();

      expect(schedule.user_id, "Launch schedule belongs to a different customer").toBe(
        portals.customer.session.userId,
      );

      const { data: partnerRestaurant, error: partnerRestaurantError } =
        await portals.partner.client
          .from("restaurants")
          .select("id, owner_id, name")
          .eq("id", restaurantId!)
          .eq("owner_id", portals.partner.session.userId)
          .single();
      expect(
        partnerRestaurantError,
        "Launch schedule is not owned by the authenticated partner",
      ).toBeNull();

      const { data: adminRole, error: adminRoleError } = await portals.admin.client
        .from("user_roles")
        .select("role")
        .eq("user_id", portals.admin.session.userId)
        .eq("role", "admin")
        .single();
      expect(adminRoleError, "Admin account has no admin role").toBeNull();
      expect(adminRole?.role).toBe("admin");

      const { data: fleetManager, error: fleetManagerError } = await portals.fleet.client
        .from("fleet_managers")
        .select("id, is_active")
        .eq("auth_user_id", portals.fleet.session.userId)
        .eq("is_active", true)
        .single();
      expect(fleetManagerError, "Fleet account is not an active fleet manager").toBeNull();
      expect(fleetManager?.id).toBeTruthy();

      for (const role of ["customer", "partner", "admin", "fleet"] as const) {
        const { data, error } = await portals[role].client
          .from("meal_schedules")
          .select("id, user_id, meal_id, restaurant_id, scheduled_date, order_status, delivery_type")
          .eq("id", schedule.id)
          .single();
        expect(error, `${role} cannot read the shared meal schedule`).toBeNull();
        expect(data, `${role} received a different schedule`).toMatchObject(schedule);
      }

      for (const role of roles) {
        const { data, error } = await portals[role].client
          .from("delivery_jobs")
          .select("id, schedule_id, restaurant_id, driver_id, status")
          .eq("id", job!.id)
          .single();
        expect(error, `${role} cannot read the shared delivery job`).toBeNull();
        expect(data, `${role} received a different delivery job`).toMatchObject({
          id: job!.id,
          schedule_id: schedule.id,
          driver_id: driver!.id,
          status: job!.status,
        });
      }

      const sourcePrefix = schedule.id.slice(0, 8).toUpperCase();

      await portals.customer.page.goto(appUrl("/orders"));
      const customerOrder = portals.customer.page.getByTestId(
        `order-history-item-${schedule.id}`,
      );
      await expect(customerOrder).toBeVisible();
      await expect(customerOrder).toContainText(meal!.name);
      await expect(customerOrder).toContainText(
        /Ready|Out for delivery|On the way|جاهز|قيد التوصيل|في الطريق/i,
      );

      await portals.partner.page.goto(appUrl("/partner/orders"));
      const partnerOrder = portals.partner.page.getByTestId(`partner-order-${schedule.id}`);
      await expect(partnerOrder).toBeVisible();
      await expect(partnerOrder).toContainText(meal!.name);

      await portals.admin.page.goto(appUrl("/admin/orders"));
      const adminOrder = portals.admin.page.getByTestId(`admin-order-${schedule.id}`);
      await expect(adminOrder).toBeVisible();
      await expect(adminOrder).toContainText(meal!.name);

      await portals.driver.page.goto(appUrl(`/driver/orders/${job!.id}`));
      await expect(portals.driver.page.getByTestId("driver-order-source-id")).toHaveText(
        sourcePrefix,
      );
      await expect(portals.driver.page.getByText(meal!.name, { exact: true })).toBeVisible();

      await portals.fleet.page.goto(appUrl("/fleet/dispatch?tab=live"));
      const fleetDriver = portals.fleet.page.getByTestId(`fleet-driver-${driver!.id}`);
      await expect(fleetDriver).toBeVisible();
      await expect(fleetDriver).toHaveAttribute(
        "data-active-delivery-job-ids",
        new RegExp(job!.id),
      );

      const { error: canonicalDeliverySchemaError } = await portals.admin.client
        .from("delivery_jobs")
        .select("id, order_id")
        .limit(1);
      expect(
        canonicalDeliverySchemaError,
        "delivery_jobs.order_id is missing; the canonical direct-order delivery migration has not been deployed",
      ).toBeNull();

      for (const role of roles) {
        expectNoPortalErrors(role, portals[role]);
      }
    } finally {
      await Promise.all(
        Object.values(portals).map((portal) => portal.context.close()),
      );
    }
  });

  test("the coach and customer share the same active coaching relationship", async ({
    browser,
  }) => {
    const portals = {} as Partial<Record<"coach" | "customer", Portal>>;

    try {
      portals.customer = await openPortal(browser, "customer");
      portals.coach = await openPortal(browser, "coach");

      const customer = portals.customer;
      const coach = portals.coach;

      const { data: coachRole, error: coachRoleError } = await coach.client
        .from("user_roles")
        .select("role")
        .eq("user_id", coach.session.userId)
        .eq("role", "coach")
        .single();
      expect(coachRoleError, "Coach account has no coach role").toBeNull();
      expect(coachRole?.role).toBe("coach");

      const { data: coachAssignment, error: coachAssignmentError } = await coach.client
        .from("coach_client_assignments")
        .select("id, coach_id, client_id, status")
        .eq("coach_id", coach.session.userId)
        .eq("client_id", customer.session.userId)
        .eq("status", "active")
        .single();
      expect(
        coachAssignmentError,
        "The launch coach is not actively assigned to the launch customer",
      ).toBeNull();
      expect(coachAssignment?.id).toBeTruthy();

      const { data: customerAssignment, error: customerAssignmentError } =
        await customer.client
          .from("coach_client_assignments")
          .select("id, coach_id, client_id, status")
          .eq("id", coachAssignment!.id)
          .single();
      expect(
        customerAssignmentError,
        "The customer cannot read the shared coach assignment",
      ).toBeNull();
      expect(customerAssignment).toMatchObject(coachAssignment!);

      for (const table of ["coach_programs", "coach_messages"] as const) {
        const select = "id, coach_id, client_id";
        const [{ data: coachRows, error: coachError }, { data: customerRows, error: customerError }] =
          await Promise.all([
            coach.client
              .from(table)
              .select(select)
              .eq("coach_id", coach.session.userId)
              .eq("client_id", customer.session.userId),
            customer.client
              .from(table)
              .select(select)
              .eq("coach_id", coach.session.userId)
              .eq("client_id", customer.session.userId),
          ]);

        expect(coachError, `Coach cannot read shared ${table}`).toBeNull();
        expect(customerError, `Customer cannot read shared ${table}`).toBeNull();
        expect((customerRows || []).map((row) => row.id).sort()).toEqual(
          (coachRows || []).map((row) => row.id).sort(),
        );
      }

      await coach.page.goto(appUrl("/coach"));
      await expect(coach.page).toHaveURL(/\/coach(?:[/?#]|$)/);
      await expect(coach.page.locator("body")).toBeVisible();

      await customer.page.goto(appUrl("/community"));
      await expect(customer.page).toHaveURL(/\/community(?:[/?#]|$)/);
      await expect(customer.page.locator("body")).toBeVisible();

      expectNoPortalErrors("coach", coach);
      expectNoPortalErrors("customer", customer);
    } finally {
      await Promise.all(
        Object.values(portals).map((portal) => portal.context.close()),
      );
    }
  });
});
