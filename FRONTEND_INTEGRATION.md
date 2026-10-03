# Cold Storage Warehouse Management System — Frontend Integration Guide

Welcome to the backend integration guide! The backend server is fully operational, connected to PostgreSQL, and ready to serve your React frontend across all 10 stories and 8 NFRs.

---

## 1. Quick Connection Specs

| Item | Value |
|---|---|
| **Base URL (local)** | `http://localhost:5000/api` |
| **Frontend Origin** | `http://localhost:5173` |
| **Authentication Strategy** | HTTP-only session cookies (`connect.sid`) |
| **Session Lifetime** | 10 minutes of inactivity (rolling refresh on active requests, NFR-2) |
| **Format** | `application/json` (Money in integer paise: 1 INR = 100 paise) |
| **Interactive Docs** | `http://localhost:5000/docs` |
| **Health Check** | `http://localhost:5000/api/health` |

---

## 2. Axios Client Setup in React

Because authentication is session cookie-based, you **MUST** configure Axios with `withCredentials: true`.

```javascript
// src/api/client.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true, // CRITICAL: sends and receives HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
```

---

## 3. Standard JSON & Error Envelopes

- Single record or action: `{ "data": { ... } }`
- List of records: `{ "data": [ ... ], "meta": { "total": 24, "page": 1, "limit": 50, "totalPages": 1 } }`
- Standard error format:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Detailed description of what went wrong"
    }
  }
  ```

---

## 4. Complete Endpoints Reference (All 10 Stories & NFRs)

### ── US-01: Authentication & User Management ──

#### 1) Health Check (NFR-6)
- **Method:** `GET`
- **Path:** `/health`
- **Access:** Public
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-28T00:00:00.000Z",
    "uptime": 12.4
  }
  ```

#### 2) User Login (US-01)
- **Method:** `POST`
- **Path:** `/auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "manager@example.com",
    "password": "password123"
  }
  ```
- **Response `200 OK` (sets `connect.sid` cookie):**
  ```json
  {
    "data": {
      "id": "u_manager_1",
      "name": "Demo Manager",
      "email": "manager@example.com",
      "role": "MANAGER"
    }
  }
  ```
- **Errors:** `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`

#### 3) Current User Session Check (US-01)
- **Method:** `GET`
- **Path:** `/auth/me`
- **Access:** All signed-in users
- **Response `200 OK`:**
  ```json
  {
    "data": {
      "id": "u_manager_1",
      "name": "Demo Manager",
      "email": "manager@example.com",
      "role": "MANAGER"
    }
  }
  ```
- **Error:** `401 UNAUTHENTICATED` (Redirect to login)

#### 4) Logout (US-01)
- **Method:** `POST`
- **Path:** `/auth/logout`
- **Access:** All signed-in users
- **Response `200 OK` (destroys session and clears cookie):**
  ```json
  {
    "data": {
      "message": "Logged out successfully"
    }
  }
  ```

#### 5) List Users (US-01)
- **Method:** `GET`
- **Path:** `/users`
- **Access:** `ADMIN`
- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "id": "u_admin_1",
        "name": "Super Admin",
        "email": "admin@example.com",
        "role": "ADMIN",
        "createdAt": "2026-09-25T10:00:00.000Z"
      }
    ]
  }
  ```

#### 6) Create User with Role (US-01)
- **Method:** `POST`
- **Path:** `/users`
- **Access:** `ADMIN`
- **Request Body:**
  ```json
  {
    "name": "New Operator",
    "email": "operator2@example.com",
    "password": "password123",
    "role": "STAFF"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "data": {
      "id": "u_1b2c3d...",
      "name": "New Operator",
      "email": "operator2@example.com",
      "role": "STAFF"
    }
  }
  ```

---

### ── US-02: Stock Intake & Inventory ──

#### 7) Register Incoming Stock Batch (US-02)
- **Method:** `POST`
- **Path:** `/batches`
- **Access:** `ADMIN`, `MANAGER`, `STAFF`
- **Request Body:**
  ```json
  {
    "productName": "Shimla Apples",
    "supplierId": "u_supplier_1",
    "quantity": 100,
    "unit": "kg",
    "receivedAt": "2026-09-25",
    "expiryDate": "2026-10-25"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "data": {
      "id": "batch_uuid_1",
      "productName": "Shimla Apples",
      "supplierId": "u_supplier_1",
      "quantity": 100,
      "remainingQuantity": 100,
      "unit": "kg",
      "receivedAt": "2026-09-25",
      "expiryDate": "2026-10-25",
      "status": "RECEIVED",
      "chamberId": null
    }
  }
  ```

#### 8) List / Search Stock Inventory (US-02)
- **Method:** `GET`
- **Path:** `/batches`
- **Access:** `ADMIN`, `MANAGER`, `STAFF`; scoped `SUPPLIER` (Suppliers automatically see only their own batches)
- **Query Parameters (all optional):**
  - `search`: string (case-insensitive product search, e.g. `?search=apple`)
  - `status`: string (`RECEIVED`, `ALLOCATED`, `PARTIALLY_DISPATCHED`, `DISPATCHED`)
  - `page`: integer (default: `1`)
  - `limit`: integer (default: `50`)
- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "id": "batch_uuid_1",
        "productName": "Shimla Apples",
        "supplierId": "u_supplier_1",
        "quantity": 100,
        "remainingQuantity": 100,
        "unit": "kg",
        "receivedAt": "2026-09-25",
        "expiryDate": "2026-10-25",
        "status": "ALLOCATED",
        "chamberId": "ch_4"
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 50,
      "totalPages": 1
    }
  }
  ```

