# Warehouse Management System — API Contract

**Version:** 1.0 (five-day MVP)  
**Owners:** Backend developer + Frontend developer  
**Base URL (local):** `http://localhost:5000/api`  
**Format:** JSON, except cookie-based sessions. All timestamps use ISO 8601 UTC; dates use `YYYY-MM-DD`. Money uses integer minor units (paise) to avoid floating-point errors. IDs are strings.

> **Important:** This contract is based on the ten story *topics* and eight NFRs discussed in our planning. The original story text and `schema.sql` were not available to verify here. Match field names, rent/FIFO rules and role permissions against your approved artifacts before freezing the contract. Avoid adding features not required by your stories.

## 1. Shared rules (agree before coding)

- Frontend uses Axios with `withCredentials: true`. Backend enables CORS for the exact frontend origin and sends secure, HTTP-only session cookies. Use a PostgreSQL-backed session store in deployment. Never put passwords or session tokens in API responses.
- Session expires after **10 minutes of inactivity**; authenticated requests may refresh the idle timer. On `401`, frontend redirects to login. Server checks permissions on **every** protected route; hiding buttons is not authorization.
- All request bodies are JSON. Required fields must be validated server-side. A list endpoint returns `{ "data": [...] }`; a detail/action endpoint returns `{ "data": {...} }`.
- Standard error: `{ "error": { "code": "VALIDATION_ERROR", "message": "Quantity must be positive" } }`. HTTP codes: `400` bad input, `401` unauthenticated, `403` forbidden, `404` missing, `409` conflicting stock/capacity/status, `500` unexpected failure.
- Optional pagination later: `?page=1&limit=20`; for the MVP, add it to large batch, payment and audit lists. Search/filter query parameters are optional.
- **Role abbreviations:** A = Admin, M = Manager, St = Staff, Su = Supplier, B = Buyer. The permission matrix below is a *proposed MVP mapping*; verify it against your approved stories.
- **No fake success:** Frontend may use temporary mocks while developing, but the final demo must call the real APIs.

### Example login response

`POST /auth/login`

Request:
```json
{"email":"manager@example.com","password":"example-password"}
```

Response `200` (server also sets a session cookie):
```json
{"data":{"id":"u_1","name":"Demo Manager","email":"manager@example.com","role":"MANAGER"}}
```

## 2. Endpoint checklist

| Story | Method | Endpoint | Purpose | Proposed access |
|---|---|---|---|---|
| US-01 | POST | `/auth/login` | Log in | Public |
| US-01 | GET | `/auth/me` | Current user / role | All signed-in |
| US-01 | POST | `/auth/logout` | End session | All signed-in |
| US-01 | GET | `/users` | List users | A |
| US-01 | POST | `/users` | Create user with role | A |
| US-02 | GET | `/batches` | List/search stock batches | A, M, St; scoped Su |
| US-02 | POST | `/batches` | Register incoming batch | A, M, St |
| US-03 | GET | `/chambers` | View capacity and occupancy | A, M, St |
| US-03 | POST | `/allocations` | Allocate batch to chamber | A, M |
| US-04 | GET | `/alerts` | List expiry alerts | A, M, St; scoped Su |
| US-05 | POST | `/dispatches` | Dispatch approved request using FIFO | A, M, St (as authorized) |
| US-05 | POST | `/dispatches/override` | Authorized FIFO override with reason | A, M |
| US-06 | GET | `/withdrawals` | View withdrawal requests | A, M, St; scoped B |
| US-06 | POST | `/withdrawals` | Request withdrawal | B, A, M |
| US-06 | PATCH | `/withdrawals/:id/status` | Approve/reject request | A, M |
| US-07 | POST | `/rent/calculate` | Calculate rent estimate | A, M |
| US-07 | GET | `/rent` | List rent charges | A, M; scoped Su if applicable |
| US-08 | GET | `/payments` | List payments | A, M; scoped payer if applicable |
| US-08 | POST | `/payments` | Record settlement | A, M |
| US-08 | PATCH | `/payments/:id` | Correct payment with audit log | A, M |
| US-09 | GET | `/tasks` | List tasks | A, M; own tasks St |
| US-09 | POST | `/tasks` | Assign staff task | A, M |
| US-09 | PATCH | `/tasks/:id` | Update task status | A, M; assigned St |
| US-10 | GET | `/reports/overview` | Occupancy, batches, alerts, revenue | A, M |
| US-10 | GET | `/reports/revenue` | Revenue chart data | A, M |
| NFR-3 | GET | `/audit-logs` | Review payment/FIFO changes | A (M if approved) |

