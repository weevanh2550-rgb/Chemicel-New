# Security Specification — BoilerChem Pro (`security_spec.md`)

## 1. Data Invariants

1. **Default Deny & Verified Identity**: All unauthenticated requests and unverified email accounts (`request.auth.token.email_verified != true`) are denied write access across every collection.
2. **Path Variable Hardening**: Every single-document path variable (`adminId`, `settingId`, `chemicalId`, `calcId`) must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
3. **Strict Blueprint Validation (`isValid[Entity]`)**: Every `create` and `update` operation must validate all required keys (`hasAll`), strictly constrain allowed keys (`hasOnly`), enforce string lengths (`.size() <= max`), regex patterns, numeric bounds, and `request.time` temporal integrity.
4. **Immortal Ownership & Creation Timestamps**: `authorId` and `createdAt` can never be mutated during an `update`.
5. **Terminal State Locking**: Once a `CalculationLog` reaches `status == 'archived'`, non-admin users cannot perform any subsequent updates.
6. **Secure List Queries**: Every `allow list` rule enforces `resource.data.departmentScope == 'BOILER_DEPT'` (or `resource.data.authorId == request.auth.uid`) so client queries must filter by `departmentScope == 'BOILER_DEPT'`.
7. **PII Isolation**: `/admins/{adminId}` contains administrator email addresses and is strictly restricted to `isOwner(adminId) || isAdmin()` for `get` and `write` (no `list` allowed).

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection on Calculation (`isVerified: true`)**:
   ```json
   { "boilerId": "BOILER_1_2", "isVerified": true }
   ```
   *Rejected by*: `data.keys().hasOnly(...)` in `isValidCalculationLog`.
2. **Unverified Admin Email Spoof (`email_verified: false`)**:
   ```json
   { "auth": { "uid": "spoof1", "token": { "email": "boilerchemical49@gmail.com", "email_verified": false } } }
   ```
   *Rejected by*: `isVerifiedUser()` check inside `isAdmin()`.
3. **Identity Spoofing on Calculation Creation (`authorId != request.auth.uid`)**:
   ```json
   { "boilerId": "BOILER_1_2", "authorId": "other_user_uid" }
   ```
   *Rejected by*: `data.authorId == request.auth.uid` in `isValidCalculationLog`.
4. **Resource Poisoning via Oversized Note (`note.size() > 500`)**:
   ```json
   { "note": "A... (10,000 chars)" }
   ```
   *Rejected by*: `data.note.size() <= 500`.
5. **Zero or Negative Divisor Injection on Chemical (`divisor: 0`)**:
   ```json
   { "code": "TCE-2138", "divisor": 0 }
   ```
   *Rejected by*: `data.divisor > 0 && data.divisor <= 10000`.
6. **Client Timestamp Forgery (`createdAt != request.time`)**:
   ```json
   { "createdAt": "2020-01-01T00:00:00Z" }
   ```
   *Rejected by*: `incoming().createdAt == request.time`.
7. **Immortal Field Mutation (`createdAt` or `authorId` modified on update)**:
   ```json
   { "authorId": "hijacked_uid" }
   ```
   *Rejected by*: `incoming().authorId == existing().authorId && incoming().createdAt == existing().createdAt`.
8. **Terminal State Bypass (Updating Calculation after `status == 'archived'`)**:
   ```json
   { "status": "recorded", "note": "tampered after archive" }
   ```
   *Rejected by*: `existing().status != 'archived' || isAdmin()`.
9. **Unauthorized Admin Self-Promotion**:
   ```json
   { "collection": "/admins/attacker_uid", "uid": "attacker_uid", "email": "attacker@example.com" }
   ```
   *Rejected by*: `isAdmin()` gate on `/admins/{adminId}` write.
10. **PII Leak via `/admins` Read by Non-Admin**:
    ```json
    { "op": "get", "path": "/admins/some_admin_uid", "auth": { "uid": "regular_operator" } }
    ```
    *Rejected by*: `allow get: if isSignedIn() && isValidId(adminId) && (request.auth.uid == adminId || isAdmin());`.
11. **Unscoped List Query on `/calculations` without `departmentScope`**:
    ```json
    { "op": "list", "path": "/calculations" }
    ```
    *Rejected by*: `allow list: if isSignedIn() && existing().departmentScope == 'BOILER_DEPT';`.
12. **Path ID Poisoning (`calcId` with special characters / >128 chars)**:
    ```json
    { "path": "/calculations/invalid$id!@#%" }
    ```
    *Rejected by*: `isValidId(calcId)`.
