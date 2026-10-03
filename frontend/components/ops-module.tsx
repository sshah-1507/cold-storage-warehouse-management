"use client"

import * as React from "react"
import {
  Search, Plus, Eye, Check, X, Truck, Bell, Calculator, CreditCard,
  Pencil, ClipboardList, FileText, Users, BarChart3, Loader2, AlertCircle, RefreshCw, Undo2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import api, { getErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

const tone = (value: string) => {
  const v = String(value).toUpperCase()
  if (v === "CRITICAL" || v === "REJECTED" || v === "OVERDUE" || v === "FAILED") return "status-critical"
  if (v === "PENDING" || v === "WARNING" || v === "PARTIALLY_PAID" || v === "IN_PROGRESS" || v === "NEAR_EXPIRY") return "status-warning"
  return "status-success"
}

function Status({ children }: { children: React.ReactNode }) {
  return <Badge variant="outline" className={tone(String(children))}>{String(children).replaceAll("_", " ")}</Badge>
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="eyebrow">Northstar live operations</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

function Toolbar({ query, setQuery, onRefresh, loading }: { query: string; setQuery: (v: string) => void; onRefresh?: () => void; loading?: boolean }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} className="pl-9" placeholder="Search records..." />
      </div>
      {onRefresh && (
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin mr-1 size-3.5" : "mr-1 size-3.5"} /> Refresh
        </Button>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>
}

export function OperationsModule({ type }: { type: string }) {
  const { user } = useAuth()
  const [query, setQuery] = React.useState("")
  const [records, setRecords] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [filter, setFilter] = React.useState("ALL")
  const [notice, setNotice] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // Details modal
  const [selectedRecord, setSelectedRecord] = React.useState<any>(null)

  // Form states for creation dialogs
  const [productName, setProductName] = React.useState("")
  const [quantity, setQuantity] = React.useState("")
  const [unit, setUnit] = React.useState("kg")
  const [notes, setNotes] = React.useState("")

  // Dispatch modal
  const [dispatchWrId, setDispatchWrId] = React.useState("")
  const [dispatchMode, setDispatchMode] = React.useState<"fifo" | "override">("fifo")
  const [overrideBatchId, setOverrideBatchId] = React.useState("")
  const [overrideReason, setOverrideReason] = React.useState("")

  // Rent calculate form
  const [supplierId, setSupplierId] = React.useState("u_supplier_1")
  const [startDate, setStartDate] = React.useState("2026-09-01")
  const [endDate, setEndDate] = React.useState("2026-09-30")

  // Payment form
  const [rentId, setRentId] = React.useState("")
  const [amountPaise, setAmountPaise] = React.useState("")
  const [payMethod, setPayMethod] = React.useState("BANK_TRANSFER")
  const [payRef, setPayRef] = React.useState("")
  const [accountNumber, setAccountNumber] = React.useState("")

  // Staff Task form
  const [taskTitle, setTaskTitle] = React.useState("")
  const [taskDesc, setTaskDesc] = React.useState("")
  const [assignedTo, setAssignedTo] = React.useState("u_staff_1")
  const [dueDate, setDueDate] = React.useState("2026-10-05")

  // User form
  const [newUserName, setNewUserName] = React.useState("")
  const [newUserEmail, setNewUserEmail] = React.useState("")
  const [newUserPassword, setNewUserPassword] = React.useState("password123")
  const [newUserRole, setNewUserRole] = React.useState("STAFF")

  // Correction / edit modal
  const [correctingRecord, setCorrectingRecord] = React.useState<any>(null)
  const [correctAmount, setCorrectAmount] = React.useState("")
  const [correctReason, setCorrectReason] = React.useState("")

  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 3500)
  }

  const endpointMap: Record<string, string> = {
    withdrawals: "/withdrawals",
    dispatches: "/dispatches",
    alerts: "/alerts",
    rents: "/rent",
    payments: "/payments",
    tasks: "/tasks",
    auditLogs: "/audit-logs",
    users: "/users",
  }

  const loadRecords = React.useCallback(async () => {
    const ep = endpointMap[type]
    if (!ep) return
    try {
      setLoading(true)
      setError("")
      const res = await api.get<{ data: any[] }>(ep)
      setRecords(res.data.data || [])
    } catch (err) {
      setError(getErrorMessage(err, `Failed to load ${type} records.`))
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [type])

  React.useEffect(() => {
    loadRecords()
  }, [loadRecords])

  if (type === "reports") {
    return <Reports />
  }

  const title =
    type === "withdrawals" ? "Withdrawals" :
    type === "dispatches" ? "Dispatch" :
    type === "alerts" ? "Alerts" :
    type === "rents" ? "Rent" :
    type === "payments" ? "Payments" :
    type === "tasks" ? "Staff Tasks" :
    type === "auditLogs" ? "Audit Logs" : "Users"

  const description =
    type === "withdrawals" ? "Manage withdrawal requests from buyers and approve them for FIFO dispatch." :
    type === "dispatches" ? "Review completed dispatches and perform strict FIFO or audited override dispatches." :
    type === "alerts" ? "Monitor near-expiry and critical product alerts generated automatically by the monitoring engine." :
    type === "rents" ? "Calculate and monitor monthly cold storage rental charges." :
    type === "payments" ? "Record and inspect settlement payments with bank account masking." :
    type === "tasks" ? "Assign and track warehouse staff duties and operational inspections." :
    type === "auditLogs" ? "Immutable audit trail of financial adjustments and FIFO override operations." :
    "Manage warehouse staff, managers, suppliers and buyers."

  const columns =
    type === "withdrawals" ? ["id", "buyerId", "productName", "quantity", "unit", "status"] :
    type === "dispatches" ? ["id", "withdrawalId", "productName", "quantity", "batches", "status"] :
    type === "alerts" ? ["id", "batchId", "type", "message", "deliveryStatus"] :
    type === "rents" ? ["id", "supplierId", "periodStart", "periodEnd", "amountPaise", "status"] :
    type === "payments" ? ["id", "rentId", "amountPaise", "method", "maskedAccountNumber", "status"] :
    type === "tasks" ? ["id", "title", "assignedTo", "dueDate", "status"] :
    type === "auditLogs" ? ["id", "action", "entityId", "reason", "actorName", "ipAddress"] :
    ["id", "name", "email", "role"]

  // Handle status actions for withdrawals
  const handleWithdrawalStatus = async (id: string, newStatus: "APPROVED" | "REJECTED") => {
    try {
      await api.patch(`/withdrawals/${id}/status`, { status: newStatus })
      notify(`Withdrawal ${id.slice(0, 10)} marked as ${newStatus}`)
      loadRecords()
    } catch (err) {
      notify(`Error: ${getErrorMessage(err)}`)
    }
  }

  // Handle task status update
  const handleTaskStatus = async (id: string, newStatus: "IN_PROGRESS" | "COMPLETED") => {
    try {
      await api.patch(`/tasks/${id}`, { status: newStatus })
      notify(`Task updated to ${newStatus}`)
      loadRecords()
    } catch (err) {
      notify(`Error: ${getErrorMessage(err)}`)
    }
  }

  // Handle Dispatch execution
  const executeDispatch = async () => {
    try {
      if (dispatchMode === "fifo") {
        await api.post("/dispatches", { withdrawalId: dispatchWrId })
        notify(`FIFO Dispatch completed successfully for withdrawal ${dispatchWrId}`)
      } else {
        if (!overrideBatchId || !overrideReason.trim()) {
          notify("Batch ID and override justification reason are required.")
          return
        }
        await api.post("/dispatches/override", {
          withdrawalId: dispatchWrId,
          batchId: overrideBatchId.trim(),
          reason: overrideReason.trim(),
        })
        notify(`Authorized FIFO Override recorded and logged to AuditLog!`)
      }
      setDispatchWrId("")
      setOverrideBatchId("")
      setOverrideReason("")
      loadRecords()
    } catch (err) {
      notify(`Dispatch error: ${getErrorMessage(err)}`)
    }
  }

  // Handle creation form submits
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (type === "withdrawals") {
        await api.post("/withdrawals", {
          productName: productName.trim(),
          quantity: parseInt(quantity, 10),
          unit,
          notes: notes || undefined,
        })
        notify("Withdrawal request created successfully.")
      } else if (type === "rents") {
        await api.post("/rent/calculate", {
          supplierId,
          startDate,
          endDate,
        })
        notify("Rent charge calculated and recorded.")
      } else if (type === "payments") {
        await api.post("/payments", {
          rentId: rentId.trim(),
          amountPaise: parseInt(amountPaise, 10),
          method: payMethod,
          reference: payRef.trim(),
          accountNumber: accountNumber.trim() || undefined,
        })
        notify("Settlement payment recorded successfully.")
      } else if (type === "tasks") {
        await api.post("/tasks", {
          title: taskTitle.trim(),
          description: taskDesc.trim(),
          assignedTo: assignedTo.trim(),
          dueDate,
        })
        notify("Staff task assigned successfully.")
      } else if (type === "users") {
        await api.post("/users", {
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
        })
        notify(`User ${newUserName} created with role ${newUserRole}.`)
      }
      setDialogOpen(false)
      loadRecords()
    } catch (err) {
      notify(`Error: ${getErrorMessage(err)}`)
    }
  }

  // Handle payment correction submission
  const handlePaymentCorrection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correctingRecord) return
    try {
      await api.patch(`/payments/${correctingRecord.id}`, {
        amountPaise: parseInt(correctAmount, 10),
        reason: correctReason.trim(),
      })
      notify("Payment corrected and logged to AuditLog successfully.")
      setCorrectingRecord(null)
      loadRecords()
    } catch (err) {
      notify(`Error: ${getErrorMessage(err)}`)
    }
  }

  const filtered = records.filter(row =>
    JSON.stringify(row).toLowerCase().includes(query.toLowerCase()) &&
    (filter === "ALL" || row.status === filter || row.deliveryStatus === filter || row.type === filter || row.role === filter)
  )

  const canCreate =
    (type === "withdrawals" && (user?.role === "BUYER" || user?.role === "ADMIN" || user?.role === "MANAGER")) ||
    (type === "rents" && (user?.role === "ADMIN" || user?.role === "MANAGER")) ||
    (type === "payments" && (user?.role === "ADMIN" || user?.role === "MANAGER")) ||
    (type === "tasks" && (user?.role === "ADMIN" || user?.role === "MANAGER")) ||
    (type === "users" && user?.role === "ADMIN")

  return (
    <div className="p-4 md:p-7">
      <PageHeader
        title={title}
        description={description}
        action={
          canCreate ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button><Plus data-icon="inline-start" />Create {title.slice(0, -1)}</Button>} />
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New {title.slice(0, -1)}</DialogTitle>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={handleCreateSubmit}>
                  {type === "withdrawals" && (
                    <>
                      <Field label="Product name *">
                        <Input required value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Shimla Apples" />
                      </Field>
                      <Field label="Quantity *">
                        <Input required type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="20" />
                      </Field>
                      <Field label="Unit">
                        <select value={unit} onChange={e => setUnit(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                          <option value="kg">kg</option>
                          <option value="units">units</option>
                          <option value="pallets">pallets</option>
                        </select>
                      </Field>
                      <Field label="Notes">
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional delivery instructions" />
                      </Field>
                    </>
                  )}

                  {type === "rents" && (
                    <>
                      <Field label="Supplier ID *">
                        <Input required value={supplierId} onChange={e => setSupplierId(e.target.value)} placeholder="u_supplier_1" />
                      </Field>
                      <Field label="Start date *">
                        <Input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                      </Field>
                      <Field label="End date *">
                        <Input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                      </Field>
                    </>
                  )}

                  {type === "payments" && (
                    <>
                      <Field label="Rent Charge ID *">
                        <Input required value={rentId} onChange={e => setRentId(e.target.value)} placeholder="rent_seed_1" />
                      </Field>
                      <Field label="Amount in Paise * (100 paise = ₹1)">
                        <Input required type="number" min="1" value={amountPaise} onChange={e => setAmountPaise(e.target.value)} placeholder="150000" />
                      </Field>
                      <Field label="Payment method *">
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="UPI">UPI</option>
                          <option value="CHEQUE">Cheque</option>
                          <option value="CASH">Cash</option>
                        </select>
                      </Field>
                      <Field label="Transaction Reference *">
                        <Input required value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="TXN-9842" />
                      </Field>
                      <Field label="Bank Account Number (Will be masked)">
                        <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="9876543210" />
                      </Field>
                    </>
                  )}

                  {type === "tasks" && (
                    <>
                      <Field label="Task Title *">
                        <Input required value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Inspect Chamber B humidity" />
                      </Field>
                      <Field label="Description">
                        <Textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Task details and instructions" />
                      </Field>
                      <Field label="Assign to Staff ID *">
                        <Input required value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="u_staff_1" />
                      </Field>
                      <Field label="Due date *">
                        <Input required type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                      </Field>
                    </>
                  )}

                  {type === "users" && (
                    <>
                      <Field label="Full Name *">
                        <Input required value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="John Doe" />
                      </Field>
                      <Field label="Email Address *">
                        <Input required type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="john@example.com" />
                      </Field>
                      <Field label="Password *">
                        <Input required type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                      </Field>
                      <Field label="Role *">
                        <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                          <option value="STAFF">STAFF</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPPLIER">SUPPLIER</option>
                          <option value="BUYER">BUYER</option>
                        </select>
                      </Field>
                    </>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Record</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      {notice && (
        <div role="status" className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900 shadow-sm">
          {notice}
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {filtered.length} total records
          </CardTitle>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ALL">All records</option>
              {type === "withdrawals" && ["PENDING", "APPROVED", "REJECTED", "DISPATCHED"].map(v => <option key={v} value={v}>{v}</option>)}
              {type === "tasks" && ["PENDING", "IN_PROGRESS", "COMPLETED"].map(v => <option key={v} value={v}>{v}</option>)}
              {type === "rents" && ["PENDING", "PARTIALLY_PAID", "PAID"].map(v => <option key={v} value={v}>{v}</option>)}
              {type === "alerts" && ["NEAR_EXPIRY", "EXPIRED", "SENT", "PENDING"].map(v => <option key={v} value={v}>{v}</option>)}
              {type === "users" && ["ADMIN", "MANAGER", "STAFF", "SUPPLIER", "BUYER"].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <Toolbar query={query} setQuery={setQuery} onRefresh={loadRecords} loading={loading} />

          {loading ? (
            <div className="flex justify-center p-12 text-sm text-muted-foreground">
              <Loader2 className="animate-spin mr-2" /> Loading records...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                    {columns.map(c => (
                      <th key={c} className="px-3 py-3 font-medium">
                        {c.replaceAll("_", " ")}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, index) => (
                    <tr key={row.id || index} className="border-b border-border/60 hover:bg-muted/20">
                      {columns.map(c => (
                        <td key={c} className="px-3 py-3">
                          {c === "status" || c === "deliveryStatus" || c === "type" ? (
                            <Status>{row[c]}</Status>
                          ) : c === "amountPaise" ? (
                            <span className="font-semibold text-primary">₹{(row[c] / 100).toLocaleString()}</span>
                          ) : (
                            String(row[c] ?? "—")
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="View details"
                            onClick={() => setSelectedRecord(row)}
                            title="Inspect row"
                          >
                            <Eye className="size-4" />
                          </Button>

                          {/* Approval actions for withdrawal */}
                          {type === "withdrawals" && row.status === "PENDING" && (user?.role === "ADMIN" || user?.role === "MANAGER") && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Approve"
                                className="text-emerald-700"
                                onClick={() => handleWithdrawalStatus(row.id, "APPROVED")}
                                title="Approve withdrawal"
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Reject"
                                className="text-red-700"
                                onClick={() => handleWithdrawalStatus(row.id, "REJECTED")}
                                title="Reject withdrawal"
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          )}

                          {/* Dispatch action for approved withdrawal */}
                          {type === "withdrawals" && row.status === "APPROVED" && (user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setDispatchWrId(row.id)
                                setDispatchMode("fifo")
                              }}
                              title="Dispatch via FIFO"
                            >
                              <Truck className="size-3.5 mr-1" /> Dispatch
                            </Button>
                          )}

                          {/* Task progress updates */}
                          {type === "tasks" && row.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTaskStatus(row.id, "IN_PROGRESS")}
                              title="Start task"
                              className="text-xs"
                            >
                              Start
                            </Button>
                          )}
                          {type === "tasks" && row.status === "IN_PROGRESS" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTaskStatus(row.id, "COMPLETED")}
                              title="Complete task"
                              className="text-xs text-emerald-700"
                            >
                              <Check className="size-3.5 mr-1" /> Done
                            </Button>
                          )}

                          {/* Payment audit correction */}
                          {type === "payments" && (user?.role === "ADMIN" || user?.role === "MANAGER") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCorrectingRecord(row)
                                setCorrectAmount(String(row.amountPaise))
                                setCorrectReason("")
                              }}
                              title="Correct payment with Audit Log"
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No records found in this view.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row detail inspect dialog */}
      {selectedRecord && (
        <Dialog open={Boolean(selectedRecord)} onOpenChange={() => setSelectedRecord(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {Object.entries(selectedRecord).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-1.5 pt-1">
                  <span className="font-semibold text-muted-foreground">{k}:</span>
                  <span className="max-w-[280px] break-words text-right font-mono text-xs">
                    {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dispatch confirmation modal */}
      {dispatchWrId && (
        <Dialog open={Boolean(dispatchWrId)} onOpenChange={() => setDispatchWrId("")}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Process Dispatch for Withdrawal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Withdrawal ID: <code className="font-mono">{dispatchWrId}</code>
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    checked={dispatchMode === "fifo"}
                    onChange={() => setDispatchMode("fifo")}
                  />
                  Strict FIFO Dispatch (Recommended)
                </label>
                {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      checked={dispatchMode === "override"}
                      onChange={() => setDispatchMode("override")}
                    />
                    Authorized FIFO Override
                  </label>
                )}
              </div>

              {dispatchMode === "override" && (
                <div className="space-y-3 rounded-md bg-amber-50 p-4 text-sm border border-amber-200">
                  <p className="font-semibold text-amber-900">FIFO Override Notice (NFR-3)</p>
                  <p className="text-xs text-amber-800">
                    This operational exception will be permanently recorded in the AuditLog table with your user ID and IP address.
                  </p>
                  <Field label="Target Batch ID *">
                    <Input
                      required
                      placeholder="e.g. batch_seed_1"
                      value={overrideBatchId}
                      onChange={e => setOverrideBatchId(e.target.value)}
                    />
                  </Field>
                  <Field label="Operational Justification / Reason *">
                    <Textarea
                      required
                      placeholder="e.g. Buyer requested specific premium lot"
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                    />
                  </Field>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setDispatchWrId("")}>Cancel</Button>
                <Button onClick={executeDispatch}>
                  <Truck className="size-4 mr-1" /> Confirm Dispatch
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment Correction Modal */}
      {correctingRecord && (
        <Dialog open={Boolean(correctingRecord)} onOpenChange={() => setCorrectingRecord(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Correct Payment (NFR-3 Audit Log)</DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePaymentCorrection} className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Payment ID: <code className="font-mono">{correctingRecord.id}</code>
              </p>
              <Field label="Corrected Amount in Paise *">
                <Input
                  required
                  type="number"
                  min="1"
                  value={correctAmount}
                  onChange={e => setCorrectAmount(e.target.value)}
                />
              </Field>
              <Field label="Correction Justification / Reason *">
                <Textarea
                  required
                  placeholder="e.g. Corrected TDS deduction"
                  value={correctReason}
                  onChange={e => setCorrectReason(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setCorrectingRecord(null)}>Cancel</Button>
                <Button type="submit">Submit Correction</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function Reports() {
  const [overview, setOverview] = React.useState<any>(null)
  const [revenue, setRevenue] = React.useState<any[]>([])
  const [operations, setOperations] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true)
        const [ovRes, revRes, opRes] = await Promise.all([
          api.get("/reports/overview").catch(() => ({ data: { data: null } })),
          api.get("/reports/revenue?months=6").catch(() => ({ data: { data: [] } })),
          api.get("/reports/operations").catch(() => ({ data: { data: null } })),
        ])
        setOverview(ovRes.data.data)
        setRevenue(revRes.data.data || [])
        setOperations(opRes.data.data)
      } catch (err) {
        console.error("Report loading error:", err)
      } finally {
        setLoading(false)
      }
    }
    loadReports()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center p-16 text-sm text-muted-foreground">
        <Loader2 className="animate-spin mr-2" /> Loading reports...
      </div>
    )
  }

  const statCards = [
    ["Total Batches", overview ? overview.totalBatches.toString() : "0"],
    ["Occupancy Rate", overview ? `${overview.occupancyPercent}%` : "0%"],
    ["Near Expiry (7 days)", overview ? overview.nearExpiryBatches.toString() : "0"],
    ["Settled Revenue", overview ? `₹${(overview.revenuePaise / 100).toLocaleString()}` : "₹0"],
  ]

  return (
    <div className="p-4 md:p-7">
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive real-time operational and financial performance metrics."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="eyebrow">{label}</p>
              <p className="mt-3 text-2xl font-semibold text-primary">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue Trend (Paise/INR)</CardTitle>
          </CardHeader>
          <CardContent>
            {revenue.length > 0 ? (
              <div className="space-y-3">
                {revenue.map(r => (
                  <div key={r.month} className="flex items-center justify-between text-sm border-b pb-2">
                    <span className="font-medium">{r.month}</span>
                    <span className="font-semibold text-teal-700">₹{(r.revenuePaise / 100).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No revenue transactions recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live Chamber Occupancies</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {(operations?.chambers || []).map((ch: any) => (
              <div key={ch.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{ch.name}</span>
                  <strong>{ch.occupied} / {ch.capacity} {ch.unit} ({ch.percent}%)</strong>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-teal-600"
                    style={{ width: `${Math.min(100, ch.percent)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function SimpleModule({ type }: { type: string }) {
  return <OperationsModule type={type} />
}

export { PageHeader, Field }
