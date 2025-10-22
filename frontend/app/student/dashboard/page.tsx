"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MapPin, DollarSign, Loader2, AlertTriangle, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import ReactMarkdown from "react-markdown"

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

export default function StudentDashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showResumeAlert, setShowResumeAlert] = useState(false)
  const [hasResume, setHasResume] = useState(false)
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set())
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    checkResumeAndFetchJobs()
  }, [])

  const checkResumeAndFetchJobs = async () => {
    try {
      // Check if user has uploaded a resume and filled all mandatory fields
      const profileResponse = await fetch("/api/auth/me")
      const profileData = await profileResponse.json()
      
      const isProfileComplete = !!(
        profileData.user?.resume_url &&
        profileData.user?.name?.trim() &&
        profileData.user?.phone?.trim() &&
        profileData.user?.skills?.trim() &&
        profileData.user?.hobbies?.trim()
      )
      
      if (!isProfileComplete) {
        setHasResume(false)
        setShowResumeAlert(true)
        setLoading(false)
        return
      }

      setHasResume(true)
      
      // Store user ID for feedback
      setCurrentUserId(profileData.user.id)
      
      // Fetch applications to determine which jobs are already applied to
      await fetchApplications()
      
      // Fetch jobs only if resume exists
      await fetchJobs()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

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

  const fetchApplications = async () => {
    try {
      const response = await fetch("/api/applications")
      const data = await response.json()
      // Extract job IDs from applications
      const appliedIds = new Set<string>()
      data.applications.forEach((app: { job_id: string }) => {
        appliedIds.add(app.job_id)
      })
      setAppliedJobIds(appliedIds)
    } catch (error) {
      // Silently fail - applications are not critical for job browsing
      console.error("Failed to fetch applications:", error)
    }
  }

  const toggleJobSelection = (jobId: string) => {
    // Prevent selecting jobs already applied to
    if (appliedJobIds.has(jobId)) {
      toast({
        title: "Already Applied",
        description: "You have already applied to this job",
        variant: "destructive",
      })
      return
    }

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

  const handleGetFeedback = async (forceRefresh = false) => {
    if (!currentUserId) {
      toast({
        title: "Error",
        description: "User ID not found",
        variant: "destructive",
      })
      return
    }

    // Check if we have cached feedback in session storage and not forcing refresh
    if (!forceRefresh) {
      const cachedFeedback = sessionStorage.getItem('resumeFeedback')
      if (cachedFeedback) {
        setFeedback(cachedFeedback)
        setFeedbackOpen(true)
        return
      }
    }

    // If no cache or forcing refresh, fetch new feedback
    setLoadingFeedback(true)
    setFeedbackOpen(true)
    setFeedback(null)

    try {
      const formData = new FormData()
      formData.append("student_id", currentUserId)

      const response = await fetch("http://localhost:8000/student/feedback", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.detail || "Failed to get feedback"
        
        // Show error in the feedback dialog instead of closing it
        setFeedback(`## ⚠️ Error\n\n**Unable to generate feedback at this time.**\n\n${errorMessage}\n\n**Possible reasons:**\n- Your resume may not have been processed yet. Please try uploading it again from your profile.\n- The AI service may be temporarily unavailable.\n\n**What to do:**\n1. Go to your Profile page\n2. Re-upload your resume\n3. Wait a few moments for processing\n4. Try again\n\nIf the problem persists, please contact support.`)
        
        toast({
          title: "Error",
          description: "Failed to generate feedback. Please try again later.",
          variant: "destructive",
        })
        return
      }

      const data = await response.json()
      setFeedback(data.feedback)
      // Store feedback in session storage
      sessionStorage.setItem('resumeFeedback', data.feedback)
    } catch (error) {
      // Network or other errors
      setFeedback(`## ⚠️ Connection Error\n\n**Unable to reach the feedback service.**\n\nPlease check your internet connection and try again later.\n\nIf the problem persists, please contact support.`)
      
      toast({
        title: "Error",
        description: "Failed to generate feedback. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setLoadingFeedback(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Show alert dialog if no resume
  if (!hasResume && showResumeAlert) {
    return (
      <>
        <AlertDialog open={showResumeAlert} onOpenChange={setShowResumeAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Complete Your Profile
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base space-y-3">
                <p>You need to complete your profile before you can browse and apply for jobs.</p>
                <div className="mt-3">
                  <p className="font-medium text-foreground mb-2">Required fields:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Full Name</li>
                    <li>Phone Number</li>
                    <li>Skills</li>
                    <li>Hobbies</li>
                    <li>Resume (PDF)</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    GitHub Username and TikTok Handle are optional.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => router.push("/student/applications")}>
                Go to Applications
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => router.push("/student/profile")}>
                Complete Profile
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <div className="p-8">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold">Browse Jobs</h1>
            <p className="text-muted-foreground">Complete your profile to start browsing jobs</p>
          </div>
          
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                Resume Required
              </CardTitle>
              <CardDescription>
                Please upload your resume in your profile to access job listings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/student/profile")}>
                Go to Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleGetFeedback(false)}>
            <FileText className="mr-2 h-4 w-4" />
            Get Resume Feedback
          </Button>
          <Button onClick={handleGenerateCoverLetters} disabled={selectedJobs.length === 0}>
            Generate Cover Letters
          </Button>
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => {
          const isSelected = selectedJobs.includes(job.id)
          const isApplied = appliedJobIds.has(job.id)
          return (
            <Card
              key={job.id}
              className={`cursor-pointer transition-all ${
                isSelected ? "border-primary bg-primary/5 shadow-lg shadow-primary/20" : 
                isApplied ? "border-green-500/50 bg-green-500/5" :
                "hover:border-primary/50"
              }`}
              onClick={() => !isApplied && toggleJobSelection(job.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{job.title}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">{job.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isApplied && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        Applied
                      </Badge>
                    )}
                    {!isApplied && <Checkbox checked={isSelected} className="ml-2" />}
                  </div>
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

      {/* Feedback Dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Resume Feedback</DialogTitle>
            <DialogDescription>
              AI-powered analysis of your resume
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            {loadingFeedback ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Analyzing your resume...</span>
              </div>
            ) : feedback ? (
              <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => <h1 className="mt-6 mb-3" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="mt-6 mb-3" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="mt-5 mb-2" {...props} />,
                    h4: ({ node, ...props }) => <h4 className="mt-4 mb-2" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-3" {...props} />,
                    ul: ({ node, ...props }) => <ul className="mb-3 space-y-1" {...props} />,
                    ol: ({ node, ...props }) => <ol className="mb-3 space-y-1" {...props} />,
                  }}
                >
                  {feedback}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground">No feedback available</p>
            )}
          </ScrollArea>
          {!loadingFeedback && feedback && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => handleGetFeedback(true)}
                disabled={loadingFeedback}
              >
                <FileText className="mr-2 h-4 w-4" />
                Reanalyze Resume
              </Button>
              <Button onClick={() => setFeedbackOpen(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
