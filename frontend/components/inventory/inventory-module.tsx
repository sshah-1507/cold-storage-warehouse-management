"use client"

import * as React from "react"
import { AlertCircle, Eye, Filter, Loader2, PackagePlus, RefreshCw, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import api, { getErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

export type InventoryStatus = "RECEIVED" | "ALLOCATED" | "PARTIALLY_DISPATCHED" | "DISPATCHED"

export type LiveBatch = {
  id: string
  productName: string
  supplierId: string
  quantity: number
  remainingQuantity: number
  unit: string
  chamberId: string | null
  receivedAt: string
  expiryDate: string
  status: InventoryStatus
}

const statusTone: Record<string, string> = {
  RECEIVED: "status-neutral",
  ALLOCATED: "status-success",
  PARTIALLY_DISPATCHED: "status-warning",
  DISPATCHED: "status-neutral",
  NEAR_EXPIRY: "status-warning",
  EXPIRED: "status-critical",
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={statusTone[status] || "status-neutral"}>{status.replace("_", " ")}</Badge>
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatDate(value?: string) {
  if (!value) return "—"
  try {
    const d = new Date(value.includes("T") ? value : `${value}T00:00:00`)
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d)
  } catch {
    return value
  }
}

function BatchDetails({ batch, onClose }: { batch: LiveBatch; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/25 p-4" role="dialog" aria-modal="true" aria-labelledby="batch-details-title">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <p className="eyebrow">Inventory record</p>
            <CardTitle id="batch-details-title" className="mt-1">Batch {batch.id}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
            <X />
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Product", batch.productName],
            ["Supplier ID", batch.supplierId],
            ["Initial quantity", `${formatQuantity(batch.quantity)} ${batch.unit}`],
            ["Remaining quantity", `${formatQuantity(batch.remainingQuantity)} ${batch.unit}`],
            ["Chamber ID", batch.chamberId || "Unassigned"],
            ["Received date", formatDate(batch.receivedAt)],
            ["Expiry date", formatDate(batch.expiryDate)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-medium text-primary">{value}</p>
            </div>
          ))}
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1"><StatusBadge status={batch.status} /></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StockIntake({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [productName, setProductName] = React.useState("")
  const [supplierId, setSupplierId] = React.useState("u_supplier_1")
  const [quantity, setQuantity] = React.useState("")
  const [unit, setUnit] = React.useState("kg")
  const [receivedAt, setReceivedAt] = React.useState(new Date().toISOString().slice(0, 10))
  const [expiryDate, setExpiryDate] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    if (!productName.trim() || !quantity || Number(quantity) <= 0 || !expiryDate) {
      setError("Please complete all required fields with valid values.")
      return
    }

    try {
      setLoading(true)
      await api.post("/batches", {
        productName: productName.trim(),
        supplierId,
        quantity: parseInt(quantity, 10),
        unit,
        receivedAt,
        expiryDate,
      })
      onSuccess()
    } catch (err) {
      setError(getErrorMessage(err, "Failed to register stock batch."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-primary/15">
      <CardHeader>
        <p className="eyebrow">New receipt</p>
        <CardTitle>Stock intake</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div role="alert" className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium text-primary">
              Product name *
              <Input
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Shimla Apples"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-primary">
              Supplier ID *
              <Input
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                placeholder="u_supplier_1"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-primary">
              Quantity *
              <Input
                required
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-primary">
              Unit
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="kg">kg</option>
                <option value="units">units</option>
                <option value="pallets">pallets</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-primary">
              Received date *
              <Input
                required
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-primary">
              Expiry date *
              <Input
                required
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <><Loader2 className="animate-spin" data-icon="inline-start" />Saving...</> : "Register batch"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function InventoryModule() {
  const { user } = useAuth()
  const [batches, setBatches] = React.useState<LiveBatch[]>([])
  const [loading, setLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("ALL")
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [totalCount, setTotalCount] = React.useState(0)
  const [selected, setSelected] = React.useState<LiveBatch | null>(null)
  const [intake, setIntake] = React.useState(false)
  const [toast, setToast] = React.useState("")

  const loadBatches = React.useCallback(async () => {
    try {
      setLoading(true)
      setFetchError("")
      const params: Record<string, string | number> = { page, limit: 10 }
      if (query.trim()) params.search = query.trim()
      if (status !== "ALL") params.status = status

      const res = await api.get<{ data: LiveBatch[]; meta?: { total: number; totalPages: number } }>("/batches", { params })
      setBatches(res.data.data || [])
      setTotalPages(res.data.meta?.totalPages || 1)
      setTotalCount(res.data.meta?.total || (res.data.data ? res.data.data.length : 0))
    } catch (err) {
      setFetchError(getErrorMessage(err, "Failed to load inventory records."))
      setBatches([])
    } finally {
      setLoading(false)
    }
  }, [page, query, status])

  React.useEffect(() => {
    loadBatches()
  }, [loadBatches])

  const notify = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(""), 3500)
  }

  const clear = () => {
    setQuery("")
    setStatus("ALL")
    setPage(1)
  }

  const canIntake = user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF"

  return (
    <div className="grid gap-5">
      {toast && (
        <div role="status" className="fixed bottom-5 right-5 z-40 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg">
          {toast}
        </div>
      )}

      {intake ? (
        <StockIntake
          onCancel={() => setIntake(false)}
          onSuccess={() => {
            setIntake(false)
            loadBatches()
            notify("Stock batch registered successfully.")
          }}
        />
      ) : (
        <>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Inventory control</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary">All batches</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Track warehouse stock batches, remaining quantities, chambers, and expiry dates.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => loadBatches()} title="Reload data">
                <RefreshCw className={loading ? "animate-spin" : ""} data-icon="inline-start" />Refresh
              </Button>
              {canIntake && (
                <Button onClick={() => setIntake(true)}>
                  <PackagePlus data-icon="inline-start" />Stock intake
                </Button>
              )}
            </div>
          </div>

          {fetchError && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">Error loading inventory:</p>
              <p>{fetchError}</p>
            </div>
          )}

          <Card>
            <CardHeader className="gap-4 border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">
                  Batch register <span className="ml-2 text-sm font-normal text-muted-foreground">{totalCount} live records</span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={clear}>
                  <Filter data-icon="inline-start" />Clear filters
                </Button>
              </div>

              <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search product name..."
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setPage(1)
                    }}
                  />
                </div>
                <select
                  aria-label="Filter status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value)
                    setPage(1)
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="ALL">All statuses</option>
                  <option value="RECEIVED">RECEIVED</option>
                  <option value="ALLOCATED">ALLOCATED</option>
                  <option value="PARTIALLY_DISPATCHED">PARTIALLY DISPATCHED</option>
                  <option value="DISPATCHED">DISPATCHED</option>
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center p-12 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin mr-2" /> Loading batches...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch ID</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Supplier ID</TableHead>
                        <TableHead>Initial Qty</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Chamber</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-semibold text-primary">{batch.id}</TableCell>
                          <TableCell className="font-medium">{batch.productName}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{batch.supplierId}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatQuantity(batch.quantity)} {batch.unit}</TableCell>
                          <TableCell className="whitespace-nowrap font-semibold text-teal-700">{formatQuantity(batch.remainingQuantity)} {batch.unit}</TableCell>
                          <TableCell className="whitespace-nowrap">{batch.chamberId || "Unassigned"}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(batch.receivedAt)}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(batch.expiryDate)}</TableCell>
                          <TableCell><StatusBadge status={batch.status} /></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelected(batch)}>
                              <Eye data-icon="inline-start" />View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!loading && batches.length === 0 && (
                <div className="px-6 py-14 text-center">
                  <p className="font-medium text-primary">No inventory records found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting your filters or use Stock Intake to register batches.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
                <span>Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selected && <BatchDetails batch={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