**Note:** Supplier and Buyer ownership scoping must be enforced by the backend based on the logged-in user, not by trusting a client-supplied user ID.

## 3. Core JSON shapes

Use these field names consistently in the React forms, Express validation and Prisma mappings. They are API names, not a demand to rename existing SQL columns.

### Batch / stock intake — US-02

`POST /batches`
```json
{"productName":"Apples","supplierId":"u_4","quantity":100,"unit":"kg","receivedAt":"2026-09-25","expiryDate":"2026-10-10"}
```
Response:
```json
{"data":{"id":"batch_1","productName":"Apples","supplierId":"u_4","quantity":100,"remainingQuantity":100,"unit":"kg","receivedAt":"2026-09-25","expiryDate":"2026-10-10","status":"RECEIVED","chamberId":null}}
```
`GET /batches?search=apple&status=RECEIVED` returns `{ "data": [<batch objects>] }`. The backend determines which suppliers' batches the caller can see.

### Chambers and allocation — US-03

`GET /chambers`:
```json
{"data":[{"id":"ch_1","name":"Chamber A","capacity":1000,"occupied":450,"unit":"kg"}]}
```
`POST /allocations`:
```json
{"batchId":"batch_1","chamberId":"ch_1","quantity":100}
```
Response: `{ "data": { "id": "allocation_1", "batchId": "batch_1", "chamberId": "ch_1", "quantity": 100 } }`.

**MVP simplification:** One batch belongs to one chamber. If your ER diagram requires splitting a batch across chambers, use allocation rows instead of a single `batch.chamberId` and update the frontend contract together. Validate compatible units and free capacity.

### Withdrawal and FIFO dispatch — US-05/06

`POST /withdrawals`:
```json
{"productName":"Apples","quantity":20,"unit":"kg","notes":"Customer order"}
```
Response:
```json
{"data":{"id":"wr_1","buyerId":"u_5","productName":"Apples","quantity":20,"unit":"kg","status":"PENDING"}}
```
`PATCH /withdrawals/wr_1/status`:
```json
{"status":"APPROVED"}
```
Allowed statuses: `PENDING`, `APPROVED`, `REJECTED`, `DISPATCHED`. A rejected request cannot be dispatched.

`POST /dispatches`:
```json
{"withdrawalId":"wr_1"}
```
Response:
```json
{"data":{"id":"dispatch_1","withdrawalId":"wr_1","quantity":20,"batchAllocations":[{"batchId":"batch_1","quantity":20}],"status":"COMPLETED"}}
```
The server selects eligible stock in FIFO order according to the approved business rule; the client does **not** choose batches. Prevent over-dispatch and double dispatch using a database transaction.

`POST /dispatches/override`:
```json
{"withdrawalId":"wr_1","batchId":"batch_2","reason":"Approved operational exception"}
```
The server validates permission, availability and the required justification, then writes an audit record in the **same transaction** as dispatch. If an override may use multiple batches, expand the request after checking the story.

### Expiry alerts — US-04

`GET /alerts`:
```json
{"data":[{"id":"alert_1","batchId":"batch_1","type":"NEAR_EXPIRY","message":"Batch batch_1 is near expiry","createdAt":"2026-09-25T09:00:00Z","deliveryStatus":"SENT"}]}
```
A background job checks expiry at least once per minute, creates deduplicated pending alert records and sends email. Persist send attempts, retry failures and measure delivery time. There is no manual alert-creation endpoint in the MVP.

### Rent and payments — US-07/08