#### 9) Get Batch Details (US-02)
- **Method:** `GET`
- **Path:** `/batches/:id`
- **Access:** `ADMIN`, `MANAGER`, `STAFF`; scoped `SUPPLIER`

---

### ── US-03: Chambers & Allocation ──

#### 10) View Chambers (US-03)
- **Method:** `GET`
- **Path:** `/chambers`
- **Access:** `ADMIN`, `MANAGER`, `STAFF`
- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "id": "ch_1",
        "name": "Chamber A (Apples Cold Storage)",
        "capacity": 1000,
        "occupied": 450,
        "unit": "kg"
      },
      {
        "id": "ch_4",
        "name": "Chamber D (Vegetables Humidity-Controlled)",
        "capacity": 800,
        "occupied": 0,
        "unit": "kg"
      }
    ]
  }
  ```

#### 11) Allocate Batch to Chamber (US-03)
- **Method:** `POST`
- **Path:** `/allocations`
- **Access:** `ADMIN`, `MANAGER`
- **Request Body:**
  ```json
  {
    "batchId": "batch_uuid_1",
    "chamberId": "ch_4",
    "quantity": 100
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "data": {
      "id": "alloc_uuid_1",
      "batchId": "batch_uuid_1",
      "chamberId": "ch_4",
      "quantity": 100
    }
  }
  ```
- **Concurrency & Transaction Protection:** Row-level locks (`FOR UPDATE`) protect against concurrent over-allocation. Returns `409 CAPACITY_EXCEEDED` on capacity overrun.

---

### ── US-04: Expiry Alerts (NFR-5) ──

#### 12) List Expiry Alerts (US-04)
- **Method:** `GET`
- **Path:** `/alerts`
- **Access:** `ADMIN`, `MANAGER`, `STAFF`; scoped `SUPPLIER`
- **Query Parameters:** `type` (`NEAR_EXPIRY`, `EXPIRED`), `deliveryStatus` (`SENT`, `PENDING`, `FAILED`), `page`, `limit`
- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "id": "alert_1",
        "batchId": "batch_uuid_1",
        "type": "NEAR_EXPIRY",
        "message": "Batch batch_uuid_1 (Shimla Apples) is near expiry on 2026-10-01",
        "deliveryStatus": "SENT",
        "attempts": 1,
        "lastAttemptAt": "2026-09-28T00:05:00.000Z",
        "createdAt": "2026-09-28T00:05:00.000Z"
      }
    ]
  }
  ```

---

### ── US-05 & US-06: Withdrawals, Strict FIFO Dispatch & Override ──

#### 13) Request Withdrawal (US-06)
- **Method:** `POST`
- **Path:** `/withdrawals`
- **Access:** `BUYER`, `ADMIN`, `MANAGER`
- **Request Body:**
  ```json
  {
    "productName": "Shimla Apples",
    "quantity": 20,
    "unit": "kg",
    "notes": "Store replenishment order #849"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "data": {
      "id": "wr_uuid_1",
      "buyerId": "u_buyer_1",
      "productName": "Shimla Apples",
      "quantity": 20,
      "unit": "kg",
      "status": "PENDING"
    }
  }
  ```

#### 14) View Withdrawal Requests (US-06)
- **Method:** `GET`
- **Path:** `/withdrawals`
- **Access:** `ADMIN`, `MANAGER`, `STAFF`; scoped `BUYER`
- **Query Parameters:** `status` (`PENDING`, `APPROVED`, `REJECTED`, `DISPATCHED`), `page`, `limit`

