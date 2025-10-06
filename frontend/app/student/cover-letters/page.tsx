"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sparkles, Send } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Job {
  id: number
  title: string
  description: string
  requirements?: string
  location?: string
  salary_range?: string
}

interface CoverLetter {
  jobId: number
  content: string
  isGenerating: boolean
}

function CoverLettersContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showChatbot, setShowChatbot] = useState<number | null>(null)

  useEffect(() => {
    const jobIds = searchParams.get("jobs")?.split(",").map(Number) || []
    if (jobIds.length === 0) {
      router.push("/student/dashboard")
      return
    }
    fetchJobsAndGenerateCoverLetters(jobIds)
  }, [searchParams])

  const fetchJobsAndGenerateCoverLetters = async (jobIds: number[]) => {
    try {
      const response = await fetch("/api/jobs")
      const data = await response.json()
      const selectedJobs = data.jobs.filter((job: Job) => jobIds.includes(job.id))
      setJobs(selectedJobs)

      // Initialize cover letters
      const initialCoverLetters = selectedJobs.map((job: Job) => ({
        jobId: job.id,
        content: "",
        isGenerating: true,
      }))
      setCoverLetters(initialCoverLetters)

      // Generate cover letters one by one
      for (const job of selectedJobs) {
        await generateCoverLetter(job)
      }
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

  const generateCoverLetter = async (job: Job) => {
    try {
      // Mock AI generation - simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const mockCoverLetter = `Dear Hiring Manager,

I am writing to express my strong interest in the ${job.title} position at your company. With my background in software development and passion for creating innovative solutions, I believe I would be an excellent fit for this role.

${job.requirements ? `I have experience with ${job.requirements}, which aligns perfectly with your requirements.` : ""}

In my free time, I enjoy exploring new technologies and contributing to open-source projects. I am excited about the opportunity to bring my skills and enthusiasm to your team.

Thank you for considering my application. I look forward to discussing how I can contribute to your organization.

Best regards,
[Your Name]`

      setCoverLetters((prev) =>
        prev.map((cl) => (cl.jobId === job.id ? { ...cl, content: mockCoverLetter, isGenerating: false } : cl)),
      )
    } catch (error) {
      console.error("Cover letter generation error:", error)
      setCoverLetters((prev) =>
        prev.map((cl) =>
          cl.jobId === job.id ? { ...cl, content: "Failed to generate cover letter", isGenerating: false } : cl,
        ),
      )
    }
  }

  const updateCoverLetter = (jobId: number, content: string) => {
    setCoverLetters((prev) => prev.map((cl) => (cl.jobId === jobId ? { ...cl, content } : cl)))
  }

  const handleSubmitAll = async () => {
    setSubmitting(true)
    try {
      // Submit applications for all jobs
      for (const coverLetter of coverLetters) {
        const formData = new FormData()
        formData.append("jobId", coverLetter.jobId.toString())
        formData.append("coverLetter", coverLetter.content)

        await fetch("/api/applications", {
          method: "POST",
          body: formData,
        })
      }

      toast({
        title: "Success",
        description: "Applications submitted successfully",
      })

      router.push("/student/applications")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit applications",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
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
        <h1 className="mb-2 text-3xl font-bold">AI-Generated Cover Letters</h1>
        <p className="text-muted-foreground">Review and edit your cover letters before submitting</p>
      </div>

      <div className="space-y-6">
        {jobs.map((job) => {
          const coverLetter = coverLetters.find((cl) => cl.jobId === job.id)
          return (
            <Card key={job.id}>
              <CardHeader>
                <CardTitle>{job.title}</CardTitle>
                <CardDescription>{job.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {coverLetter?.isGenerating ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
                    <span className="text-muted-foreground">Generating cover letter with AI...</span>
                  </div>
                ) : (
                  <>
                    <Textarea
                      value={coverLetter?.content || ""}
                      onChange={(e) => updateCoverLetter(job.id, e.target.value)}
                      rows={12}
                      className="bg-secondary/50 font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowChatbot(showChatbot === job.id ? null : job.id)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Refine with AI
                    </Button>

                    {showChatbot === job.id && (
                      <div className="rounded-lg border border-primary/50 bg-secondary/30 p-4">
                        <p className="mb-2 text-sm font-medium">AI Assistant</p>
                        <p className="text-xs text-muted-foreground">
                          Mock chatbot interface - In production, this would connect to OpenAI API for real-time
                          refinements
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleSubmitAll} disabled={submitting || coverLetters.some((cl) => cl.isGenerating)} size="lg">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Submit All Applications
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default function CoverLettersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CoverLettersContent />
    </Suspense>
  )
}