`POST /rent/calculate`:
```json
{"supplierId":"u_4","startDate":"2026-09-01","endDate":"2026-09-30"}
```
Response:
```json
{"data":{"supplierId":"u_4","periodStart":"2026-09-01","periodEnd":"2026-09-30","amountPaise":150000,"currency":"INR"}}
```
**Calculation formula:** Use the one in your approved user story; do not invent a rate or billing basis. `GET /rent` returns stored charges with `id`, `supplierId`, `periodStart`, `periodEnd`, `amountPaise`, `status`.

`POST /payments`:
```json
{"rentId":"rent_1","amountPaise":150000,"method":"BANK_TRANSFER","reference":"TXN-123"}
```
Response:
```json
{"data":{"id":"pay_1","rentId":"rent_1","amountPaise":150000,"status":"RECORDED","paidAt":"2026-09-25T10:00:00Z"}}
```
`PATCH /payments/pay_1`:
```json
{"amountPaise":140000,"reason":"Corrected entry"}
```
Every payment change writes the old value, new value, actor, timestamp and request IP to an audit log in the same transaction. Never return a full bank account number; if shown, return `maskedAccountNumber` such as `****1234`. **MVP records payments; it does not process real online payments.**

### Staff tasks — US-09

`POST /tasks`:
```json
{"title":"Inspect Chamber A","assignedTo":"u_3","dueDate":"2026-09-27","description":"Check stored batches"}
```
Response:
```json
{"data":{"id":"task_1","title":"Inspect Chamber A","assignedTo":"u_3","dueDate":"2026-09-27","status":"PENDING"}}
```
`PATCH /tasks/task_1`: `{ "status": "COMPLETED" }`. Other allowed status: `IN_PROGRESS`.

### Dashboard — US-10

`GET /reports/overview`:
```json
{"data":{"totalBatches":248,"nearExpiryBatches":12,"occupancyPercent":76,"revenuePaise":48000000,"currency":"INR"}}
```
`GET /reports/revenue?months=6`:
```json
{"data":[{"month":"2026-09","revenuePaise":48000000}]}
```
Values above are **examples**, not real or hard-coded production data. Compute them from the database. The frontend can display `revenuePaise / 100` as rupees.

## 4. NFR responsibilities

| NFR | Backend responsibility | Frontend responsibility |
|---|---|---|
| NFR-1 Response time | Index frequent queries, paginate lists, measure endpoint latency against the specified 1s/5s targets | Show loading states; avoid repeated unnecessary requests |
| NFR-2 Session security | Server-side 10-minute idle expiry, secure cookie, CSRF protection for state-changing requests | Redirect on 401; logout action; never store secrets in localStorage |
| NFR-3 Audit logging | Transactional payment and FIFO-override logs with old/new values, user, IP and timestamp | Require override/edit reasons; Admin audit page |
| NFR-4 Data masking | Mask sensitive account numbers before returning JSON; restrict financial APIs | Display only masked values; never attempt client-only masking |
| NFR-5 Alert delivery | Minute-level job, durable pending alerts, deduplication, retries; verify two-minute delivery | Display alert status and failures |
| NFR-6 Uptime | Health endpoint, deployment monitoring and suitable hosting | Friendly unavailable/error screen |
| NFR-7 Scalability | Test 100 concurrent users; index queries and pool connections | Paginate/filter large lists |
| NFR-8 Backup | Managed daily database backups, 30-day retention and a tested restore | No special frontend work |

**Operational caveat:** A five-day MVP can implement and test many of these controls, but uptime, provider email delivery and backup retention depend on your hosting plan. Report measured results instead of claiming unverified compliance.

## 5. Integration sequence

1. **Day 1:** Agree on this contract; implement `/auth/login`, `/auth/me`, `/auth/logout` and `/chambers`. Frontend connects login and uses mock JSON for unfinished endpoints.
2. **Day 2:** Implement and integrate `/batches`, `/allocations`, `/withdrawals` and `/dispatches`.
3. **Day 3:** Implement and integrate `/rent`, `/payments` and `/tasks`; test audit logging.
4. **Day 4:** Implement `/alerts` and `/reports/*`; replace all frontend mocks with live APIs.
5. **Day 5:** Test all ten stories and eight NFRs, fix integration bugs and deploy.

**Change rule:** If either developer changes an endpoint, field or enum, update this file in the same pull request and tell the other developer. Do not silently rename fields.
