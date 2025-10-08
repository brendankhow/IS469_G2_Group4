"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Eye, EyeOff, GraduationCap, Briefcase, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SignupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<"student" | "recruiter" | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    hobbies: "",
    skills: "",
  })

  // Validation functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) return "Email is required"
    if (!emailRegex.test(email)) return "Please enter a valid email address"
    return ""
  }

  const validatePassword = (password: string) => {
    if (!password) return "Password is required"
    if (password.length < 6) return "Password must be at least 6 characters"
    return ""
  }

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true })
    
    // Validate on blur
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
    
    // Clear error when user starts typing
    if (errors[field]) {
      const newErrors = { ...errors }
      delete newErrors[field]
      setErrors(newErrors)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all fields
    const newErrors: Record<string, string> = {}
    
    if (!selectedRole) {
      toast({
        title: "Role Required",
        description: "Please select whether you're a student or recruiter",
        variant: "destructive",
      })
      return
    }

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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, role: selectedRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
      }

      toast({
        title: "Success! 🎉",
        description: data.message || "Account created successfully",
      })

      // Redirect based on role
      const dashboardUrl = selectedRole === "student" ? "/student/dashboard" : "/recruiter/dashboard"
      router.push(dashboardUrl)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Signup failed"
      
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      })
      
      // Set specific field errors if possible
      if (errorMessage.includes("email")) {
        setErrors({ ...errors, email: errorMessage })
      } else if (errorMessage.includes("password")) {
        setErrors({ ...errors, password: errorMessage })
      }
    } finally {
      setLoading(false)
    }
  }

  const getPasswordStrength = (password: string) => {
    if (!password) return null
    if (password.length < 6) return { text: "Too short", color: "text-red-500" }
    if (password.length < 8) return { text: "Fair", color: "text-yellow-500" }
    if (password.length < 12) return { text: "Good", color: "text-blue-500" }
    return { text: "Strong", color: "text-green-500" }
  }

  const passwordStrength = getPasswordStrength(formData.password)

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/10 to-background p-4">
      <Card className="w-full max-w-md border-border shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Join HireAI and start your journey</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label>I am a</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole("student")}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                    selectedRole === "student"
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                      : "border-border bg-secondary/50 hover:border-primary/50"
                  }`}
                >
                  <GraduationCap
                    className={`h-8 w-8 ${selectedRole === "student" ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="font-medium">Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("recruiter")}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                    selectedRole === "recruiter"
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                      : "border-border bg-secondary/50 hover:border-primary/50"
                  }`}
                >
                  <Briefcase
                    className={`h-8 w-8 ${selectedRole === "recruiter" ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="font-medium">Recruiter</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
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
              
              {/* Password requirements */}
              {formData.password && (
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-2 text-xs">
                    {formData.password.length >= 6 ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-gray-400" />
                    )}
                    <span className={formData.password.length >= 6 ? "text-green-500" : "text-gray-500"}>
                      At least 6 characters
                    </span>
                  </div>
                  {passwordStrength && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Strength:</span>
                      <span className={passwordStrength.color + " font-medium"}>
                        {passwordStrength.text}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {touched.password && errors.password && (
                <div className="flex items-center gap-2 text-sm text-red-500 mt-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.password}</span>
                </div>
              )}
            </div>

            {selectedRole === "student" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="skills">Skills (optional)</Label>
                  <Input
                    id="skills"
                    type="text"
                    placeholder="JavaScript, React, Node.js"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hobbies">Hobbies (optional)</Label>
                  <Input
                    id="hobbies"
                    type="text"
                    placeholder="Reading, Hiking, Photography"
                    value={formData.hobbies}
                    onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
