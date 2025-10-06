"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AllApplicantsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock loading
    setTimeout(() => setLoading(false), 500)
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">All Applicants</h1>
        <p className="text-muted-foreground">View applicants across all your job postings</p>
      </div>

      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">View applicants by selecting a specific job</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
