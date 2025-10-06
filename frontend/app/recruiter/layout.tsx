import type React from "react"
import { RecruiterSidebar } from "@/components/recruiter-sidebar"

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <RecruiterSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
