# Cold Storage Warehouse Management System (NORTHSTAR WMS)

Full-stack enterprise Cold Storage Warehouse Management System built with **React (Next.js 16 / React 19)**, **Node.js (Express.js)**, **Prisma ORM**, and **PostgreSQL**.

---

## 🚀 Architecture & Tech Stack

- **Backend:** Node.js, Express.js, Prisma ORM, PostgreSQL, express-session (HTTP-only secure cookies)
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS, Lucide React, Recharts, Axios
- **Database:** PostgreSQL (with transactional isolation, schema migrations, and idempotent Prisma seeding)

---

## 📋 Prerequisites

- **Node.js:** v18+ (tested on v20+)
- **PostgreSQL:** Running on `localhost:5432`
- **Package Managers:** `npm` (backend) & `pnpm` (frontend)

---

## ⚙️ Environment Configuration

### Backend (`backend/.env`)
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coldstoragewarehouse?schema=public"
SESSION_SECRET="super-secret-coldstorage-session-key-2026"
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
```

---

## 🛠️ Setup & Launch Instructions (Windows PowerShell)

### 1. Database Migration & Seeding
From the root folder:
```powershell
# Navigate to backend
cd backend

# Generate Prisma Client & apply migrations
npx prisma generate
npx prisma migrate deploy

# Seed initial test data (idempotent upsert of users, chambers, batches, tasks, rent, alerts)
npm run seed
cd ..
```

### 2. Start Backend Server
```powershell
cd backend
npm run dev
# Backend starts on http://localhost:5000 (Health check: http://localhost:5000/api/health)
```

### 3. Start Frontend App
In a separate PowerShell window:
```powershell
cd frontend
pnpm dev
# Frontend application accessible at http://localhost:3000
```

---

## 🧪 Testing & Verification

### Run Backend Unit & Integration Tests
```powershell
cd backend
npm test
# Executes 10/10 Day 1 + 17/17 Day 2 integration tests + 10-story audit + 8 NFR load benchmarks
```

### Run Frontend Production Build
```powershell
cd frontend
pnpm build
# Successfully generates optimized production bundle with zero prerender errors
```

---

## 👥 Seeded User Accounts (Password: `password123`)

| Role | Email | Permissions / Features |
|---|---|---|
| **Admin** | `admin@example.com` | Complete access to warehouse operations, user management, audit logs, financials |
| **Manager** | `manager@example.com` | Stock intake, chamber allocation, withdrawal approvals, FIFO dispatches, staff tasks |
| **Staff** | `staff@example.com` | Assigned task updates, stock inspection |
| **Supplier** | `supplier@example.com` | Inbound batch view & status tracking |
| **Buyer** | `buyer@example.com` | Create withdrawal requests & track dispatches |

---

## 📦 Features Implemented & Integrated

1. **Dashboard:** Live KPI metrics (Active Batches, Chamber Occupancy %, Expiry alerts, Settled Revenue) and live dispatch/alert feeds.
2. **Inventory Management (US-02):** Dynamic search, status filters, batch details modal, and live inbound stock intake.
3. **Chamber Management (US-03):** Chamber occupancy visualizations, remaining capacity indicators, and transactional batch allocation.
4. **Withdrawals (US-04):** Request creation, status approval/rejection workflows.
5. **FIFO Dispatch (US-05):** Strict FIFO dispatch queue and manager override capabilities with audit logging.
6. **Expiry Monitoring (US-07):** Automated cron alerts and manual threshold inspection.
7. **Rent & Billing (US-08):** Dynamic rent calculation based on days stored and occupancy.
8. **Payments (US-09):** Settlement logging with masked account numbers (`****9012`).
9. **Staff Task Assignment (US-06):** Task assignment, real-time status updates (Pending -> In Progress -> Completed).
10. **Reports & Audit Trail (US-10):** Real financial and operational summaries with immutable audit logging.
