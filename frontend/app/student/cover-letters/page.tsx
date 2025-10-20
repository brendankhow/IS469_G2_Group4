"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sparkles, Send } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Job {
  id: string
  title: string
  description: string
  requirements?: string
  location?: string
  salary_range?: string
}

interface CoverLetter {
  jobId: string
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
  const [showChatbot, setShowChatbot] = useState<string | null>(null)
  const [studentProfile, setStudentProfile] = useState<any>(null)

  useEffect(() => {
    const jobIds = searchParams.get("jobs")?.split(",") || []
    if (jobIds.length === 0) {
      router.push("/student/dashboard")
      return
    }
    fetchJobsAndGenerateCoverLetters(jobIds)
  }, [searchParams])

  useEffect(() => {
    console.log('🔵 Cover letters state updated:', coverLetters.length, 'letters')
    coverLetters.forEach((cl, idx) => {
      console.log(`  Letter ${idx + 1}: jobId=${cl.jobId}, isGenerating=${cl.isGenerating}, contentLength=${cl.content.length}`)
    })
  }, [coverLetters])

  useEffect(() => {
    console.log('🔵 Jobs state updated:', jobs.length, 'jobs')
  }, [jobs])


  const fetchJobsAndGenerateCoverLetters = async (jobIds: string[]) => {
      try {
          // --- This part stays the same: get student profile and job details ---
          const profileResponse = await fetch("/api/auth/me");
          const profileData = await profileResponse.json();
          const studentId = profileData.user?.id;

          if (!studentId) {
              throw new Error("Could not find student ID.");
          }

          const jobsResponse = await fetch("/api/jobs");
          const jobsData = await jobsResponse.json();
          const selectedJobsDetails = jobsData.jobs.filter((job: Job) => jobIds.includes(job.id));
          setJobs(selectedJobsDetails);

          // --- This is the key change: One API call to the backend ---

          // 1. Set up the initial "loading" state for all cards
          const initialCoverLetters = selectedJobsDetails.map((job: Job) => ({
              jobId: job.id,
              content: "",
              isGenerating: true,
          }));
          setCoverLetters(initialCoverLetters);

          // 2. Prepare the payload for your real backend
          const payload = {
              student_id: studentId,
              job_ids: jobIds,
          };

          // 3. Make the single, powerful API call
          const generationResponse = await fetch(`http://127.0.0.1:8000/student/generate-cover-letters`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
          });

          if (!generationResponse.ok) {
              throw new Error(`Server responded with status: ${generationResponse.status}`);
          }

          const result = await generationResponse.json();

          // 4. Update the UI with the real, AI-generated cover letters
          const finalCoverLetters = selectedJobsDetails.map((job: Job) => {
              const generated = result.cover_letters.find((cl: any) => cl.job_id === job.id);
              return {
                  jobId: job.id,
                  content: generated ? generated.cover_letter : "Error: Could not generate.",
                  isGenerating: false, // Generation is complete
              };
          });
          setCoverLetters(finalCoverLetters);
          
      } catch (error) {
          console.error('🔴 Error in fetchJobsAndGenerateCoverLetters:', error);
          toast({
              title: "Error",
              description: "Failed to generate cover letters.",
              variant: "destructive",
          });
          // Also update UI to show error state
          setCoverLetters(prev => prev.map(cl => ({...cl, isGenerating: false, content: "Generation failed."})))
      } finally {
          setLoading(false);
      }
  };

  const generateCoverLetter = async (job: Job) => {
    try {
      console.log('🔵 Generating cover letter for job:', job.title)
      
      // Fetch mock cover letter templates
      const response = await fetch('/mock-cover-letters/templates.json')
      console.log('🔵 Template fetch response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.status}`)
      }
      
      const templates = await response.json()
      console.log('🔵 Templates loaded:', Object.keys(templates))
      
      // Simulate AI generation delay
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Determine which template to use based on job title
      let template = templates.default
      const jobTitleLower = job.title.toLowerCase()
      
      console.log('🔵 Job title (lowercase):', jobTitleLower)
      
      if (jobTitleLower.includes('software') || jobTitleLower.includes('developer') || jobTitleLower.includes('engineer')) {
        template = templates.software_engineer
        console.log('🔵 Using software_engineer template')
      } else if (jobTitleLower.includes('data') || jobTitleLower.includes('analyst')) {
        template = templates.data_analyst
        console.log('🔵 Using data_analyst template')
      } else if (jobTitleLower.includes('product') || jobTitleLower.includes('manager')) {
        template = templates.product_manager
        console.log('🔵 Using product_manager template')
      } else if (jobTitleLower.includes('marketing') || jobTitleLower.includes('brand')) {
        template = templates.marketing_specialist
        console.log('🔵 Using marketing_specialist template')
      } else if (jobTitleLower.includes('ux') || jobTitleLower.includes('ui') || jobTitleLower.includes('design')) {
        template = templates.ux_designer
        console.log('🔵 Using ux_designer template')
      } else {
        console.log('🔵 Using default template')
      }

      console.log('🔵 Template length:', template?.length || 0)

      // Customize the template with job details
      let coverLetter = template
      if (job.requirements) {
        coverLetter = coverLetter.replace(
          'Thank you for considering my application.',
          `The position's requirements of ${job.requirements} align well with my skill set and experience.\n\nThank you for considering my application.`
        )
      }

      console.log('✅ Cover letter generated, length:', coverLetter.length)

      setCoverLetters((prev) =>
        prev.map((cl) => (cl.jobId === job.id ? { ...cl, content: coverLetter, isGenerating: false } : cl)),
      )
    } catch (error) {
      console.error("🔴 Cover letter generation error:", error)
      
      // Fallback cover letter if JSON fetch fails
      const fallbackLetter = `Dear Hiring Manager,

I am writing to express my strong interest in the ${job.title} position at your company. With my background and passion for creating innovative solutions, I believe I would be an excellent fit for this role.

${job.requirements ? `I have experience with ${job.requirements}, which aligns perfectly with your requirements.` : ""}

In my free time, I enjoy exploring new technologies and contributing to open-source projects. I am excited about the opportunity to bring my skills and enthusiasm to your team.

Thank you for considering my application. I look forward to discussing how I can contribute to your organization.

Best regards,
[Your Name]`

      console.log('⚠️ Using fallback letter, length:', fallbackLetter.length)

      setCoverLetters((prev) =>
        prev.map((cl) =>
          cl.jobId === job.id ? { ...cl, content: fallbackLetter, isGenerating: false } : cl,
        ),
      )
    }
  }

  const updateCoverLetter = (jobId: string, content: string) => {
    setCoverLetters((prev) => prev.map((cl) => (cl.jobId === jobId ? { ...cl, content } : cl)))
  }

  const handleSubmitAll = async () => {
    console.log('🔵 Starting application submission')
    console.log('🔵 Student profile:', studentProfile)
    console.log('🔵 Cover letters to submit:', coverLetters)
    console.log('🔵 Jobs to submit:', jobs)
    
    // Validate we have jobs and student profile
    if (jobs.length === 0) {
      console.log('🔴 No jobs to submit applications for')
      toast({
        title: "Error",
        description: "No jobs selected for application",
        variant: "destructive",
      })
      return
    }

    if (!studentProfile?.resume_url) {
      console.log('🔴 No resume URL in profile')
      toast({
        title: "Error",
        description: "Please complete your profile before applying",
        variant: "destructive",
      })
      router.push("/student/profile")
      return
    }
    
    setSubmitting(true)
    try {
      // Submit applications for all jobs (use jobs array, not coverLetters)
      const submissionPromises = jobs.map(async (job, index) => {
        console.log(`🔵 Submitting application ${index + 1}/${jobs.length}`)
        console.log(`🔵 Job ID: ${job.id}`)
        
        // Find corresponding cover letter (might not exist)
        const coverLetter = coverLetters.find(cl => cl.jobId === job.id)
        const coverLetterContent = coverLetter?.content || ""
        
        console.log(`🔵 Cover letter length: ${coverLetterContent.length} chars`)
        
        const formData = new FormData()
        formData.append("jobId", job.id.toString())
        formData.append("coverLetter", coverLetterContent)
        
        // Include the resume URL from the student's profile
        if (studentProfile?.resume_url) {
          console.log(`🔵 Including resume URL: ${studentProfile.resume_url}`)
          formData.append("resumeUrl", studentProfile.resume_url)
        }

        console.log(`🔵 Sending POST request to /api/applications`)
        const response = await fetch("/api/applications", {
          method: "POST",
          body: formData,
        })

        console.log(`🔵 Response status: ${response.status}`)
        const responseData = await response.json()
        console.log(`🔵 Response data:`, responseData)

        if (!response.ok) {
          console.error(`🔴 Failed to submit application for job ${job.id}:`, responseData)
          throw new Error(responseData.error || "Failed to submit application")
        }

        console.log(`✅ Application ${index + 1} submitted successfully`)
        return responseData
      })

      console.log(`🔵 Waiting for all ${submissionPromises.length} applications to complete...`)
      await Promise.all(submissionPromises)

      console.log('✅ All applications submitted successfully')
      toast({
        title: "✅ Success",
        description: `${jobs.length} application(s) submitted successfully`,
      })

      router.push("/student/applications")
    } catch (error) {
      console.error('🔴 Application submission error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit applications",
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
        <Button 
          onClick={handleSubmitAll} 
          disabled={submitting || jobs.length === 0 || !studentProfile?.resume_url} 
          size="lg"
        >
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
