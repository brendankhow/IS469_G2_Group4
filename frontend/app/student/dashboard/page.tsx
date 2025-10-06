"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { MapPin, DollarSign, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface Job {
  id: number
  title: string
  description: string
  requirements?: string
  location?: string
  salary_range?: string
  recruiter_id: number
  created_at: string
}

export default function StudentDashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobs, setSelectedJobs] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs")
      const data = await response.json()
      setJobs(data.jobs)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load jobs",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleJobSelection = (jobId: number) => {
    setSelectedJobs((prev) => {
      if (prev.includes(jobId)) {
        return prev.filter((id) => id !== jobId)
      } else if (prev.length < 5) {
        return [...prev, jobId]
      } else {
        toast({
          title: "Limit Reached",
          description: "You can only select up to 5 jobs at a time",
          variant: "destructive",
        })
        return prev
      }
    })
  }

  const handleGenerateCoverLetters = () => {
    if (selectedJobs.length === 0) {
      toast({
        title: "No Jobs Selected",
        description: "Please select at least one job",
        variant: "destructive",
      })
      return
    }
    router.push(`/student/cover-letters?jobs=${selectedJobs.join(",")}`)
  }

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
        <h1 className="mb-2 text-3xl font-bold">Browse Jobs</h1>
        <p className="text-muted-foreground">Select up to 5 jobs to generate AI-powered cover letters</p>
      </div>

      {/* Selection Counter */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Selected:</span>
          <Badge variant="default" className="bg-primary">
            {selectedJobs.length} / 5
          </Badge>
        </div>
        <Button onClick={handleGenerateCoverLetters} disabled={selectedJobs.length === 0}>
          Generate Cover Letters
        </Button>
      </div>

      {/* Jobs Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => {
          const isSelected = selectedJobs.includes(job.id)
          return (
            <Card
              key={job.id}
              className={`cursor-pointer transition-all ${
                isSelected ? "border-primary bg-primary/5 shadow-lg shadow-primary/20" : "hover:border-primary/50"
              }`}
              onClick={() => toggleJobSelection(job.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{job.title}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">{job.description}</CardDescription>
                  </div>
                  <Checkbox checked={isSelected} className="ml-2" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {job.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </div>
                )}
                {job.salary_range && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    {job.salary_range}
                  </div>
                )}
                {job.requirements && (
                  <div className="mt-2 rounded-md bg-secondary/50 p-2 text-xs text-muted-foreground">
                    <strong>Requirements:</strong> {job.requirements}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {jobs.length === 0 && (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">No jobs available at the moment</p>
        </div>
      )}
    </div>
  )
}
