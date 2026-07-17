# Nutrio Forensic Evidence Protocol

## Status

The controls in migration `20260717092000_harden_forensic_evidence_integrity.sql`
are fail-closed. They are not production evidence until the migration, Edge
Function, secrets, scheduler, and independent receiver have all been deployed
and verified.

## Ledger anchors

- Every anchored event has an immutable row in
  `security.event_anchor_memberships`.
- Version 3 anchors select every committed, previously unanchored event before
  the completed UTC cutoff. They do not assume identity sequence values become
  visible in commit order.
- A late commit missed by one maintenance run remains unanchored and is selected
  by the next anchor even if its sequence is lower than an earlier anchor head.
- Full verification recomputes every event seal, every v2 range, every v3
  membership digest, the complete anchor chain, receipt seals, and historical
  coverage. The compatibility `p_limit` argument never limits verification.
- A committed event older than the latest anchor cutoff and outside every anchor
  makes integrity invalid.

## Receiver acknowledgement contract

The external receiver must be outside the Supabase project and should use
immutable/WORM retention. A `2xx` response alone is rejected.

Nutrio sends these headers:

- `X-Nutrio-Anchor-Hash`
- `X-Nutrio-Payload-SHA256`
- `X-Nutrio-Signature: sha256=<outbound HMAC>`

The receiver verifies the outbound HMAC, durably stores the exact request body,
and returns JSON no larger than 16 KiB:

```json
{
  "protocol": "nutrio-security-anchor-ack-v1",
  "anchor_hash": "64 lowercase hex characters",
  "payload_sha256": "64 lowercase hex characters",
  "previous_anchor_hash": "GENESIS or the previous 64-character anchor hash",
  "external_reference": "immutable object/version identifier",
  "acknowledged_at": "2026-07-17T12:00:00.000Z",
  "nonce": "at-least-16-safe-characters",
  "key_id": "receiver-key-2026-01",
  "signature": "sha256=64-lowercase-hex-characters"
}
```

The acknowledgement HMAC input is the following UTF-8 text with newline
separators and no trailing newline:

```text
nutrio-security-anchor-ack-v1
<anchor_hash>
<payload_sha256>
<previous_anchor_hash>
<external_reference>
<acknowledged_at>
<nonce>
<key_id>
```

Before acknowledging a new anchor, the receiver must compare
`previous_anchor_hash` with its own last durably stored anchor. It must reject a
fork, rollback, or skipped predecessor rather than silently starting a new
chain. An idempotent retry is allowed only when the same anchor hash and payload
hash are already stored under the same immutable reference.

Configure these Edge secrets:

- `SECURITY_ANCHOR_HMAC_KEY`: outbound request key, at least 32 random bytes.
- `SECURITY_ANCHOR_ACK_HMAC_KEY`: separate receiver acknowledgement key, at
  least 32 random bytes and never equal to the outbound key.
- `SECURITY_ANCHOR_ACK_KEY_ID`: the active receiver key identifier.
- Existing webhook URL, exact host allowlist, and cron authentication secret.

The receiver should rotate acknowledgement keys with an overlap window. Deploy
the new key to the receiver first, update the Edge secret and key ID, verify one
anchor, then retire the old receiver key.

## Freshness and monitoring

- The Admin posture check fails when the latest anchor has no validated
  receiver acknowledgement.
- It also fails when the latest anchor or acknowledgement is older than 36
  hours, or when historical events are outside every anchor.
- Alert on every non-2xx scheduler response and on the Edge error codes prefixed
  `security_anchor_ack_`.
- Regularly retrieve a sample by `external_reference`, recompute its payload
  hash, and compare it to the local receipt and anchor.

## Incident cases

- Timeline hashes and predecessor links are recomputed server-side.
- Linked event content, event snapshots, and link hashes are recomputed
  server-side.
- Stored timeline head/count and evidence manifest/count detect removal of the
  final row as well as middle-row changes.
- Every mutation, link, and export requires the current incident version.
- A missing integrity result is treated as unverified by the Admin UI.

## Evidence exports

- Ledger and incident packages are serialized by PostgreSQL, not by the browser.
- The audit event records the exact SHA-256, UTF-8 byte length, filename, counts,
  filters, and truncation status before those bytes are returned.
- The browser recomputes byte length and SHA-256 before download and also writes
  a detached `.sha256` companion file.
- Ledger exports are capped at 5,000 rows and 20 MiB. The package and UI disclose
  truncation. Narrow filters until `truncated` is `false` for a complete export.
- An export audit event means "server prepared these bytes". It is not proof
  that the operator retained the downloaded file.

## Residual trust boundaries

- Database owners, Supabase project owners, CI administrators, Edge secret
  administrators, and the external receiver remain privileged trust roles.
- IP addresses, device data, user agents, and timestamps support correlation;
  they do not independently identify a person.
- Preserve Supabase, identity-provider, payment-provider, WAF, mobile release,
  and receiver logs in addition to this ledger.
- For legal attribution or reporting, preserve originals and involve the
  competent authority and qualified forensic personnel.
