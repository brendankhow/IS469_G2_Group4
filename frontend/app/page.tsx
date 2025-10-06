"use client"
import { Button } from "@/components/ui/button"
import { Sparkles, Users, Calendar, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState<"student" | "recruiter" | null>(null)

  const handleLogin = async (role: "student" | "recruiter") => {
    setLoading(role)
    try {
      const response = await fetch("/api/simple-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })

      if (response.ok) {
        router.push(role === "student" ? "/student/dashboard" : "/recruiter/dashboard")
      }
    } catch (error) {
      console.error("Login failed:", error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">HireAI</span>
          </div>
          {/* Removed the navigation buttons from the header */}
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-balance text-5xl font-bold leading-tight md:text-6xl">
            AI-Powered Hiring Platform for the <span className="text-primary">Future</span>
          </h1>
          <p className="mb-8 text-pretty text-lg text-muted-foreground md:text-xl">
            Connect students and recruiters with dynamic resumes, AI-driven cover letters, intelligent candidate
            matching, and automated interview scheduling.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => handleLogin("student")}
              disabled={loading !== null}
            >
              {loading === "student" ? "Logging in..." : "Login as Student"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto bg-transparent"
              onClick={() => handleLogin("recruiter")}
              disabled={loading !== null}
            >
              {loading === "recruiter" ? "Logging in..." : "Login as Recruiter"}
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto mt-24 grid max-w-5xl gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-6 shadow-lg">
            <FileText className="mb-4 h-10 w-10 text-primary" />
            <h3 className="mb-2 text-lg font-semibold">Dynamic Resumes</h3>
            <p className="text-sm text-muted-foreground">
              Upload and showcase your resume with interactive AI-powered storytelling
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-lg">
            <Sparkles className="mb-4 h-10 w-10 text-primary" />
            <h3 className="mb-2 text-lg font-semibold">AI Cover Letters</h3>
            <p className="text-sm text-muted-foreground">
              Generate personalized cover letters instantly with AI assistance
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-lg">
            <Users className="mb-4 h-10 w-10 text-primary" />
            <h3 className="mb-2 text-lg font-semibold">Smart Matching</h3>
            <p className="text-sm text-muted-foreground">
              AI-powered candidate matching based on skills and job requirements
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-lg">
            <Calendar className="mb-4 h-10 w-10 text-primary" />
            <h3 className="mb-2 text-lg font-semibold">Auto Scheduling</h3>
            <p className="text-sm text-muted-foreground">
              Seamless interview scheduling with Google Calendar integration
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 HireAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
