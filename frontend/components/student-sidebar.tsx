"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Briefcase, FileText, User, Home, Sparkles } from "lucide-react"

export function StudentSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleSwitchView = async () => {
    await fetch("/api/simple-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "recruiter" }),
    })
    router.push("/recruiter/dashboard")
    router.refresh()
  }

  const navItems = [
    { href: "/student/dashboard", icon: Briefcase, label: "Job Search" },
    { href: "/student/applications", icon: FileText, label: "My Applications" },
    { href: "/student/profile", icon: User, label: "Profile" },
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
          Switch to Recruiter
        </Button>
      </div>
    </div>
  )
}
