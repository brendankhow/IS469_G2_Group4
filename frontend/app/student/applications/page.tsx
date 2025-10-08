"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, MapPin, DollarSign } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Application {
  id: number
  student_id: number
  job_id: number
  status: "pending" | "accepted" | "rejected"
  created_at: string
  job_title?: string
  location?: string
  salary_range?: string
  cover_letter?: string
}

interface Job {
  id: string
  title: string
  description: string
  requirements?: string
  location?: string
  salary_range?: string
  recruiter_id: string
  created_at: string
}

export default function ApplicationsPage() {
  const { toast } = useToast()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [jobDetailsLoading, setJobDetailsLoading] = useState(false)

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      const response = await fetch("/api/applications")
      const data = await response.json()
      setApplications(data.applications)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load applications",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchJobDetails = async (jobId: number) => {
    setJobDetailsLoading(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}`)
      const data = await response.json()
      setSelectedJob(data.job)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load job details",
        variant: "destructive",
      })
    } finally {
      setJobDetailsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "rejected":
        return "bg-destructive/10 text-destructive border-destructive/20"
      default:
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    }
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
        <h1 className="mb-2 text-3xl font-bold">My Applications</h1>
        <p className="text-muted-foreground">Track the status of your job applications</p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No applications yet</p>
              <p className="mt-2 text-sm text-muted-foreground">Start browsing jobs to apply</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {applications.map((application) => (
            <Card key={application.id} className="hover:border-primary/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{application.job_title}</CardTitle>
                    <CardDescription className="mt-1">
                      Applied {new Date(application.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(application.status)}>{application.status.toUpperCase()}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {application.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {application.location}
                  </div>
                )}
                {application.salary_range && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    {application.salary_range}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setSelectedApplication(application)}
                  >
                    View Cover Letter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => fetchJobDetails(application.job_id)}
                  >
                    View Job Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cover Letter Modal */}
      {selectedApplication && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setSelectedApplication(null)}
        >
          <Card className="max-h-[80vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>{selectedApplication.job_title}</CardTitle>
              <CardDescription>Your cover letter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-lg bg-secondary/50 p-4 font-mono text-sm">
                {selectedApplication.cover_letter || "No cover letter available"}
              </div>
              <Button className="mt-4 w-full" onClick={() => setSelectedApplication(null)}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setSelectedJob(null)}
        >
          <Card className="max-h-[80vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>{selectedJob.title}</CardTitle>
              <CardDescription>Job Details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{selectedJob.description}</p>
              </div>

              {selectedJob.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>{selectedJob.location}</span>
                </div>
              )}

              {selectedJob.salary_range && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4" />
                  <span>{selectedJob.salary_range}</span>
                </div>
              )}

              {selectedJob.requirements && (
                <div>
                  <h4 className="font-semibold mb-2">Requirements</h4>
                  <p className="text-sm text-muted-foreground">{selectedJob.requirements}</p>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Posted on {new Date(selectedJob.created_at).toLocaleDateString()}
              </div>

              <Button className="mt-4 w-full" onClick={() => setSelectedJob(null)}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
