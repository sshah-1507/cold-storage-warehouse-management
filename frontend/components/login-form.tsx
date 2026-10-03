"use client"

import * as React from "react"
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, Mail, Warehouse } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"

export function LoginForm() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [rememberMe, setRememberMe] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.")
      return
    }
    setIsLoading(true)
    try {
      await login(email.trim(), password)
      router.push("/dashboard")
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to sign in.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-brand">
          <div className="brand-mark">
            <Warehouse />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary">NORTHSTAR WMS</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Operations center</p>
          </div>
        </div>

        <div className="mb-8">
          <p className="eyebrow">Secure access</p>
          <h1 id="login-heading" className="mt-2 text-2xl font-semibold tracking-tight text-primary">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to manage inventory, dispatches, and warehouse operations.
          </p>
        </div>

        <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium text-primary">
              Work email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error)}
                className="h-11 pl-10"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-primary">
                Password
              </label>
            </div>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)}
                className="h-11 px-10"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <AlertCircle className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="size-4 accent-primary"
            />
            Keep me signed in
          </label>

          <Button type="submit" disabled={isLoading} className="h-11 w-full">
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" data-icon="inline-start" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </section>

      <aside className="login-aside">
        <div className="max-w-md">
          <p className="eyebrow text-sidebar-foreground/60">Warehouse operations</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-sidebar-foreground">
            Everything in motion, under control.
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-sidebar-foreground/70">
            A single operational view for inventory, cold storage, dispatch, and every team moving goods through your network.
          </p>
          <div className="mt-10 grid gap-3 text-sm text-sidebar-foreground/80">
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-teal-300" />
              Real-time inventory visibility
            </div>
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-amber-300" />
              Real role-based workspaces
            </div>
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-sky-300" />
              Auditable transactions & FIFO dispatch
            </div>
          </div>
        </div>
      </aside>
    </main>
  )
}

