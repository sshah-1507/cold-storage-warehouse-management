"use client"

import * as React from "react"
import Link from "next/link"
import {
  Boxes, Warehouse, CircleAlert, Clock3, Truck, Users, ShieldAlert,
  ClipboardList, CheckCircle2, FileText, ArrowUpRight, Check, Play,
  WalletCards, AlertTriangle, Layers, Calendar, ChevronRight, PackageCheck
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CurrentUser } from "@/lib/auth-context"
import api, { getErrorMessage } from "@/lib/api"

function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "critical" }) {
  return <Badge variant="outline" className={`status-${tone}`}>{children}</Badge>
}

// -------------------------------------------------------------
// 1. ADMIN DASHBOARD: System Management & Overall Oversight
// -------------------------------------------------------------
export function AdminDashboard({ user }: { user: CurrentUser }) {
  const [users, setUsers] = React.useState<any[]>([])
  const [auditLogs, setAuditLogs] = React.useState<any[]>([])
  const [alerts, setAlerts] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadAdminData() {
      try {
        setLoading(true)
        const [usersRes, auditRes, alertsRes] = await Promise.all([
          api.get("/users").catch(() => ({ data: { data: [] } })),
          api.get("/audit-logs?limit=6").catch(() => ({ data: { data: [] } })),
          api.get("/alerts?limit=5").catch(() => ({ data: { data: [] } })),
        ])
        setUsers(usersRes.data.data || [])
        setAuditLogs(auditRes.data.data || [])
        setAlerts(alertsRes.data.data || [])
      } catch (err) {
        console.error("Admin dashboard error:", err)
      } finally {
        setLoading(false)
      }
    }
    loadAdminData()
  }, [])

  const roleCounts = users.reduce((acc: Record<string, number>, u: any) => {
    acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})

  const metrics = [
    { label: "Total Users", value: users.length.toString(), delta: "Registered", note: "system accounts", icon: Users, tone: "navy" },
    { label: "Active Roles", value: Object.keys(roleCounts).length.toString(), delta: "Configured", note: "permission tiers", icon: ShieldAlert, tone: "teal" },
    { label: "Audit Events", value: auditLogs.length.toString(), delta: "Logged", note: "critical actions tracked", icon: FileText, tone: "amber" },
    { label: "Open Alerts", value: alerts.length.toString(), delta: alerts.length > 0 ? "Requires review" : "Clear", note: "system notices", icon: CircleAlert, tone: alerts.length > 0 ? "red" : "teal" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">System Administration & Oversight</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary md:text-[28px]">
            Welcome, {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Role: <Badge variant="outline" className="ml-1 font-semibold">{user.role}</Badge> · Operations center management console
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/users" />}>
            <Users data-icon="inline-start" />Manage Users
          </Button>
          <Button variant="outline" render={<Link href="/audit-logs" />}>
            <FileText data-icon="inline-start" />Audit Logs
          </Button>
          <Button variant="outline" render={<Link href="/reports" />}>
            <ArrowUpRight data-icon="inline-start" />Reports
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading system overview...</div>
      ) : (
        <>
          <section aria-label="Admin metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="metric-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`metric-icon ${metric.tone}`}>
                      <metric.icon />
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/80">{metric.delta}</span>
                  </div>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-[27px] font-semibold tracking-tight text-primary">{metric.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
                  <div className={`metric-line ${metric.tone}`} />
                </CardContent>
              </Card>
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <p className="eyebrow">Immutable audit record</p>
                  <CardTitle className="mt-1 text-base">Recent System & Operational Activity</CardTitle>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/audit-logs" />}>
                  View all <ArrowUpRight data-icon="inline-end" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {auditLogs.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No recent administrative activity.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-muted/35">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">
                            {log.action?.replace("_", " ")} · <span className="font-normal text-muted-foreground">{log.reason || "System event"}</span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            Actor: {log.actorName || log.userId || "System"} · {new Date(log.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <StatusBadge tone="neutral">{log.action}</StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="eyebrow">Identity distribution</p>
                <CardTitle className="mt-1 text-base">Users by Assigned Role</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {[
                  { role: "ADMIN", count: roleCounts["ADMIN"] || 0, label: "Administrators" },
                  { role: "MANAGER", count: roleCounts["MANAGER"] || 0, label: "Warehouse Managers" },
                  { role: "STAFF", count: roleCounts["STAFF"] || 0, label: "Floor Operators & Staff" },
                  { role: "SUPPLIER", count: roleCounts["SUPPLIER"] || 0, label: "Registered Suppliers" },
                  { role: "BUYER", count: roleCounts["BUYER"] || 0, label: "Authorized Buyers" },
                ].map((item) => (
                  <div key={item.role} className="flex items-center justify-between border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0">
                    <div>
                      <span className="font-medium text-primary">{item.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({item.role})</span>
                    </div>
                    <span className="font-semibold text-primary">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// 2. MANAGER DASHBOARD: Warehouse Operations & Business Oversight
// -------------------------------------------------------------
export function ManagerDashboard({
  user,
  overview,
  chambersList,
  revenueTrend,
  recentDispatches,
  recentAlerts,
  loading,
}: {
  user: CurrentUser
  overview: any
  chambersList: any[]
  revenueTrend: any[]
  recentDispatches: any[]
  recentAlerts: any[]
  loading: boolean
}) {
  const [withdrawals, setWithdrawals] = React.useState<any[]>([])

  React.useEffect(() => {
    async function loadWithdrawals() {
      try {
        const res = await api.get("/withdrawals?limit=5")
        setWithdrawals(res.data.data || [])
      } catch (err) {
        console.error("Manager withdrawals error:", err)
      }
    }
    loadWithdrawals()
  }, [])

  const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === "PENDING").length
  const occupiedPct = overview?.occupancyPercent ?? 0

  const metrics = [
    {
      label: "Total Inventory",
      value: overview ? `${overview.totalBatches} batches` : "—",
      delta: "Active stock",
      note: "stored in warehouse",
      icon: Boxes,
      tone: "navy",
    },
    {
      label: "Chamber Occupancy",
      value: overview ? `${overview.occupancyPercent}%` : "—",
      delta: overview?.occupancyPercent > 85 ? "Near capacity" : "Normal",
      note: "capacity in use",
      icon: Warehouse,
      tone: overview?.occupancyPercent > 85 ? "red" : "teal",
    },
    {
      label: "Pending Withdrawals",
      value: pendingWithdrawalsCount.toString(),
      delta: pendingWithdrawalsCount > 0 ? "Awaiting review" : "Up to date",
      note: "buyer requests",
      icon: ClipboardList,
      tone: pendingWithdrawalsCount > 0 ? "amber" : "teal",
    },
    {
      label: "Near Expiry Batches",
      value: overview ? overview.nearExpiryBatches.toString() : "—",
      delta: overview?.nearExpiryBatches > 0 ? "Urgent review" : "None",
      note: "expiring in 7 days",
      icon: CircleAlert,
      tone: overview?.nearExpiryBatches > 0 ? "red" : "teal",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Warehouse Operations Overview</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary md:text-[28px]">
            Good morning, {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Role: <Badge variant="outline" className="ml-1 font-semibold">{user.role}</Badge> · Operational oversight and chamber management
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/withdrawals" />}>
            <ClipboardList data-icon="inline-start" />Review Withdrawals
          </Button>
          <Button variant="outline" render={<Link href="/inventory" />}>
            <Boxes data-icon="inline-start" />Inventory
          </Button>
          <Button variant="outline" render={<Link href="/chambers" />}>
            <Warehouse data-icon="inline-start" />Chambers
          </Button>
          <Button variant="outline" render={<Link href="/dispatch" />}>
            <Truck data-icon="inline-start" />Dispatch
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading operations statistics...</div>
      ) : (
        <>
          <section aria-label="Manager metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="metric-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`metric-icon ${metric.tone}`}>
                      <metric.icon />
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/80">{metric.delta}</span>
                  </div>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-[27px] font-semibold tracking-tight text-primary">{metric.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
                  <div className={`metric-line ${metric.tone}`} />
                </CardContent>
              </Card>
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <p className="eyebrow">Pending buyer requests</p>
                  <CardTitle className="mt-1 text-base">Withdrawal Requests</CardTitle>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/withdrawals" />}>
                  Manage <ArrowUpRight data-icon="inline-end" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {withdrawals.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No pending withdrawal requests.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {withdrawals.slice(0, 5).map((w) => (
                      <div key={w.id} className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-muted/35">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">
                            {w.productName} · <span className="font-semibold">{w.quantity} {w.unit}</span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            Order {w.id.slice(0, 10)} · Buyer: {w.buyerId}
                          </p>
                        </div>
                        <StatusBadge tone={w.status === "PENDING" ? "warning" : w.status === "APPROVED" ? "success" : "neutral"}>
                          {w.status}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <p className="eyebrow">Live chamber status</p>
                  <CardTitle className="mt-1 text-base">Chamber Occupancy</CardTitle>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/chambers" />}>
                  Chambers <ArrowUpRight data-icon="inline-end" />
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4">
                {chambersList.map((ch) => {
                  const pct = ch.capacity > 0 ? Math.round((ch.occupied / ch.capacity) * 100) : 0
                  return (
                    <div key={ch.id}>
                      <div className="mb-1 flex justify-between text-xs font-medium">
                        <span className="text-primary truncate">{ch.name}</span>
                        <span className="text-muted-foreground font-semibold">{ch.occupied} / {ch.capacity} {ch.unit} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-600" : pct >= 75 ? "bg-amber-500" : "bg-teal-600"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <p className="eyebrow">FIFO operations</p>
                  <CardTitle className="mt-1 text-base">Recent Dispatches</CardTitle>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/dispatch" />}>
                  View all <ArrowUpRight data-icon="inline-end" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {recentDispatches.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No dispatches recorded yet.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {recentDispatches.slice(0, 4).map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-4 px-6 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">
                            Dispatch {d.id.slice(0, 10)} · {d.productName} ({d.quantity} {d.unit})
                          </p>
                          <p className="text-xs text-muted-foreground truncate">Batches: {d.batches || "Assigned"}</p>
                        </div>
                        <StatusBadge tone="success">{d.status}</StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <p className="eyebrow">Inventory monitoring</p>
                  <CardTitle className="mt-1 text-base">Expiry Alerts</CardTitle>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/alerts" />}>
                  Alerts <ArrowUpRight data-icon="inline-end" />
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3">
                {recentAlerts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No active expiry alerts.</p>
                ) : (
                  recentAlerts.slice(0, 4).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{alert.type.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                      </div>
                      <StatusBadge tone={alert.type === "EXPIRED" ? "critical" : "warning"}>
                        {alert.deliveryStatus}
                      </StatusBadge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// 3. STAFF DASHBOARD: Day-to-Day Warehouse Tasks & Actionable Work
// -------------------------------------------------------------
export function StaffDashboard({ user }: { user: CurrentUser }) {
  const [tasks, setTasks] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(null)

  const loadTasks = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get("/tasks")
      setTasks(res.data.data || [])
    } catch (err) {
      console.error("Staff tasks error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleUpdateStatus = async (id: string, newStatus: "IN_PROGRESS" | "COMPLETED") => {
    try {
      setUpdatingTaskId(id)
      await api.patch(`/tasks/${id}`, { status: newStatus })
      await loadTasks()
    } catch (err) {
      console.error("Task update error:", err)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  const pendingCount = tasks.filter((t) => t.status === "PENDING").length
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length

  const metrics = [
    { label: "My Pending Tasks", value: pendingCount.toString(), delta: "To Do", note: "waiting to start", icon: Clock3, tone: "amber" },
    { label: "In Progress", value: inProgressCount.toString(), delta: "Active", note: "underway currently", icon: Play, tone: "navy" },
    { label: "Completed Tasks", value: completedCount.toString(), delta: "Finished", note: "closed duties", icon: CheckCircle2, tone: "teal" },
    { label: "Total Assigned", value: tasks.length.toString(), delta: "Assigned", note: "tasks for you", icon: PackageCheck, tone: "teal" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Personal Operational Work</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary md:text-[28px]">
            Good morning, {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Role: <Badge variant="outline" className="ml-1 font-semibold">{user.role}</Badge> · Warehouse floor task execution
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/staff-tasks" />}>
            <PackageCheck data-icon="inline-start" />My Task Board
          </Button>
          <Button variant="outline" render={<Link href="/inventory" />}>
            <Boxes data-icon="inline-start" />Inventory
          </Button>
          <Button variant="outline" render={<Link href="/dispatch" />}>
            <Truck data-icon="inline-start" />Dispatch
          </Button>
          <Button variant="outline" render={<Link href="/alerts" />}>
            <AlertTriangle data-icon="inline-start" />Alerts
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading your assigned tasks...</div>
      ) : (
        <>
          <section aria-label="Staff metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="metric-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`metric-icon ${metric.tone}`}>
                      <metric.icon />
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/80">{metric.delta}</span>
                  </div>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-[27px] font-semibold tracking-tight text-primary">{metric.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
                  <div className={`metric-line ${metric.tone}`} />
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <p className="eyebrow">Actionable tasks</p>
                <CardTitle className="mt-1 text-base">My Assigned Warehouse Duties</CardTitle>
              </div>
              <Button variant="ghost" size="sm" render={<Link href="/staff-tasks" />}>
                View all tasks <ArrowUpRight data-icon="inline-end" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  You have no pending tasks assigned at this moment.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/35">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-primary">{task.title}</p>
                          <StatusBadge tone={task.status === "COMPLETED" ? "success" : task.status === "IN_PROGRESS" ? "warning" : "neutral"}>
                            {task.status.replace("_", " ")}
                          </StatusBadge>
                        </div>
                        {task.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                        )}
                        <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="size-3" /> Due Date: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Unscheduled"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {task.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingTaskId === task.id}
                            onClick={() => handleUpdateStatus(task.id, "IN_PROGRESS")}
                          >
                            <Play className="size-3.5 mr-1" /> Start Task
                          </Button>
                        )}
                        {task.status === "IN_PROGRESS" && (
                          <Button
                            size="sm"
                            disabled={updatingTaskId === task.id}
                            onClick={() => handleUpdateStatus(task.id, "COMPLETED")}
                          >
                            <Check className="size-3.5 mr-1" /> Mark Done
                          </Button>
                        )}
                        {task.status === "COMPLETED" && (
                          <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="size-3.5" /> Completed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// 4. SUPPLIER DASHBOARD: Own Inventory & Financial Relationship
// -------------------------------------------------------------
export function SupplierDashboard({ user }: { user: CurrentUser }) {
  const [batches, setBatches] = React.useState<any[]>([])
  const [rents, setRents] = React.useState<any[]>([])
  const [payments, setPayments] = React.useState<any[]>([])
  const [alerts, setAlerts] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadSupplierData() {
      try {
        setLoading(true)
        const [batchesRes, rentsRes, paymentsRes, alertsRes] = await Promise.all([
          api.get("/batches?limit=10").catch(() => ({ data: { data: [] } })),
          api.get("/rent?limit=5").catch(() => ({ data: { data: [] } })),
          api.get("/payments?limit=5").catch(() => ({ data: { data: [] } })),
          api.get("/alerts?limit=5").catch(() => ({ data: { data: [] } })),
        ])
        setBatches(batchesRes.data.data || [])
        setRents(rentsRes.data.data || [])
        setPayments(paymentsRes.data.data || [])
        setAlerts(alertsRes.data.data || [])
      } catch (err) {
        console.error("Supplier dashboard error:", err)
      } finally {
        setLoading(false)
      }
    }
    loadSupplierData()
  }, [])

  const totalQuantity = batches.reduce((sum, b) => sum + (Number(b.remainingQuantity) || 0), 0)
  const outstandingRentPaise = rents
    .filter((r) => r.status === "PENDING" || r.status === "UNPAID")
    .reduce((sum, r) => sum + (Number(r.amountPaise) || 0), 0)

  const metrics = [
    { label: "My Stored Batches", value: batches.length.toString(), delta: "Active batches", note: "under cold storage", icon: Boxes, tone: "navy" },
    { label: "Total Quantity", value: `${totalQuantity.toLocaleString()} kg`, delta: "Stock in warehouse", note: "remaining volume", icon: Warehouse, tone: "teal" },
    { label: "Outstanding Rent", value: `₹${(outstandingRentPaise / 100).toLocaleString()}`, delta: outstandingRentPaise > 0 ? "Pending payment" : "All settled", note: "current storage charges", icon: WalletCards, tone: outstandingRentPaise > 0 ? "amber" : "teal" },
    { label: "Near-Expiry Alerts", value: alerts.length.toString(), delta: alerts.length > 0 ? "Attention required" : "Healthy stock", note: "for your batches", icon: CircleAlert, tone: alerts.length > 0 ? "red" : "teal" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Supplier Portal & Account Overview</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary md:text-[28px]">
            Welcome, {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Role: <Badge variant="outline" className="ml-1 font-semibold">{user.role}</Badge> · Stored produce and financial summary
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/inventory" />}>
            <Boxes data-icon="inline-start" />View My Batches
          </Button>
          <Button variant="outline" render={<Link href="/rent" />}>
            <WalletCards data-icon="inline-start" />View Rent
          </Button>
          <Button variant="outline" render={<Link href="/payments" />}>
            <FileText data-icon="inline-start" />Payments
          </Button>
          <Button variant="outline" render={<Link href="/alerts" />}>
            <AlertTriangle data-icon="inline-start" />Alerts
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading your warehouse overview...</div>
      ) : (
        <>
          <section aria-label="Supplier metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="metric-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`metric-icon ${metric.tone}`}>
                      <metric.icon />
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/80">{metric.delta}</span>
                  </div>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-[27px] font-semibold tracking-tight text-primary">{metric.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
                  <div className={`metric-line ${metric.tone}`} />
                </CardContent>
              </Card>
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <p className="eyebrow">Your inventory</p>
                  <CardTitle className="mt-1 text-base">My Stored Batches</CardTitle>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/inventory" />}>
                  All batches <ArrowUpRight data-icon="inline-end" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {batches.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No batches are currently stored for your account.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {batches.slice(0, 5).map((b) => (
                      <div key={b.id} className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-muted/35">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">
                            {b.productName} · <span className="font-semibold">{b.remainingQuantity} {b.unit}</span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            Batch: {b.id} · Chamber: {b.chamberId || "Pending allocation"} · Expires: {b.expiryDate}
                          </p>
                        </div>
                        <StatusBadge tone={b.status === "ALLOCATED" ? "success" : "neutral"}>
                          {b.status}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <p className="eyebrow">Storage invoices</p>
                  <CardTitle className="mt-1 text-base">Recent Rent & Billing</CardTitle>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/rent" />}>
                  View rent <ArrowUpRight data-icon="inline-end" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {rents.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No rent records generated yet.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {rents.slice(0, 4).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 px-6 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">
                            ₹{(r.amountPaise / 100).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.periodStart} to {r.periodEnd}
                          </p>
                        </div>
                        <StatusBadge tone={r.status === "PAID" ? "success" : "warning"}>
                          {r.status}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// 5. BUYER DASHBOARD: Requesting & Tracking Goods
// -------------------------------------------------------------
export function BuyerDashboard({ user }: { user: CurrentUser }) {
  const [withdrawals, setWithdrawals] = React.useState<any[]>([])
  const [dispatches, setDispatches] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadBuyerData() {
      try {
        setLoading(true)
        const [wRes, dRes] = await Promise.all([
          api.get("/withdrawals").catch(() => ({ data: { data: [] } })),
          api.get("/dispatches").catch(() => ({ data: { data: [] } })),
        ])
        setWithdrawals(wRes.data.data || [])
        setDispatches(dRes.data.data || [])
      } catch (err) {
        console.error("Buyer dashboard error:", err)
      } finally {
        setLoading(false)
      }
    }
    loadBuyerData()
  }, [])

  const pendingCount = withdrawals.filter((w) => w.status === "PENDING").length
  const approvedCount = withdrawals.filter((w) => w.status === "APPROVED").length
  const dispatchedCount = withdrawals.filter((w) => w.status === "DISPATCHED").length
  const completedCount = dispatches.filter((d) => d.status === "COMPLETED").length

  const metrics = [
    { label: "My Pending Requests", value: pendingCount.toString(), delta: "Awaiting approval", note: "orders placed", icon: Clock3, tone: "amber" },
    { label: "Approved Requests", value: approvedCount.toString(), delta: "Ready for dispatch", note: "verified orders", icon: CheckCircle2, tone: "teal" },
    { label: "Dispatched Orders", value: dispatchedCount.toString(), delta: "Fitted on trucks", note: "shipped from storage", icon: Truck, tone: "navy" },
    { label: "Completed Dispatches", value: completedCount.toString(), delta: "Fulfillments", note: "successful handovers", icon: Boxes, tone: "teal" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Buyer Portal & Orders</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary md:text-[28px]">
            Welcome, {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Role: <Badge variant="outline" className="ml-1 font-semibold">{user.role}</Badge> · Request and monitor stock dispatches
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/withdrawals" />}>
            <ClipboardList data-icon="inline-start" />Create Withdrawal
          </Button>
          <Button variant="outline" render={<Link href="/withdrawals" />}>
            <Clock3 data-icon="inline-start" />My Withdrawals
          </Button>
          <Button variant="outline" render={<Link href="/dispatch" />}>
            <Truck data-icon="inline-start" />My Dispatches
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading your request overview...</div>
      ) : (
        <>
          <section aria-label="Buyer metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="metric-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`metric-icon ${metric.tone}`}>
                      <metric.icon />
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/80">{metric.delta}</span>
                  </div>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-[27px] font-semibold tracking-tight text-primary">{metric.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
                  <div className={`metric-line ${metric.tone}`} />
                </CardContent>
              </Card>
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <p className="eyebrow">Your order history</p>
                  <CardTitle className="mt-1 text-base">My Recent Withdrawal Requests</CardTitle>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/withdrawals" />}>
                  View all <ArrowUpRight data-icon="inline-end" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {withdrawals.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">You have no withdrawal requests yet.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {withdrawals.slice(0, 5).map((w) => (
                      <div key={w.id} className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-muted/35">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">
                            {w.productName} · <span className="font-semibold">{w.quantity} {w.unit}</span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            Request: {w.id.slice(0, 10)} · Submitted: {new Date(w.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <StatusBadge tone={w.status === "PENDING" ? "warning" : w.status === "APPROVED" || w.status === "DISPATCHED" ? "success" : "critical"}>
                          {w.status}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <p className="eyebrow">Fulfillment record</p>
                  <CardTitle className="mt-1 text-base">Completed Dispatches</CardTitle>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/dispatch" />}>
                  All dispatches <ArrowUpRight data-icon="inline-end" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {dispatches.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No dispatches processed for your orders yet.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {dispatches.slice(0, 4).map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3 px-6 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">
                            {d.productName} ({d.quantity} {d.unit})
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            Gate Pass: {d.id.slice(0, 10)}
                          </p>
                        </div>
                        <StatusBadge tone="success">{d.status}</StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
