"use client"

import * as React from "react"
import { AlertCircle, Check, ChevronRight, Loader2, Plus, RefreshCw, Snowflake, Warehouse, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import api, { getErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

export type LiveChamber = {
  id: string
  name: string
  capacity: number
  occupied: number
  unit: string
}

export type UnallocatedBatch = {
  id: string
  productName: string
  remainingQuantity: number
  unit: string
  status: string
}

function formatCapacity(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function OccupancyIndicator({ chamber }: { chamber: LiveChamber }) {
  const percent = chamber.capacity > 0 ? Math.round((chamber.occupied / chamber.capacity) * 100) : 0
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Occupancy</span>
        <span className="font-semibold text-primary">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            percent >= 100 ? "bg-red-600" : percent >= 80 ? "bg-amber-500" : "bg-teal-600"
          }`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  )
}

function ChamberCard({ chamber, onSelect }: { chamber: LiveChamber; onSelect: () => void }) {
  const free = Math.max(0, chamber.capacity - chamber.occupied)
  const percent = chamber.capacity > 0 ? Math.round((chamber.occupied / chamber.capacity) * 100) : 0
  const status = percent >= 100 ? "FULL" : percent >= 80 ? "NEAR_CAPACITY" : "AVAILABLE"
  const tone = percent >= 100 ? "status-critical" : percent >= 80 ? "status-warning" : "status-success"

  return (
    <button type="button" onClick={onSelect} className="text-left w-full">
      <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/20">
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <Snowflake />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Chamber {chamber.id}</p>
              <CardTitle className="mt-1 text-base">{chamber.name}</CardTitle>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-primary">
                {formatCapacity(chamber.occupied)} {chamber.unit}
              </p>
              <p className="text-xs text-muted-foreground">of {formatCapacity(chamber.capacity)} {chamber.unit} capacity</p>
            </div>
            <Badge variant="outline" className={tone}>
              {status.replace("_", " ")}
            </Badge>
          </div>
          <OccupancyIndicator chamber={chamber} />
          <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs">
            <div>
              <p className="text-muted-foreground">Available space</p>
              <p className="mt-1 font-semibold text-teal-700">{formatCapacity(free)} {chamber.unit}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Unit</p>
              <p className="mt-1 font-semibold text-primary">{chamber.unit}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

function ChamberDetails({ chamber, onClose }: { chamber: LiveChamber; onClose: () => void }) {
  const free = Math.max(0, chamber.capacity - chamber.occupied)
  const [batches, setBatches] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadBatches() {
      try {
        setLoading(true)
        const res = await api.get<{ data: any[] }>("/batches?limit=100")
        const chamberBatches = (res.data.data || []).filter((b: any) => b.chamberId === chamber.id)
        setBatches(chamberBatches)
      } catch (err) {
        console.error("Failed to load chamber batches:", err)
      } finally {
        setLoading(false)
      }
    }
    loadBatches()
  }, [chamber.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/25 p-4" role="dialog" aria-modal="true" aria-labelledby="chamber-details-title">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-auto shadow-xl">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <p className="eyebrow">Chamber overview · {chamber.id}</p>
            <CardTitle id="chamber-details-title" className="mt-1">{chamber.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Total capacity: {formatCapacity(chamber.capacity)} {chamber.unit}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
            <X />
          </Button>
        </CardHeader>
        <CardContent className="grid gap-5">
          <OccupancyIndicator chamber={chamber} />
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/45 p-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Capacity</p>
              <p className="mt-1 font-semibold text-primary">{formatCapacity(chamber.capacity)} {chamber.unit}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Occupied</p>
              <p className="mt-1 font-semibold text-primary">{formatCapacity(chamber.occupied)} {chamber.unit}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="mt-1 font-semibold text-teal-700">{formatCapacity(free)} {chamber.unit}</p>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-primary">Stored batches in this chamber</h3>
            {loading ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Loading batches...</p>
            ) : batches.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border/70">
                <div className="grid grid-cols-[1.2fr_.8fr_.8fr_auto] gap-3 bg-muted/45 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Product</span>
                  <span>Quantity</span>
                  <span>Expiry</span>
                  <span>Status</span>
                </div>
                {batches.map((batch) => (
                  <div key={batch.id} className="grid grid-cols-[1.2fr_.8fr_.8fr_auto] items-center gap-3 border-t border-border/60 px-3 py-3 text-xs">
                    <div>
                      <p className="font-medium text-primary">{batch.productName}</p>
                      <p className="text-muted-foreground">{batch.id}</p>
                    </div>
                    <span>{formatCapacity(batch.remainingQuantity)} {batch.unit}</span>
                    <span>{batch.expiryDate}</span>
                    <Badge variant="outline" className="status-success">{batch.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                No active batches currently allocated to this chamber.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AllocationForm({
  chambers,
  onCancel,
  onSuccess,
}: {
  chambers: LiveChamber[]
  onCancel: () => void
  onSuccess: (msg: string) => void
}) {
  const [batches, setBatches] = React.useState<UnallocatedBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = React.useState("")
  const [selectedChamberId, setSelectedChamberId] = React.useState(chambers[0]?.id || "")
  const [quantity, setQuantity] = React.useState("")
  const [loadingBatches, setLoadingBatches] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    async function loadUnallocated() {
      try {
        setLoadingBatches(true)
        const res = await api.get<{ data: any[] }>("/batches?limit=50")
        // Find batches with remaining quantity > 0
        const available = (res.data.data || []).filter((b: any) => b.remainingQuantity > 0)
        setBatches(available)
        if (available.length > 0) {
          setSelectedBatchId(available[0].id)
        }
      } catch (err) {
        setError("Failed to load batches for allocation.")
      } finally {
        setLoadingBatches(false)
      }
    }
    loadUnallocated()
  }, [])

  const selectedBatch = batches.find((b) => b.id === selectedBatchId)
  const selectedChamber = chambers.find((c) => c.id === selectedChamberId) || chambers[0]
  const freeCapacity = selectedChamber ? Math.max(0, selectedChamber.capacity - selectedChamber.occupied) : 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    const qty = parseInt(quantity, 10)
    if (!qty || qty <= 0) {
      setError("Please enter a valid positive quantity.")
      return
    }
    if (selectedBatch && qty > selectedBatch.remainingQuantity) {
      setError(`Requested quantity (${qty}) exceeds batch available stock (${selectedBatch.remainingQuantity}).`)
      return
    }
    if (qty > freeCapacity) {
      setError(`Requested quantity (${qty}) exceeds chamber free capacity (${freeCapacity}).`)
      return
    }

    try {
      setSubmitting(true)
      await api.post("/allocations", {
        batchId: selectedBatchId,
        chamberId: selectedChamberId,
        quantity: qty,
      })
      onSuccess(`Allocated ${qty} ${selectedBatch?.unit || 'kg'} to ${selectedChamber?.name} successfully.`)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to allocate batch to chamber."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-primary/15">
      <CardHeader>
        <p className="eyebrow">Warehouse movement</p>
        <CardTitle>Allocate batch to chamber</CardTitle>
        <p className="text-sm text-muted-foreground">Assign live unallocated or active stock into a cold storage chamber.</p>
      </CardHeader>
      <CardContent>
        {error && (
          <div role="alert" className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium text-primary">
              Select batch *
              {loadingBatches ? (
                <div className="text-xs text-muted-foreground">Loading batches...</div>
              ) : batches.length === 0 ? (
                <div className="text-xs text-amber-600">No unallocated batches available. Register stock in Inventory first.</div>
              ) : (
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id.slice(0, 14)} · {b.productName} ({b.remainingQuantity} {b.unit})
                    </option>
                  ))}
                </select>
              )}
              {selectedBatch && (
                <span className="font-normal text-muted-foreground">
                  Available in batch: {formatCapacity(selectedBatch.remainingQuantity)} {selectedBatch.unit}
                </span>
              )}
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-primary">
              Select chamber *
              <select
                value={selectedChamberId}
                onChange={(e) => setSelectedChamberId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {chambers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {c.name} (Free: {c.capacity - c.occupied} {c.unit})
                  </option>
                ))}
              </select>
              {selectedChamber && (
                <span className="font-normal text-muted-foreground">
                  Free capacity: {formatCapacity(freeCapacity)} {selectedChamber.unit}
                </span>
              )}
            </label>
          </div>

          <label className="grid max-w-xs gap-1.5 text-xs font-medium text-primary">
            Quantity *
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 50"
              required
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || batches.length === 0}>
              {submitting ? <><Loader2 className="animate-spin" data-icon="inline-start" />Allocating...</> : <><Plus data-icon="inline-start" />Allocate batch</>}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function ChambersModule() {
  const { user } = useAuth()
  const [chambers, setChambers] = React.useState<LiveChamber[]>([])
  const [loading, setLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState("")
  const [selected, setSelected] = React.useState<LiveChamber | null>(null)
  const [allocating, setAllocating] = React.useState(false)
  const [toast, setToast] = React.useState("")

  const loadChambers = React.useCallback(async () => {
    try {
      setLoading(true)
      setFetchError("")
      const res = await api.get<{ data: LiveChamber[] }>("/chambers")
      setChambers(res.data.data || [])
    } catch (err) {
      setFetchError(getErrorMessage(err, "Failed to load storage chambers."))
      setChambers([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadChambers()
  }, [loadChambers])

  const notify = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(""), 3500)
  }

  const totals = chambers.reduce(
    (res, ch) => ({
      capacity: res.capacity + ch.capacity,
      occupied: res.occupied + ch.occupied,
    }),
    { capacity: 0, occupied: 0 }
  )

  const canAllocate = user?.role === "ADMIN" || user?.role === "MANAGER"

  return (
    <div className="grid gap-5">
      {toast && (
        <div role="status" className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg">
          <Check className="size-4" />
          {toast}
        </div>
      )}

      {allocating ? (
        <AllocationForm
          chambers={chambers}
          onCancel={() => setAllocating(false)}
          onSuccess={(msg) => {
            setAllocating(false)
            loadChambers()
            notify(msg)
          }}
        />
      ) : (
        <>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Physical storage</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary">Chambers</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Real-time chamber occupancy and cold storage batch allocations.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => loadChambers()} title="Reload data">
                <RefreshCw className={loading ? "animate-spin" : ""} data-icon="inline-start" />Refresh
              </Button>
              {canAllocate && (
                <Button onClick={() => setAllocating(true)}>
                  <Plus data-icon="inline-start" />Allocate batch
                </Button>
              )}
            </div>
          </div>

          {fetchError && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">Error loading chambers:</p>
              <p>{fetchError}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center p-12 text-sm text-muted-foreground">
              <Loader2 className="animate-spin mr-2" /> Loading chambers...
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total chambers</p>
                    <p className="mt-1 text-2xl font-semibold text-primary">{chambers.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total occupancy</p>
                    <p className="mt-1 text-2xl font-semibold text-primary">
                      {totals.capacity > 0 ? Math.round((totals.occupied / totals.capacity) * 100) : 0}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Available space</p>
                    <p className="mt-1 text-2xl font-semibold text-teal-700">
                      {formatCapacity(Math.max(0, totals.capacity - totals.occupied))} kg
                    </p>
                  </CardContent>
                </Card>
              </div>

              {chambers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                  No storage chambers found.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {chambers.map((chamber) => (
                    <ChamberCard key={chamber.id} chamber={chamber} onSelect={() => setSelected(chamber)} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {selected && (
        <ChamberDetails
          chamber={chambers.find((c) => c.id === selected.id) || selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}


