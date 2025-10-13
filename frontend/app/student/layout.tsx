import type React from "react"
import { StudentSidebar } from "@/components/student-sidebar"

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <StudentSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
