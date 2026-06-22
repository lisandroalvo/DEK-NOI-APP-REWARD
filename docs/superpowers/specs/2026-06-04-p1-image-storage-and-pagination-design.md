# P1 Design — Image Storage Migration + List Pagination

**Date:** 2026-06-04
**Status:** Approved — building Part A; Part B deferred.
**Scope:** P1 item #7 (base64-in-Firestore → Firebase Storage). Item #8 (pagination) is **deferred**: the live app is small (<100 customers, <500 bills), so unbounded loads are not yet a problem. Part B below is retained as the design for when scale warrants it.

## Problem

1. **Images are stored as base64 strings inside Firestore documents.** Customer receipts (`billSubmissions.imageData`) and admin reward/promo/profile images (`imageUrl` written by `ImageUploadSimple`) all embed base64. Firestore's hard limit is **1 MB per document**; a detailed receipt photo can exceed that even after compression, causing silent write failures for exactly the highest-value bills. Reading these documents also transfers the full image payload.
2. **No pagination.** `BillReview` and `Profile` use unbounded `onSnapshot` over all matching bills (each carrying a base64 image); `Redemptions` counts by reading every doc; `Customers` loads all users. Query cost and memory grow without bound.

## Goals

- Store images in Firebase Storage; keep only the download URL in Firestore.
- Backward compatible: existing base64 data keeps rendering with **no data migration**.
- Bounded query cost on the admin lists and the customer bill history.
- Test-driven where the logic is testable against the Firebase emulator.

## Non-Goals (this pass)

- Server-side / substring customer search (Firestore can't do it; needs Algolia/Typesense later).
- Migrating existing base64 documents (they still render via the `imageData || imageUrl` fallback).
- P2 cleanup unrelated to these two items (console.logs, route code-splitting, the 17 pre-existing lint errors).

## Part A — Image Storage Migration

### A1. New module `src/lib/storage.js`

Split so the non-browser logic is unit-testable (canvas/`Image`/`FileReader` only exist in the browser, not in the emulator/node test env):

- `validateImageFile(file)` — pure. Throws `INVALID_TYPE` for non-images, `FILE_TOO_LARGE` above the max (10 MB). Returns nothing on success.
- `compressImageToBlob(file, { maxDim = 1920, quality = 0.8 })` — **browser-only** canvas glue. Returns a JPEG `Blob`. Thin; verified by running the app, not unit-tested.
- `uploadImageBlob(storage, blob, prefix, contentType = 'image/jpeg')` — uploads to `${prefix}/${timestamp}-${rand}.jpg`, returns the download URL. **Testable against the Storage emulator** (node can produce a `Blob`/`Uint8Array`).
- `uploadImageFile(storage, file, prefix)` — orchestrator: `validateImageFile` → `compressImageToBlob` → `uploadImageBlob`. Browser entry point.

Storage path prefixes: bills `bills/{uid}`, rewards `rewards`, promos `promos`, avatars `avatars/{uid}`.

### A2. Consolidate uploader → single `src/components/ImageUpload.jsx`

One Storage-based uploader keeping the existing interface `{ value, onChange, label }`, so callers change only their import. It calls `uploadImageFile(...)` then `onChange(downloadURL)`, shows upload progress + errors.

**Delete dead components:** `ImageUploadSimple.jsx` (replaced), the old `ImageUpload.jsx` (Storage uploader, currently dead — its logic is folded into the new one), `ImageUploadCloudinary.jsx`, `StorageStatus.jsx`.

**Update import sites** (`value`/`onChange` props unchanged): `src/pages/admin/Rewards.jsx`, `src/pages/admin/Promos.jsx`, `src/pages/customer/Profile.jsx`.

### A3. `ScanBill.jsx`

Replace the base64 flow: `uploadImageFile(storage, file, ` + "`bills/${user.uid}`" + `)`, then save `imageUrl` (download URL) on the `billSubmissions` doc instead of `imageData`. All other fields unchanged. Preserve existing error handling (size, permission-denied) and the preview UX.

### A4. Read sites — no change required

`BillReview` (×2), `Profile` (×2) already render `bill.imageData || bill.imageUrl`. New bills set `imageUrl`; old bills keep `imageData`. Reward/promo/avatar reads already use the URL field directly. Data-URL and https `<img src>` both render.

### A5. Storage rules

P0 already set `allow read, write: if request.auth != null`. Add a write guard: `request.resource.size < 10 * 1024 * 1024 && request.resource.contentType.matches('image/.*')`. Reads stay auth-only (admin must read every user's bill). Covered by an emulator test.

## Part B — Pagination (DEFERRED — design retained for future scale)

> Not being built now. The app is small enough that loading full lists is fine. Revisit when bills/customers reach the thousands.

Page size 20 for queues/history, 50 for customers. "Load more" pages **older** items via a `startAfter(cursor)` cursor on the last-loaded doc. Tab/stat badges use `getCountFromServer` (one aggregated read instead of reading every doc).

### B1. `BillReview.jsx`
- **Pending tab stays live:** `onSnapshot(query(..., where status==pending, orderBy submittedAt desc, limit(20)))` — new submissions appear at the top automatically.
- **Load more** (pending): `getDocs` with `startAfter(oldest loaded pending doc)`, appended to an "older" list below the live window.
- **Approved / Rejected / All tabs:** paginated `getDocs` with `limit(20)` + Load more (not live).
- **Stat badges** (pending/approved/rejected/total): `getCountFromServer` per status.

### B2. `Redemptions.jsx`
- Keep the tab model. Add `limit(20)` + Load more (`startAfter`) to the per-status `getDocs`.
- Replace the three "read all to `.size`" count queries with `getCountFromServer`.

### B3. `Customers.jsx`
- `getDocs(where role==customer, limit(50))` + Load more.
- **Known limitation:** the search box filters only loaded pages (no Firestore substring search). Documented as a future search-index item; total-member count via `getCountFromServer`.

### B4. `Profile.jsx` bill history
- `onSnapshot(query(..., where userId==me, orderBy submittedAt desc, limit(20)))` — stays live (only the user's own bills). Add Load more for older via `startAfter`.

## Testing (TDD, emulator)

New `test/storage.test.js`:
- `validateImageFile` rejects a non-image (`INVALID_TYPE`).
- `validateImageFile` rejects an oversized file (`FILE_TOO_LARGE`).
- `validateImageFile` accepts a valid small image.
- `uploadImageBlob` stores the object under the given prefix and returns an `https` download URL (Storage emulator).
- Storage rules reject an unauthenticated write (already covered) **and** a non-image / oversized write.

The existing 11 tests (`firestore.rules`, `points`) must stay green. Pagination/component wiring is verified by running the app (React component behavior is out of scope for unit tests here); the extracted `storage.js` logic carries the TDD coverage.

## Risks / Trade-offs

- **Lost real-time on approved/rejected/customer lists** — acceptable; those aren't active work surfaces. Pending queues remain live.
- **Customer search limited to loaded pages** — explicitly deferred to a future search index.
- **`compressImageToBlob` is not unit-tested** — browser-only; verified by running the app. Kept deliberately thin.
- **Storage read is auth-only, not owner-scoped** — any signed-in user could read another user's receipt URL if they knew it. Admin review requires broad read; tightening to per-owner paths + admin override is a possible later hardening, noted not built.
