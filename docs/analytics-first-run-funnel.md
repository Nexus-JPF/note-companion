# First-run funnel analytics

Server-side only. The Obsidian plugin has no telemetry (Obsidian's developer policies prohibit client-side telemetry in directory plugins), so every step below is observed by the web app.

Events carry user ids, counts and categories only. No emails, no vault content.

## Funnel steps and where they come from

| Step | Event | Source |
|---|---|---|
| Plugin installed | n/a | Obsidian plugin download count (not observable server-side) |
| Account created in the plugin | `plugin_account_created` | `POST /api/sign-up` |
| Signed in from the plugin | `plugin_signin_succeeded` | `POST /api/sign-in` |
| Sign-in failed (anonymous) | `plugin_signin_failed` with `reason`: `no_account`, `social_account`, `wrong_password`, `rate_limited` | `POST /api/sign-in` |
| First plugin API use | first `call-api` per user | `lib/handleAuthorization.ts` (existing) |
| Activated (used AI tokens) | first `token_usage` per user | `lib/incrementAndLogTokenUsage.ts` (existing) |
| Checkout finished (trial or paid start) | `subscription_started` | Stripe `checkout.session.completed` (subscription mode only) |
| Trial invoice / real charge | `invoice_paid` with `paid` false (a $0 trial invoice) or true (money collected) | Stripe `invoice.paid` |
| Charge declined | `invoice_payment_failed` | Stripe `invoice.payment_failed` |
| Cancelled | `subscription_canceled` with `reason`, `feedback`, `during_trial`, `interval` | Stripe `customer.subscription.deleted` |

Stripe events are captured only after the existing webhook handler succeeds, and only when the user id can be read from the event metadata.

Notes:
- `plugin_signin_failed` is recorded without a person profile, so it counts attempts only. `social_account` is the number of Google or other social-login users who tried a password.
- `call-api` already includes the user's email as a property. That predates this work; consider removing it.
- Accounts created on the web (not through the plugin) are not counted in `plugin_account_created`.

## Queries (PostHog SQL)

Weekly new plugin users and how many used AI tokens within a day (uses existing events; the first week of any window over-counts existing users):

```sql
SELECT
  toStartOfWeek(first_call, 1) AS week,
  count() AS new_api_users,
  countIf(first_token_raw > toDateTime(0) AND first_token_raw <= first_call + INTERVAL 1 DAY) AS used_tokens_within_1d
FROM (
  SELECT
    person_id,
    minIf(timestamp, event = 'call-api') AS first_call,
    minIf(timestamp, event = 'token_usage') AS first_token_raw
  FROM events
  WHERE event IN ('call-api', 'token_usage')
    AND timestamp >= now() - INTERVAL 150 DAY
  GROUP BY person_id
  HAVING first_call > toDateTime(0)
)
GROUP BY week
ORDER BY week
```

Weekly funnel from the new events (available once this change is deployed):

```sql
SELECT
  toStartOfWeek(timestamp, 1) AS week,
  uniqIf(person_id, event = 'plugin_account_created') AS accounts_created,
  uniqIf(person_id, event = 'plugin_signin_succeeded') AS signed_in,
  uniqIf(person_id, event = 'subscription_started') AS checkouts,
  uniqIf(person_id, event = 'invoice_paid' AND properties.paid = true) AS paid
FROM events
WHERE event IN ('plugin_account_created', 'plugin_signin_succeeded', 'subscription_started', 'invoice_paid')
  AND timestamp >= now() - INTERVAL 90 DAY
GROUP BY week
ORDER BY week
```

Sign-in failure reasons:

```sql
SELECT properties.reason AS reason, count() AS attempts
FROM events
WHERE event = 'plugin_signin_failed'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY reason
ORDER BY attempts DESC
```

Compare "accounts created" with plugin downloads for the same weeks to see how many installs reach an account.
