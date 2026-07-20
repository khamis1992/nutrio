# Agent 1 Order-to-Consumption Contract Note

Date: 2026-07-20  
Owner: Agent 1  
Migration: `20260720194000_immutable_committed_order_item_nutrition.sql`

## Gap closed

The phase-one lifecycle already snapshots order-item nutrition and records
consumption as versioned events. The remaining gap was that an upgraded row
could still have no snapshot at commitment, and an order item could be replaced
after checkout by changing its meal, quantity, order, or snapshot. That allowed
catalog changes or fulfillment edits to rewrite historical nutrition truth.

This migration makes the commercial boundary executable without changing the
existing consumption RPC contract.

## Commitment boundary

An order is commercially committed when its status first enters one of:

`confirmed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `completed`.

`pending` remains mutable so checkout can assemble an order. A pending order
cancelled before confirmation never becomes committed. Once committed, the
item's `nutrition_snapshot_committed_at` remains set even if the order is later
cancelled. The parent order also retains `order_items_committed_at`, so a
cancelled or regressed legacy order cannot accept replacement rows.

The transition trigger captures every item snapshot in the same transaction as
the status change. It rejects the transition if any item lacks a JSON object,
a positive nutrition revision, or a commitment timestamp.

## Immutable fields

After commitment, these order-item fields cannot be changed:

- `order_id`
- `meal_id`
- `quantity`
- `nutrition_snapshot`
- `nutrition_snapshot_revision`
- `nutrition_snapshot_committed_at`

Committed items also cannot be deleted, and new items cannot be inserted into
an already committed order. Corrections belong in the existing append-only
consumption event flow; they do not replace commercial order history.

## Snapshot and upgrade semantics

Existing non-null snapshots are retained byte-for-byte. The migration only
fills missing commitment metadata around them.

Committed upgraded items with a resolvable `meal_id` receive the canonical
snapshot contract. Legacy items whose meal no longer resolves receive an
explicitly incomplete snapshot: nutrient values are `null`, every missing
nutrient is listed, and provenance is labeled
`upgraded_committed_order_backfill`. The backfill does not invent zero values
or claim to be checkout-time data.

The constraint is added `NOT VALID`, existing committed rows are repaired, and
then the constraint is validated. Replaying the migration preserves snapshots
and commitment timestamps because each backfill targets missing fields only.

## Concurrency and replay

Item writes and the order commitment transition take the same transaction
advisory lock derived from `order_id`. Item triggers lock the parent order row
before the advisory key, matching PostgreSQL's lock order for an order status
update and avoiding lock inversion. The row lock also makes a waiter recheck
the latest committed status. Together these locks serialize the race between
adding or editing an item and confirming the order:

- an item write that wins is included in the committed snapshot set;
- a commitment that wins causes a later item insert or replacement to fail.

The existing consumption transaction continues to lock the profile and source
identity, enforce unique request and semantic identities, and return the prior
result for replayed commands. Repeated delivery transitions create no intake;
only explicit full, partial, skipped, substituted, or reversed commands alter
the nutrition projection.

## Authorization

No new customer-facing mutation grant is introduced. `authenticated` remains
read-only on consumption tables and cannot insert, update, or delete order
items. `record_order_meal_consumption` checks `auth.uid()` against source
ownership inside its security-definer transaction. Consumption rows and events
remain owner-filtered by RLS.

## Verification contract

`supabase/tests/phase-one-order-consumption.sql` verifies:

- snapshot capture at commitment, legacy fallback, and catalog independence;
- rejected item replacement, snapshot mutation, insertion, and deletion;
- immutability after cancellation;
- unauthorized RPC and owner-only RLS behavior;
- delivery without intake and duplicate delivery replay;
- same-request and same-command idempotency;
- substitution, partial edit, reversal, and append-only event versions;
- lock-bearing trigger definitions and database uniqueness constraints that
  provide the concurrency backstop.

The migration is additive, does not change generated Supabase types, does not
edit shared release scripts, and is not applied remotely by Agent 1.
