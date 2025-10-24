"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Briefcase, FileText, User, Home, Sparkles, LogOut, Bot } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

export function StudentSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Logout failed")
      }

      toast({
        title: "Logged out successfully",
        description: "See you next time!",
      })

      router.push("/login")
      router.refresh()
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const navItems = [
    { href: "/student/dashboard", icon: Briefcase, label: "Job Search" },
    { href: "/student/applications", icon: FileText, label: "My Applications" },
    { href: "/student/interview-assistant", icon: Bot, label: "Interview Assistant" },
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
        <Button 
          variant="destructive" 
          className="w-full justify-start" 
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </div>
  )
}
