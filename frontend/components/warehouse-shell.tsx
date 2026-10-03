"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  AlertTriangle, Boxes, ClipboardList, FileBarChart, FileClock,
  LayoutDashboard, LogOut, PackageCheck, PanelLeft, Truck, Users,
  WalletCards, Warehouse
} from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import { useAuth } from "@/lib/auth-context"
import api from "@/lib/api"
import {
  AdminDashboard,
  ManagerDashboard,
  StaffDashboard,
  SupplierDashboard,
  BuyerDashboard,
} from "@/components/dashboard/role-dashboards"

export type WarehouseRole = "ADMIN" | "MANAGER" | "STAFF" | "SUPPLIER" | "BUYER"
type NavItem = { label: string; href: string; icon: React.ElementType; roles: WarehouseRole[] }
const allRoles: WarehouseRole[] = ["ADMIN", "MANAGER", "STAFF", "SUPPLIER", "BUYER"]

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: allRoles },
  { label: "Inventory", href: "/inventory", icon: Boxes, roles: ["ADMIN", "MANAGER", "STAFF", "SUPPLIER"] },
  { label: "Chambers", href: "/chambers", icon: Warehouse, roles: ["ADMIN", "MANAGER", "STAFF"] },
  { label: "Withdrawals", href: "/withdrawals", icon: ClipboardList, roles: ["ADMIN", "MANAGER", "STAFF", "BUYER"] },
  { label: "Dispatch", href: "/dispatch", icon: Truck, roles: ["ADMIN", "MANAGER", "STAFF", "BUYER"] },
  { label: "Alerts", href: "/alerts", icon: AlertTriangle, roles: ["ADMIN", "MANAGER", "STAFF", "SUPPLIER"] },
  { label: "Rent", href: "/rent", icon: FileBarChart, roles: ["ADMIN", "MANAGER", "SUPPLIER"] },
  { label: "Payments", href: "/payments", icon: WalletCards, roles: ["ADMIN", "MANAGER", "SUPPLIER"] },
  { label: "Staff Tasks", href: "/staff-tasks", icon: PackageCheck, roles: ["ADMIN", "MANAGER", "STAFF"] },
  { label: "Reports", href: "/reports", icon: FileBarChart, roles: ["ADMIN", "MANAGER"] },
  { label: "Audit Logs", href: "/audit-logs", icon: FileClock, roles: ["ADMIN", "MANAGER"] },
  { label: "Users", href: "/users", icon: Users, roles: ["ADMIN"] },
]

