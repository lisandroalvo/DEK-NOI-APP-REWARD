<!-- ABOUTME: Partner-facing contract for POST /api/reward-redemptions, the rewards-app -->
<!-- ABOUTME: redemption endpoint: request/response bodies, error codes, and retry rules. -->

# POST /api/reward-redemptions

Server-to-server endpoint used by the rewards app to redeem one physical item
from the Dek Noi 24 shelf. One call = one unit. The endpoint validates the
scanned barcode against the reward's value ceiling and current shelf stock,
then deducts 1 from the POS shelf quantity.

## Auth

```
Authorization: Bearer <REWARDS_API_KEY>
Content-Type: application/json
```

A missing or wrong token returns `401 { "ok": false, "code": "UNAUTHORIZED" }`.

## Request body

| Field | Type | Required | Notes |
|---|---|---|---|
| `idempotencyKey` | string | yes | Non-empty after trim, max 128 chars, letters/digits/underscore/dash only (`[A-Za-z0-9_-]+`). Uniquely identifies this redemption attempt. |
| `barcode` | string | yes | Non-empty after trim, max 64 chars. The scanned item barcode. |
| `maxValue` | number | yes | > 0. The reward's value ceiling in THB. |
| `reward.id` | string | no | Audit only. |
| `reward.name` | string | no | Audit only. |
| `customer.id` | string | no | Audit only. |
| `customer.name` | string | no | Audit only. |
| `requestedAt` | string | no | ISO 8601. Audit only; an unparseable value is stored as null rather than failing the redemption. |

```json
{
  "idempotencyKey": "rdm_8f3c1a",
  "barcode": "8850999320005",
  "maxValue": 20,
  "reward": { "id": "rwd_softdrink", "name": "Soft Drink" },
  "customer": { "id": "usr_abc", "name": "Somchai P." },
  "requestedAt": "2026-07-28T09:15:00Z"
}
```

## Success — 200

```json
{
  "ok": true,
  "replayed": false,
  "product": {
    "barcode": "8850999320005",
    "name": "Coca-Cola 325ml",
    "price": 15,
    "category": "Beverages",
    "remainingQty": 41
  }
}
```

`replayed` is `true` when this response is a stored replay of an earlier call
with the same `idempotencyKey` — the item was already redeemed; nothing was
deducted a second time.

## Errors

Every error body is `{ "ok": false, "code": "...", "message": "..." }`. Business
rejections (`OUT_OF_STOCK`, `EXCEEDS_MAX_VALUE`) also carry the same `product`
object as the success body.

| Status | Code | Meaning | Retryable |
|---|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON, or a missing/invalid/oversized field. | No — fix the request. |
| 401 | `UNAUTHORIZED` | Missing or wrong bearer token. | No. |
| 404 | `PRODUCT_NOT_FOUND` | No active product for that barcode, the product is not linked to the POS, or it has no configured price. | No. |
| 409 | `OUT_OF_STOCK` | Shelf quantity is 0. | No — nothing to give out. |
| 409 | `IN_PROGRESS` | Another request with this `idempotencyKey` is still being processed. | Yes — see below. |
| 422 | `EXCEEDS_MAX_VALUE` | Item price is above `maxValue`. | No. |
| 502 | `UPSTREAM_ERROR` | The POS inventory system was unreachable. Nothing was deducted. | Yes. |
| 500 | `INTERNAL_ERROR` | Unexpected server fault. | Yes. |

Error messages are human-readable but not a stable contract — branch on `code`.

## Retry rules

- Keys must match `[A-Za-z0-9_-]+` (max 128 chars) — anything else is a
  `400 BAD_REQUEST`. A UUID, a ULID, or your own `rdm_<id>` scheme all qualify.
- **Always retry with the SAME `idempotencyKey`.** Never mint a fresh key for
  the same redemption: a fresh key is a new redemption and can deduct a second
  unit and hand out a second item.
- `UPSTREAM_ERROR` and `INTERNAL_ERROR` are safe to retry immediately with the
  same key — the flow re-runs from the start and cannot double-book the
  giveaway (the audit event is reused, and the POS deduction is skipped if a
  prior attempt already made it).
- `IN_PROGRESS` means a request with this key is mid-flight. Back off a few
  seconds and retry the same key; once the first request finishes you get its
  actual result (or a replay of it).
- A redemption stuck in `pending` for more than **5 minutes** (its server
  invocation died mid-flight) becomes retryable automatically: the next call
  with that key reclaims the row and re-runs the flow instead of returning
  `IN_PROGRESS` forever.
- Non-retryable codes replay verbatim: repeating a call after a
  `PRODUCT_NOT_FOUND` / `OUT_OF_STOCK` / `EXCEEDS_MAX_VALUE` returns the same
  stored rejection.