#### 15) Approve or Reject Request (US-06)
- **Method:** `PATCH`
- **Path:** `/withdrawals/:id/status`
- **Access:** `ADMIN`, `MANAGER`
- **Request Body:**
  ```json
  {
    "status": "APPROVED"
  }
  ```
  *(Allowed values: `APPROVED`, `REJECTED`)*

#### 16) Dispatch Approved Request via FIFO (US-05)
- **Method:** `POST`
- **Path:** `/dispatches`
- **Access:** `ADMIN`, `MANAGER`, `STAFF`
- **Request Body:**
  ```json
  {
    "withdrawalId": "wr_uuid_1"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "data": {
      "id": "dispatch_uuid_1",
      "withdrawalId": "wr_uuid_1",
      "quantity": 20,
      "batchAllocations": [
        {
          "batchId": "batch_uuid_older",
          "quantity": 15
        },
        {
          "batchId": "batch_uuid_newer",
          "quantity": 5
        }
      ],
      "status": "COMPLETED"
    }
  }
  ```

#### 17) Authorized FIFO Override with Reason (US-05 / NFR-3)
- **Method:** `POST`
- **Path:** `/dispatches/override`
- **Access:** `ADMIN`, `MANAGER`
- **Request Body:**
  ```json
  {
    "withdrawalId": "wr_uuid_1",
    "batchId": "batch_uuid_specific",
    "reason": "Customer requested premium lot from specific cold chamber"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "data": {
      "id": "dispatch_uuid_override_1",
      "withdrawalId": "wr_uuid_1",
      "quantity": 20,
      "batchAllocations": [
        {
          "batchId": "batch_uuid_specific",
          "quantity": 20
        }
      ],
      "status": "COMPLETED"
    }
  }
  ```

---

### ── US-07 & US-08: Rent, Payments, Masking & Auditing ──

#### 18) Calculate Rent Estimate (US-07)
- **Method:** `POST`
- **Path:** `/rent/calculate`
- **Access:** `ADMIN`, `MANAGER`
- **Request Body:**
  ```json
  {
    "supplierId": "u_supplier_1",
    "startDate": "2026-09-01",
    "endDate": "2026-09-30"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "data": {
      "id": "rent_uuid_1",
      "supplierId": "u_supplier_1",
      "periodStart": "2026-09-01",
      "periodEnd": "2026-09-30",
      "amountPaise": 150000,
      "currency": "INR",
      "status": "PENDING"
    }
  }
  ```
  *(Display note: frontend displays `amountPaise / 100` as rupees, e.g. Rs 1,500.00)*

#### 19) List Rent Charges (US-07)
- **Method:** `GET`
- **Path:** `/rent`
- **Access:** `ADMIN`, `MANAGER`; scoped `SUPPLIER`

#### 20) Record Settlement Payment (US-08)
- **Method:** `POST`
- **Path:** `/payments`
- **Access:** `ADMIN`, `MANAGER`
- **Request Body:**
  ```json
  {
    "rentId": "rent_uuid_1",
    "amountPaise": 150000,
    "method": "BANK_TRANSFER",
    "reference": "TXN-8849",
    "accountNumber": "987654321012"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "data": {
      "id": "pay_uuid_1",
      "rentId": "rent_uuid_1",
      "amountPaise": 150000,
      "method": "BANK_TRANSFER",
      "reference": "TXN-8849",
      "maskedAccountNumber": "****1012",
      "status": "RECORDED",
      "paidAt": "2026-09-28T00:05:00.000Z"
    }
  }
  ```
  *(NFR-4: Bank account numbers are strictly masked server-side to the last 4 digits)*

#### 21) List Payments (US-08)
- **Method:** `GET`
- **Path:** `/payments`
- **Access:** `ADMIN`, `MANAGER`; scoped `SUPPLIER`

#### 22) Correct Payment with Audit Log (US-08 / NFR-3)
- **Method:** `PATCH`
- **Path:** `/payments/:id`
- **Access:** `ADMIN`, `MANAGER`
- **Request Body:**
  ```json
  {
    "amountPaise": 140000,
    "reason": "Corrected TDS deduction"
  }
  ```

---

### ── US-09: Staff Tasks ──

#### 23) List Tasks (US-09)
- **Method:** `GET`
- **Path:** `/tasks`
- **Access:** `ADMIN`, `MANAGER`; assigned `STAFF` (Staff can only view tasks assigned to them)
- **Query Parameters:** `status` (`PENDING`, `IN_PROGRESS`, `COMPLETED`), `assignedTo`, `page`, `limit`

