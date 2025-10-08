"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function StudentLoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) return "Email is required"
    if (!emailRegex.test(email)) return "Please enter a valid email address"
    return ""
  }

  const validatePassword = (password: string) => {
    if (!password) return "Password is required"
    return ""
  }

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true })
    const newErrors = { ...errors }
    if (field === "email") {
      const error = validateEmail(formData.email)
      if (error) newErrors.email = error
      else delete newErrors.email
    }
    if (field === "password") {
      const error = validatePassword(formData.password)
      if (error) newErrors.password = error
      else delete newErrors.password
    }
    setErrors(newErrors)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    if (errors[field]) {
      const newErrors = { ...errors }
      delete newErrors[field]
      setErrors(newErrors)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}
    const emailError = validateEmail(formData.email)
    if (emailError) newErrors.email = emailError
    const passwordError = validatePassword(formData.password)
    if (passwordError) newErrors.password = passwordError

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setTouched({ email: true, password: true })
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, expectedRole: "student" }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Login failed")
      }

      // Check if user has student role
      if (data.user.role !== "student") {
        throw new Error("This account is not registered as a student. Please use recruiter login.")
      }

      toast({
        title: "Welcome back! 🎓",
        description: "Logging you into your student dashboard",
      })

      router.push("/student/dashboard")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Login failed"
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      })
      if (errorMessage.includes("email") || errorMessage.includes("credentials")) {
        setErrors({ email: errorMessage, password: "Please check your credentials" })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/10 to-background p-4">
      <Card className="w-full max-w-md border-border shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
            <GraduationCap className="h-6 w-6 text-blue-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Student Login</CardTitle>
          <CardDescription>Sign in to your student account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="student@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                required
                className={`bg-secondary/50 ${touched.email && errors.email ? "border-red-500" : ""}`}
              />
              {touched.email && errors.email && (
                <div className="flex items-center gap-2 text-sm text-red-500 mt-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.email}</span>
                </div>
              )}
              {touched.email && !errors.email && formData.email && (
                <div className="flex items-center gap-2 text-sm text-green-500 mt-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Valid email</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  onBlur={() => handleBlur("password")}
                  required
                  className={`bg-secondary/50 pr-10 ${touched.password && errors.password ? "border-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {touched.password && errors.password && (
                <div className="flex items-center gap-2 text-sm text-red-500 mt-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.password}</span>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In as Student"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">{"Don't have a student account? "}</span>
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
          
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">{"Are you a recruiter? "}</span>
            <Link href="/recruiter/login" className="text-primary hover:underline">
              Recruiter login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
