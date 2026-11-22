# Security Specification: PakFX Planner

## 1. Data Invariants
1. Every document in `investmentTargets/{targetId}` must belong to a verified authenticated user (`ownerId == request.auth.uid`) and have a valid document ID (`^[a-zA-Z0-9_-]+$`, max 128 chars).
2. `ownerId` and `createdAt` are immutable after document creation.
3. `createdAt` on create and `updatedAt` on create/update must equal server `request.time`.
4. All numeric investment parameters must stay within bounded safe ranges (`amountUsd` 10..50000, `holdingDays` 1..365, `exchangeRate` 50..2000, `spreadPkr` 0..25, `targetProfitPkr` 0..50000000).
5. `selectedScenario` must be one of `['stable_2026', 'flat_pegged', 'moderate_rise', 'historical_surge']`.
6. No unrequested shadow fields (`hasOnly` enforced on both `create` and `affectedKeys()` on `update`).
7. `list` queries are strictly filtered at the rule level (`resource.data.ownerId == request.auth.uid`).

## 2. Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `auth = null` attempting `get`, `list`, `create`, `update`, or `delete` on `investmentTargets/plan_1`.
2. **Unverified Email Write**: `auth = { uid: "u1", token: { email_verified: false } }` attempting `create` on `investmentTargets/plan_1`.
3. **Identity Spoofing on Create**: `auth = { uid: "u1", token: { email_verified: true } }` creating a doc with `ownerId: "u2"`.
4. **Cross-Tenant Read (`get`)**: `u2` attempting `get` on a document owned by `u1`.
5. **Unfiltered `list` Scraping**: `u2` executing a `list` query without `where("ownerId", "==", "u2")`.
6. **Shadow / Ghost Field Injection**: `u1` creating a doc with an extra field `{ isAdmin: true }` or updating `{ role: "admin" }`.
7. **Owner Reassignment on Update**: `u1` updating `ownerId` from `"u1"` to `"u2"`.
8. **Backdated `createdAt` Spoofing**: `u1` creating or modifying `createdAt` to a client-supplied timestamp instead of `request.time`.
9. **Path Variable Poisoning**: `u1` creating a doc at `investmentTargets/invalid$id..` or 200-character ID.
10. **Title Resource Exhaustion**: `u1` setting `title` to a 500-character string (> 120 maxLength) or empty string.
11. **Out-of-Bounds Financial Values**: `u1` setting `amountUsd: -500`, `holdingDays: 9999`, or `spreadPkr: -2`.
12. **Invalid Enum Injection**: `u1` setting `selectedScenario: "arbitrary_script"` instead of the 4 allowed regime keys.