#### 24) Assign Staff Task (US-09)
- **Method:** `POST`
- **Path:** `/tasks`
- **Access:** `ADMIN`, `MANAGER`
- **Request Body:**
  ```json
  {
    "title": "Inspect Chamber A humidity",
    "description": "Verify hygrometer reading is within 85-90%",
    "assignedTo": "u_staff_1",
    "dueDate": "2026-09-30"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "data": {
      "id": "task_uuid_1",
      "title": "Inspect Chamber A humidity",
      "description": "Verify hygrometer reading is within 85-90%",
      "assignedTo": "u_staff_1",
      "dueDate": "2026-09-30",
      "status": "PENDING"
    }
  }
  ```

#### 25) Update Task Status (US-09)
- **Method:** `PATCH`
- **Path:** `/tasks/:id`
- **Access:** `ADMIN`, `MANAGER`; assigned `STAFF`
- **Request Body:**
  ```json
  {
    "status": "COMPLETED"
  }
  ```
  *(Allowed values: `PENDING`, `IN_PROGRESS`, `COMPLETED`)*

---

### ── US-10: Dashboard Analytics & Reports ──

#### 26) Overview Report (US-10)
- **Method:** `GET`
- **Path:** `/reports/overview`
- **Access:** `ADMIN`, `MANAGER`
- **Response `200 OK`:**
  ```json
  {
    "data": {
      "totalBatches": 248,
      "nearExpiryBatches": 12,
      "occupancyPercent": 76,
      "revenuePaise": 48000000,
      "currency": "INR"
    }
  }
  ```

#### 27) Revenue Trend Chart (US-10 / Recharts Compatible)
- **Method:** `GET`
- **Path:** `/reports/revenue?months=6`
- **Access:** `ADMIN`, `MANAGER`
- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "month": "2026-09",
        "revenuePaise": 48000000
      }
    ]
  }
  ```

#### 28) Operations Summary (US-10)
- **Method:** `GET`
- **Path:** `/reports/operations`
- **Access:** `ADMIN`, `MANAGER`
- **Response `200 OK`:** Returns per-chamber occupancy percentage, batch counts by status, and withdrawal fulfillment status.

---

### ── NFR-3: Audit Logs ──

#### 29) Review Audit Logs (NFR-3)
- **Method:** `GET`
- **Path:** `/audit-logs`
- **Access:** `ADMIN`, `MANAGER`
- **Query Parameters:** `action` (`FIFO_OVERRIDE`, `PAYMENT_CORRECTION`), `entityId`, `page`, `limit`
- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "id": "audit_1",
        "action": "PAYMENT_CORRECTION",
        "entityId": "pay_uuid_1",
        "oldValue": { "amountPaise": 150000, "status": "RECORDED" },
        "newValue": { "amountPaise": 140000, "status": "ADJUSTED" },
        "reason": "Corrected TDS deduction",
        "userId": "u_manager_1",
        "actorName": "Demo Manager",
        "actorEmail": "manager@example.com",
        "ipAddress": "127.0.0.1",
        "createdAt": "2026-09-28T00:06:00.000Z"
      }
    ],
    "meta": { "total": 1, "page": 1, "limit": 50, "totalPages": 1 }
  }
  ```

---

## 5. Development Pre-Seeded Accounts

All accounts share the development password: **`password123`**

| Role | Email | Access Profile |
|---|---|---|
| **ADMIN** | `admin@example.com` | Full administrative access: users, FIFO overrides, payment corrections, audit logs |
| **MANAGER** | `manager@example.com` | Operations manager: chambers, stock intake, allocations, approvals, rent, payments, tasks, reports |
| **STAFF** | `staff@example.com` | Warehouse operator: stock intake, chambers, FIFO dispatches, own tasks |
| **SUPPLIER** | `supplier@example.com` | Scoped supplier: views only own batches, rent charges, and alert notifications |
| **BUYER** | `buyer@example.com` | Scoped buyer: submits withdrawal requests, views own order statuses |

---

## 6. How to Run & Test

```bash
# Apply migrations & seed database
npm run migrate
npm run seed

# Run the complete test suite (Day 1 regression + Day 2 + 10 Stories & 8 NFRs)
npm test

# Run individual test suites
npm run test:day1     # Day 1 auth & chambers (10/10 tests)
npm run test:day2     # Day 2 batches, allocations, withdrawals, FIFO (17/17 tests)
npm run test:all      # Complete 10-story end-to-end audit (all 10 stories + 8 NFRs)

# Start server
npm start             # Runs on http://localhost:5000 with minute-cron enabled
```
