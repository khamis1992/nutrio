# Nutrio x SportHub Integration Contract

**Audience:** SportHub backend, mobile, security, and QA teams  
**Nutrio implementation status:** Ready for partner credentials and sandbox testing  
**Contract version:** 1.0  
**Date:** 12 July 2026

## 1. Purpose

This document defines everything SportHub must implement or provide so Nutrio customers can securely link their SportHub account and use booking/activity data for meal, hydration, and recovery guidance.

The integration has four independent flows:

1. Nutrio to SportHub referral and app opening.
2. OAuth 2.0 Authorization Code with PKCE account linking.
3. Signed SportHub webhooks for real-time booking and activity updates.
4. Authenticated activity API for initial import and recovery from missed webhooks.

No medical records, meal history, body measurements, payment details, or passwords are shared with SportHub.

## 2. Nutrio Environments

### Production endpoints

- OAuth callback: `https://loepcagitrijlfksawfm.supabase.co/functions/v1/sporthub-oauth-callback`
- Webhook receiver: `https://loepcagitrijlfksawfm.supabase.co/functions/v1/sporthub-webhook`
- SportHub landing in Nutrio: `https://nutrio.me/nutrio/sporthub`
- Linked integration screen: `https://nutrio.me/nutrio/partners/sporthub`

SportHub must provide equivalent sandbox authorization, token, user-info, API, and webhook test facilities before production activation.

## 3. Values Required From SportHub

SportHub must send Nutrio the following values through a secure channel:

- OAuth authorization endpoint.
- OAuth token endpoint.
- OAuth user-info endpoint, if the token response does not include a stable user ID.
- REST API base URL.
- OAuth client ID.
- OAuth client secret.
- Webhook HMAC secret with at least 32 random bytes.
- Supported scopes and their exact names.
- Sandbox test users for success, declined consent, expired token, and revoked access.
- Confirmed Android App Link and iOS Universal Link formats.

Nutrio will configure these as server-side secrets. They must never be embedded in either mobile application.

## 4. OAuth 2.0 Account Linking

### 4.1 Authorization request

Nutrio redirects the customer to the SportHub authorization endpoint with:

```text
response_type=code
client_id={NUTRIO_CLIENT_ID}
redirect_uri=https://loepcagitrijlfksawfm.supabase.co/functions/v1/sporthub-oauth-callback
scope=openid profile bookings.read activities.read
state={ONE_TIME_RANDOM_STATE}
code_challenge={PKCE_S256_CHALLENGE}
code_challenge_method=S256
```

Requirements:

- `state` is one-time and expires after 10 minutes.
- SportHub must return the state unchanged.
- Consent must list booking status, activity type, session time, duration, calories when available, and venue name.
- Declined consent returns `error=access_denied` with the original state.

### 4.2 Successful callback

```http
GET /functions/v1/sporthub-oauth-callback?code=AUTH_CODE&state=ORIGINAL_STATE
```

### 4.3 Token exchange

SportHub must accept:

```http
POST {SPORTHUB_TOKEN_URL}
Content-Type: application/x-www-form-urlencoded
Accept: application/json

grant_type=authorization_code
code={AUTH_CODE}
client_id={NUTRIO_CLIENT_ID}
client_secret={NUTRIO_CLIENT_SECRET}
redirect_uri={REGISTERED_CALLBACK}
code_verifier={PKCE_VERIFIER}
```

Expected response:

```json
{
  "access_token": "opaque-access-token",
  "refresh_token": "opaque-refresh-token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile bookings.read activities.read",
  "user_id": "sh_user_12345"
}
```

`user_id` must be stable and never reassigned. If omitted, the user-info endpoint must return it as `id`, `user_id`, or OpenID `sub`.

## 5. Activity API

Nutrio uses this endpoint after linking and as a recovery path when a webhook is missed.

```http
GET {SPORTHUB_API_BASE_URL}/v1/me/activities?from={ISO_8601}&to={ISO_8601}
Authorization: Bearer {ACCESS_TOKEN}
Accept: application/json
```

Expected response:

```json
{
  "data": [
    {
      "id": "session_987",
      "user_id": "sh_user_12345",
      "activity_type": "Padel",
      "venue_name": "Doha Sports Park",
      "starts_at": "2026-07-15T17:00:00+03:00",
      "ends_at": "2026-07-15T18:30:00+03:00",
      "duration_minutes": 90,
      "calories_burned": 620,
      "status": "confirmed"
    }
  ]
}
```

Rules:

- Pagination must be documented if more than 100 records can be returned.
- Times must be ISO 8601 with an explicit offset or UTC `Z`.
- Valid status values: `booked`, `confirmed`, `completed`, `cancelled`, `no_show`.
- Calories may be `null`; never send a fabricated zero unless the measured value is zero.
- A session ID must remain unchanged across status updates.
- `401` or `403` causes Nutrio to mark the integration as requiring reauthorization.

## 6. Webhook Contract

### 6.1 Required headers

```http
Content-Type: application/json
X-SportHub-Event-Id: evt_01J...
X-SportHub-Timestamp: 1784124000
X-SportHub-Signature: sha256={LOWERCASE_HEX_HMAC}
```

`X-SportHub-Timestamp` may contain Unix seconds or milliseconds. Nutrio rejects requests more than five minutes old.

### 6.2 Signature generation

1. Preserve the exact UTF-8 request body bytes.
2. Create the signed value: `{timestamp}.{rawBody}`.
3. Calculate HMAC-SHA256 using the shared webhook secret.
4. Send lowercase hexadecimal output prefixed with `sha256=`.

Example pseudocode:

