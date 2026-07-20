# ADR 0005: Domain Events Before Notifications

- Status: Accepted for phase-one implementation
- Owner: Agent 0
- Consumers: Agents 1-10

## Decision

Feature transactions emit versioned domain events into a shared transactional
outbox. Agent 9 maps those events to existing notification preferences,
in-app rows, push delivery, and deep links. Feature agents do not create
one-off push workers.

The domain-event envelope contains:

- event ID, event type, schema version, and occurred time;
- aggregate type and ID;
- actor ID and audience user ID when applicable;
- producer idempotency key and correlation/causation IDs;
- minimal structured payload;
- privacy classification.

The producer inserts the event in the same database transaction as the domain
fact. Consumers claim events with replay-safe delivery records. Failure uses
bounded retry and dead-letter visibility; it never rolls back the committed
domain fact.

Event names use past-tense dot notation, for example
`meal.delivered.v1`, `meal.consumption_recorded.v1`,
`health.sync_failed.v1`, and `challenge.reward_granted.v1`.

## Privacy and content

Push and analytics payloads contain IDs and safe presentation hints, not raw
health measurements, medication conflicts, journal text, or detailed nutrient
values. The authenticated client fetches sensitive detail after opening the
deep link. Localized copy remains in the translation layer.

## Compatibility

Existing direct notification triggers remain operational until Agent 9 maps
their equivalent domain events and verifies preference, retry, and deep-link
behavior. New phase-one features must emit domain events and may not add a
parallel delivery pipeline.

## Consequences

Agent 9 exclusively owns shared delivery workers and event-to-notification
mappings. Other agents own only their event emission. Agent 10 tests replay,
preferences, failure/dead-letter behavior, privacy, and deep links.

