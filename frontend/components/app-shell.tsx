"use client"

import { usePathname } from "next/navigation"
import { WarehouseShell } from "@/components/warehouse-shell"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"

  if (isLoginPage) {
    return <>{children}</>
  }

  return <WarehouseShell>{children}</WarehouseShell>
}