function WarehouseSidebar({ role }: { role: WarehouseRole }) {
  const pathname = usePathname()
  const { logout } = useAuth()
  const { setOpenMobile, isMobile } = useSidebar()
  const visibleItems = navigation.filter((item) => item.roles.includes(role))

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  // Split into Workspace vs Administration groups logically
  const workspaceItems = visibleItems.filter((item) =>
    ["Dashboard", "Inventory", "Chambers", "Withdrawals", "Dispatch", "Alerts", "Rent", "Payments", "Staff Tasks"].includes(item.label)
  )
  const adminItems = visibleItems.filter((item) =>
    ["Reports", "Audit Logs", "Users"].includes(item.label)
  )

  const isItemActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/"
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="brand-mark"><Warehouse /></div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold tracking-wide">NORTHSTAR WMS</p>
            <p className="truncate text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/55">Operations center</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {workspaceItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workspaceItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      render={<Link href={item.href} onClick={handleNavClick} />}
                      isActive={isItemActive(item.href)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                      {item.label === "Alerts" && (
                        <span className="ml-auto size-1.5 rounded-full bg-amber-300 group-data-[collapsible=icon]:hidden" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      render={<Link href={item.href} onClick={handleNavClick} />}
                      isActive={isItemActive(item.href)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" onClick={() => logout()}>
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function RoleBasedDashboard({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const [overview, setOverview] = React.useState<any>(null)
  const [revenueTrend, setRevenueTrend] = React.useState<any[]>([])
  const [recentAlerts, setRecentAlerts] = React.useState<any[]>([])
  const [recentDispatches, setRecentDispatches] = React.useState<any[]>([])
  const [chambersList, setChambersList] = React.useState<any[]>([])
  const [loadingDashboard, setLoadingDashboard] = React.useState(true)

  React.useEffect(() => {
    let active = true

    async function loadData() {
      try {
        setLoadingDashboard(true)
        const canViewFinancials = user.role === "ADMIN" || user.role === "MANAGER"

        const promises: Promise<any>[] = [
          api.get("/batches?limit=10").catch(() => ({ data: { data: [] } })),
          api.get("/alerts?limit=5").catch(() => ({ data: { data: [] } })),
          api.get("/reports/overview").catch(() => ({ data: { data: null } })),
          api.get("/chambers").catch(() => ({ data: { data: [] } })),
        ]

        if (canViewFinancials) {
          promises.push(api.get("/reports/revenue?months=6").catch(() => ({ data: { data: [] } })))
          promises.push(api.get("/dispatches?limit=5").catch(() => ({ data: { data: [] } })))
        }

        const results = await Promise.all(promises)
        if (!active) return

        const overviewData = results[2]?.data?.data
        setOverview(overviewData)
        setChambersList(results[3]?.data?.data || [])

        if (canViewFinancials) {
          setRevenueTrend(results[4]?.data?.data || [])
          setRecentDispatches(results[5]?.data?.data || [])
        }
        setRecentAlerts(results[1]?.data?.data || [])
      } catch (err) {
        console.error("Dashboard data load error:", err)
      } finally {
        if (active) setLoadingDashboard(false)
      }
    }

    // Only load general manager stats if role needs them
    if (user.role === "MANAGER" || user.role === "ADMIN") {
      loadData()
    } else {
      setLoadingDashboard(false)
    }

    return () => { active = false }
  }, [user])

  switch (user.role) {
    case "ADMIN":
      return <AdminDashboard user={user} />
    case "MANAGER":
      return (
        <ManagerDashboard
          user={user}
          overview={overview}
          chambersList={chambersList}
          revenueTrend={revenueTrend}
          recentDispatches={recentDispatches}
          recentAlerts={recentAlerts}
          loading={loadingDashboard}
        />
      )
    case "STAFF":
      return <StaffDashboard user={user} />
    case "SUPPLIER":
      return <SupplierDashboard user={user} />
    case "BUYER":
      return <BuyerDashboard user={user} />
    default:
      return null
  }
}

export function WarehouseShell({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading: authLoading, logout } = useAuth()

  // Redirect to login if unauthenticated once auth check finishes
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, user, router])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-primary">
        <div className="flex flex-col items-center gap-3">
          <Warehouse className="size-8 animate-pulse text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Authenticating session...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const role = user.role
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U"

  const pageTitle = pathname.startsWith("/inventory")
    ? "Inventory"
    : pathname.startsWith("/chambers")
    ? "Chambers"
    : pathname.startsWith("/withdrawals")
    ? "Withdrawals"
    : pathname.startsWith("/dispatch")
    ? "Dispatch"
    : pathname.startsWith("/alerts")
    ? "Alerts"
    : pathname.startsWith("/rent")
    ? "Rent"
    : pathname.startsWith("/payments")
    ? "Payments"
    : pathname.startsWith("/staff-tasks")
    ? "Staff Tasks"
    : pathname.startsWith("/reports")
    ? "Reports"
    : pathname.startsWith("/audit-logs")
    ? "Audit Logs"
    : pathname.startsWith("/users")
    ? "Users"
    : "Dashboard"

  return (
    <SidebarProvider defaultOpen>
      <WarehouseSidebar role={role} />
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur md:px-7">
          <SidebarTrigger className="-ml-1" aria-label="Toggle navigation">
            <PanelLeft />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-1 h-5" />
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">Workspace</span>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="truncate font-semibold text-primary">{pageTitle}</span>
          </div>

          <Button variant="ghost" className="gap-2 px-2" onClick={() => logout()} title="Click to sign out">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-left text-sm md:block">
              <span className="block font-semibold">{user.name}</span>
              <span className="block text-[11px] text-muted-foreground">{user.role}</span>
            </span>
            <LogOut className="hidden size-4 text-muted-foreground md:block" />
          </Button>
        </header>

        {children && pathname !== "/" && pathname !== "/dashboard" ? (
          <main className="flex-1 min-w-0">{children}</main>
        ) : (
          <main className="flex-1 min-w-0 p-4 md:p-7">
            <RoleBasedDashboard user={user} />
          </main>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

export const roleNavigation = navigation
