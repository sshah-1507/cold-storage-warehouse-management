import axios, { AxiosError } from "axios"

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

export const api = axios.create({
  baseURL,
  withCredentials: true, // Send and receive HTTP-only session cookies (connect.sid)
  headers: {
    "Content-Type": "application/json",
  },
})

// Response interceptor to format errors and handle expired sessions (401)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { code?: string; message?: string }; message?: string }>) => {
    // If unauthenticated (401) and not already on the login page, redirect to login
    if (error.response?.status === 401) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?expired=1"
      }
    }
    return Promise.reject(error)
  }
)

export function getErrorMessage(err: unknown, fallback = "An unexpected error occurred."): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (data?.error?.message) return data.error.message
    if (data?.message) return data.message
    if (err.message) return err.message
  }
  if (err instanceof Error) return err.message
  return fallback
}

export default api
