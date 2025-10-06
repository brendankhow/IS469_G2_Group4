"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Briefcase, Users, Home, User, Sparkles } from "lucide-react"

export function RecruiterSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleSwitchView = async () => {
    await fetch("/api/simple-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "student" }),
    })
    router.push("/student/dashboard")
    router.refresh()
  }

  const navItems = [
    { href: "/recruiter/dashboard", icon: Briefcase, label: "My Jobs" },
    { href: "/recruiter/post-job", icon: Briefcase, label: "Post Job" },
    { href: "/recruiter/applicants", icon: Users, label: "All Applicants" },
  ]

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Sparkles className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold">HireAI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start ${isActive ? "bg-primary text-primary-foreground" : ""}`}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* Footer Actions */}
      <div className="border-t border-border p-4 space-y-2">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start">
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>
        </Link>
        <Button variant="outline" className="w-full justify-start bg-transparent" onClick={handleSwitchView}>
          <User className="mr-2 h-4 w-4" />
          Switch to Student
        </Button>
      </div>
    </div>
  )
}