```javascript
const signedPayload = `${timestamp}.${rawBody}`;
const signature = crypto
  .createHmac("sha256", webhookSecret)
  .update(signedPayload, "utf8")
  .digest("hex");
headers["X-SportHub-Signature"] = `sha256=${signature}`;
```

### 6.3 Supported events

- `booking.created`
- `booking.confirmed`
- `booking.cancelled`
- `activity.completed`
- `activity.updated`
- `activity.no_show`

### 6.4 Webhook payload

```json
{
  "id": "evt_01JABC123",
  "type": "activity.completed",
  "created_at": "2026-07-15T18:35:10+03:00",
  "data": {
    "session_id": "session_987",
    "user_id": "sh_user_12345",
    "activity_type": "Padel",
    "venue_name": "Doha Sports Park",
    "starts_at": "2026-07-15T17:00:00+03:00",
    "ends_at": "2026-07-15T18:30:00+03:00",
    "duration_minutes": 90,
    "calories_burned": 620,
    "status": "completed"
  }
}
```

### 6.5 Delivery requirements

- Deliver at least once; Nutrio handles duplicate event IDs idempotently.
- Retry `408`, `425`, `429`, and `5xx` using exponential backoff.
- Suggested schedule: 30 seconds, 2 minutes, 10 minutes, 1 hour, 6 hours, 24 hours.
- Do not retry permanent `400`, `401`, `404`, or `422` errors without correcting the request.
- Keep delivery logs for at least 30 days.
- Provide a dashboard action to replay an event by event ID.

### 6.6 Nutrio responses

- `200`: accepted and processed, or duplicate already processed.
- `202`: valid non-activity event stored but not projected as a workout.
- `401`: missing/stale timestamp or invalid signature.
- `404`: no linked Nutrio account for this SportHub user.
- `422`: required event fields are missing or invalid.
- `500`: temporary Nutrio processing failure; retry.

## 7. Data Behavior in Nutrio

- Booked and confirmed sessions appear as upcoming SportHub activities.
- Completed sessions create or update one Nutrio workout using the SportHub session ID.
- Cancelled and no-show sessions remove any projected Nutrio workout.
- Duplicate webhook deliveries do not duplicate workouts.
- SportHub activities are labeled with their source and cannot be manually deleted in Nutrio.
- Disconnecting deletes stored OAuth credentials and stops future synchronization.

## 8. Referral Links

### SportHub to Nutrio

```text
https://nutrio.me/nutrio/sporthub?campaign={CAMPAIGN}&sporthub_user={STABLE_USER_ID}
```

This link is for attribution only. It does not link accounts and must not expose email, phone, access tokens, or other personal information.

### Nutrio to SportHub

Nutrio currently opens:

```text
https://www.sporthubapp.com/?source=nutrio&campaign={CAMPAIGN}&code=NUTRIO15
```

SportHub should provide equivalent Universal Link and Android App Link URLs that open the installed app and fall back to the correct store or website.

## 9. Security Requirements

- TLS 1.2 or newer for every endpoint.
- OAuth Authorization Code with PKCE; implicit flow is not accepted.
- Access and refresh tokens must never be placed in URLs or mobile logs.
- Rotate client and webhook secrets without downtime using overlapping keys.
- Rate-limit authorization, token, API, and webhook endpoints.
- Audit consent, token refresh, unlink, webhook delivery, and replay actions.
- Notify Nutrio before changing scopes, field names, event names, or signature rules.
- Delete or stop processing Nutrio-linked data after account disconnection.

## 10. Acceptance Test Matrix

SportHub and Nutrio QA must jointly pass all cases:

1. Customer approves linking and returns to Nutrio as connected.
2. Customer denies consent and Nutrio remains disconnected.
3. Invalid or reused state is rejected.
4. Invalid HMAC signature is rejected with `401`.
5. Timestamp older than five minutes is rejected.
6. Booking creation appears as an upcoming activity.
7. Booking cancellation removes it from the upcoming state.
8. Completed activity appears once in Nutrio workout history.
9. The same event delivered three times still creates one workout.
10. A missed webhook is recovered by manual sync.
11. Expired authorization changes Nutrio to “Reconnect”.
12. Unlink removes credentials and subsequent events return `404`.
13. Qatar timezone dates remain correct for sessions near midnight.
14. No Nutrio nutrition or medical data is sent to SportHub.

## 11. Go-Live Checklist

### SportHub

- [ ] Provide sandbox endpoints and test accounts.
- [ ] Register the exact Nutrio OAuth callback.
- [ ] Implement PKCE S256.
- [ ] Implement `/v1/me/activities`.
- [ ] Implement all required signed webhook events.
- [ ] Configure retries and event replay.
- [ ] Provide mobile deep links.
- [ ] Complete joint security and QA review.

### Nutrio

- [ ] Configure SportHub OAuth and API secrets in Supabase.
- [ ] Generate and configure the 32-byte token encryption key.
- [ ] Apply the SportHub database migration.
- [ ] Deploy link-start, callback, sync, unlink, and webhook functions.
- [ ] Exchange and configure the webhook secret.
- [ ] Run the joint acceptance matrix.
- [ ] Enable the production integration UI after approval.

## 12. Nutrio Server Configuration Names

SportHub values map to these Nutrio server secrets:

```text
SPORTHUB_AUTHORIZATION_URL
SPORTHUB_TOKEN_URL
SPORTHUB_USERINFO_URL
SPORTHUB_API_BASE_URL
SPORTHUB_CLIENT_ID
SPORTHUB_CLIENT_SECRET
SPORTHUB_REDIRECT_URI
SPORTHUB_WEBHOOK_SECRET
SPORTHUB_TOKEN_ENCRYPTION_KEY
NUTRIO_APP_URL
```

The token encryption key is generated and owned by Nutrio. SportHub does not need to receive it.
