import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const lifecycleMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720080000_order_consumption_lifecycle.sql"),
  "utf8",
);
const alignmentMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720170000_order_consumption_contract_alignment.sql"),
  "utf8",
);
const migration = `${lifecycleMigration}\n${alignmentMigration}`;

describe("order-to-consumption database contract", () => {
  it("keeps ordered nutrition immutable", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS nutrition_snapshot JSONB");
    expect(migration).toContain("set_order_item_nutrition_snapshot_trigger");
    expect(migration).toContain("set_schedule_nutrition_snapshot_trigger");
    expect(migration).toContain("NEW.nutrition_snapshot := OLD.nutrition_snapshot");
  });

  it("separates delivery from customer-confirmed intake", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.record_order_meal_consumption");
    expect(migration).toContain("AND ms.order_status IN ('delivered', 'completed')");
    expect(migration).toContain("AND o.status::TEXT IN ('delivered', 'completed')");

    const deliveryNotification = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.notify_scheduled_meal_delivered"),
      migration.indexOf("DROP TRIGGER IF EXISTS tr_schedule_delivered_consumption_notification"),
    );
    expect(deliveryNotification).not.toContain("progress_logs");
    expect(deliveryNotification).not.toContain("meal_history");
  });

  it("supports idempotent partial, skipped, substituted and reversed events", () => {
    expect(migration).toContain("'full', 'partial', 'skipped', 'substituted', 'reversed'");
    expect(migration).toContain("UNIQUE (user_id, request_id)");
    expect(lifecycleMigration.match(/pg_advisory_xact_lock/g)).toHaveLength(2);
    expect(migration).toContain("v_new_calories - v_old_calories");
    expect(migration).toContain("p_portion_percent / 100");
    expect(migration).toContain("ON CONFLICT (user_id, log_date) DO UPDATE");
  });

  it("keeps direct writes private and binds RPC writes to auth.uid", () => {
    expect(migration).toContain("ALTER TABLE public.meal_consumptions FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.meal_consumption_events FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON public.meal_consumptions, public.meal_consumption_events FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("v_actor UUID := auth.uid()");
    expect(migration).toContain("AND ms.user_id = v_actor");
    expect(migration).toContain("AND o.user_id = v_actor");
    expect(migration).not.toContain("GRANT INSERT ON public.meal_consumptions TO authenticated");
  });

  it("keeps complete nutrition facts and provenance in immutable snapshots", () => {
    expect(alignmentMigration).toContain("'schema_version', 2");
    expect(alignmentMigration).toContain("'sugar_g', mr.sugar_g");
    expect(alignmentMigration).toContain("'sodium_mg', mr.sodium_mg");
    expect(alignmentMigration).toContain("'micronutrients'");
    expect(alignmentMigration).toContain("'allergens'");
    expect(alignmentMigration).toContain("'serving_quantity'");
    expect(alignmentMigration).toContain("'nutrition_version'");
    expect(alignmentMigration).toContain("'provenance'");
    expect(alignmentMigration).toContain("'missing_nutrient_codes'");
    expect(alignmentMigration).toContain("'backfill_provenance'");
    expect(alignmentMigration).not.toContain("'calories', COALESCE(m.calories, 0)");
    expect(alignmentMigration).not.toContain("'fiber_g', COALESCE(m.fiber_g, 0)");
  });

  it("materializes normalized portion and canonical semantic event identity", () => {
    expect(alignmentMigration).toContain("add column if not exists portion numeric");
    expect(alignmentMigration).toContain("'portion', v_portion");
    expect(alignmentMigration).toContain("semantic_idempotency_key");
    expect(alignmentMigration).toContain("uq_meal_consumption_events_semantic_identity");
    expect(alignmentMigration).toContain("source_type, source_id, source_meal_id, event_type, semantic_idempotency_key");
  });
});
