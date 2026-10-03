"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import api, { getErrorMessage } from "./api"

export type UserRole = "ADMIN" | "MANAGER" | "STAFF" | "SUPPLIER" | "BUYER"

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

type AuthContextType = {
  user: CurrentUser | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<CurrentUser>
  logout: () => Promise<void>
  refreshUser: () => Promise<CurrentUser | null>
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = React.useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)

  const refreshUser = React.useCallback(async (): Promise<CurrentUser | null> => {
    try {
      const res = await api.get<{ data: CurrentUser }>("/auth/me")
      setUser(res.data.data)
      setError(null)
      return res.data.data
    } catch {
      setUser(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = async (email: string, password: string): Promise<CurrentUser> => {
    setError(null)
    try {
      const res = await api.post<{ data: CurrentUser }>("/auth/login", { email, password })
      setUser(res.data.data)
      return res.data.data
    } catch (err) {
      const msg = getErrorMessage(err, "Invalid email or password.")
      setError(msg)
      throw new Error(msg)
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await api.post("/auth/logout")
    } catch (err) {
      console.error("Logout error:", err)
    } finally {
      setUser(null)
      router.push("/login")
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
