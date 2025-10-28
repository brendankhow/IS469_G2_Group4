"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sparkles, Send, Video, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
  const [refinementInput, setRefinementInput] = useState("");
  const [isRefining, setIsRefining] = useState<string | null>(null);

  useEffect(() => {
    const jobIds = searchParams.get("jobs")?.split(",") || []
    if (jobIds.length === 0) {
      router.push("/student/dashboard")
      return
    }
    fetchJobs(jobIds)
  }, [searchParams])

  useEffect(() => {
    console.log("🔵 Cover letters page loaded")
    console.log("🔵 Session storage contents:", sessionStorage.getItem("personality_analysis_id"))
    console.log("🔵 Local storage contents:", localStorage.getItem("personality_analysis_id"))
    console.log("🔵 All session storage keys:", Object.keys(sessionStorage))
    
    // Debug: Check if personality analysis ID exists in storage
    const sessionId = sessionStorage.getItem("personality_analysis_id")
    const localId = localStorage.getItem("personality_analysis_id")
    if (sessionId || localId) {
      console.log("✅ Found personality analysis ID - session:", sessionId, "local:", localId)
    } else {
      console.log("🟡 No personality analysis ID in storage")
    }
  }, [])


  useEffect(() => {
    console.log('🔵 Cover letters state updated:', coverLetters.length, 'letters')
    coverLetters.forEach((cl, idx) => {
      console.log(`  Letter ${idx + 1}: jobId=${cl.jobId}, isGenerating=${cl.isGenerating}, contentLength=${cl.content.length}`)
    })
  }, [coverLetters])

  useEffect(() => {
    console.log('🔵 Jobs state updated:', jobs.length, 'jobs')
  }, [jobs])


  const fetchJobs = async (jobIds: string[]) => {
    try {
      // Fetch profile and job details
      const [profileResponse, jobsResponse] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/jobs")
      ]);
      
      const profileData = await profileResponse.json();
      setStudentProfile(profileData.user);
      
      const jobsData = await jobsResponse.json();
      const selectedJobsDetails = jobsData.jobs.filter((job: Job) => jobIds.includes(job.id));
      setJobs(selectedJobsDetails);

      // Set up the initial "loading" state for each card
      const initialCoverLetters = selectedJobsDetails.map((job: Job) => ({
        jobId: job.id,
        content: "",
        isGenerating: true, 
      }));
      setCoverLetters(initialCoverLetters);

      setLoading(false); 
      
      await generateAndSetCoverLetters(profileData.user?.id, jobIds, selectedJobsDetails);

    } catch (error) {
        console.error('🔴 Error during initial data fetch:', error);
        toast({ title: "Error", description: "Failed to load initial job data.", variant: "destructive" });
        setLoading(false);
    }
  }

  const generateAndSetCoverLetters = async (studentId: string, jobIds: string[], selectedJobsDetails: Job[]) => {
    if (!studentId) {
        toast({ title: "Error", description: "Could not identify student.", variant: "destructive" });
        setCoverLetters(prev => prev.map(cl => ({...cl, isGenerating: false, content: "Could not start generation: Student not found."})));
        return;
    }
      
    try {
      const payload = {
        student_id: studentId,
        job_ids: jobIds,
      };

      const generationResponse = await fetch(`http://127.0.0.1:8000/student/generate-cover-letters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!generationResponse.ok) {
        throw new Error(`Server responded with status: ${generationResponse.status}`);
      }

      const result = await generationResponse.json();

      const finalCoverLetters = selectedJobsDetails.map((job: Job) => {
        const generated = result.cover_letters.find((cl: any) => cl.job_id === job.id);
        return {
          jobId: job.id,
          content: generated ? generated.cover_letter : "Error: Could not generate.",
          isGenerating: false,
        };
      });
      setCoverLetters(finalCoverLetters);
      toast({ title: "Success!", description: "AI cover letters are ready." });

    } catch (error) {
      console.error('🔴 Error in generateAndSetCoverLetters:', error);
      toast({ title: "Error", description: "Failed to generate cover letters.", variant: "destructive" });
      setCoverLetters(prev => prev.map(cl => ({...cl, isGenerating: false, content: "Generation failed."})));
    }
  }

  const handleRefine = async (jobId: string, originalContent: string) => {
      if (!refinementInput.trim()) {
          toast({ title: "Instruction is empty", variant: "destructive" });
          return;
      }

      setIsRefining(jobId); // Start loading for this specific card
      try {
          const payload = {
              original_letter: originalContent,
              instruction: refinementInput,
          };

          const response = await fetch(`http://127.0.0.1:8000/student/refine-cover-letter`, { // Use your correct prefix
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
          });

          if (!response.ok) {
              throw new Error("Failed to refine the cover letter.");
          }

          const data = await response.json();
          
          // Update the specific cover letter in your state
          updateCoverLetter(jobId, data.refined_letter);
          setRefinementInput(""); // Clear the input field

      } catch (error) {
          toast({ title: "Refinement Failed", variant: "destructive" });
      } finally {
          setIsRefining(null); // Stop loading
      }
  };

//   const generateCoverLetter = async (job: Job) => {
//     try {
//       console.log('🔵 Generating cover letter for job:', job.title)
      
//       // Fetch mock cover letter templates
//       const response = await fetch('/mock-cover-letters/templates.json')
//       console.log('🔵 Template fetch response status:', response.status)
      
//       if (!response.ok) {
//         throw new Error(`Failed to fetch templates: ${response.status}`)
//       }
      
//       const templates = await response.json()
//       console.log('🔵 Templates loaded:', Object.keys(templates))
      
//       // Simulate AI generation delay
//       await new Promise((resolve) => setTimeout(resolve, 1500))

//       // Determine which template to use based on job title
//       let template = templates.default
//       const jobTitleLower = job.title.toLowerCase()
      
//       console.log('🔵 Job title (lowercase):', jobTitleLower)
      
//       if (jobTitleLower.includes('software') || jobTitleLower.includes('developer') || jobTitleLower.includes('engineer')) {
//         template = templates.software_engineer
//         console.log('🔵 Using software_engineer template')
//       } else if (jobTitleLower.includes('data') || jobTitleLower.includes('analyst')) {
//         template = templates.data_analyst
//         console.log('🔵 Using data_analyst template')
//       } else if (jobTitleLower.includes('product') || jobTitleLower.includes('manager')) {
//         template = templates.product_manager
//         console.log('🔵 Using product_manager template')
//       } else if (jobTitleLower.includes('marketing') || jobTitleLower.includes('brand')) {
//         template = templates.marketing_specialist
//         console.log('🔵 Using marketing_specialist template')
//       } else if (jobTitleLower.includes('ux') || jobTitleLower.includes('ui') || jobTitleLower.includes('design')) {
//         template = templates.ux_designer
//         console.log('🔵 Using ux_designer template')
//       } else {
//         console.log('🔵 Using default template')
//       }

//       console.log('🔵 Template length:', template?.length || 0)

//       // Customize the template with job details
//       let coverLetter = template
//       if (job.requirements) {
//         coverLetter = coverLetter.replace(
//           'Thank you for considering my application.',
//           `The position's requirements of ${job.requirements} align well with my skill set and experience.\n\nThank you for considering my application.`
//         )
//       }

//       console.log('✅ Cover letter generated, length:', coverLetter.length)

//       setCoverLetters((prev) =>
//         prev.map((cl) => (cl.jobId === job.id ? { ...cl, content: coverLetter, isGenerating: false } : cl)),
//       )
//     } catch (error) {
//       console.error("🔴 Cover letter generation error:", error)
      
//       // Fallback cover letter if JSON fetch fails
//       const fallbackLetter = `Dear Hiring Manager,

// I am writing to express my strong interest in the ${job.title} position at your company. With my background and passion for creating innovative solutions, I believe I would be an excellent fit for this role.

// ${job.requirements ? `I have experience with ${job.requirements}, which aligns perfectly with your requirements.` : ""}

// In my free time, I enjoy exploring new technologies and contributing to open-source projects. I am excited about the opportunity to bring my skills and enthusiasm to your team.

// Thank you for considering my application. I look forward to discussing how I can contribute to your organization.

// Best regards,
// [Your Name]`

//       console.log('⚠️ Using fallback letter, length:', fallbackLetter.length)

//       setCoverLetters((prev) =>
//         prev.map((cl) =>
//           cl.jobId === job.id ? { ...cl, content: fallbackLetter, isGenerating: false } : cl,
//         ),
//       )
//     }
//   }

  const updateCoverLetter = (jobId: string, content: string) => {
    setCoverLetters((prev) => prev.map((cl) => (cl.jobId === jobId ? { ...cl, content } : cl)))
  }

  const handleSubmitAll = async () => {
    console.log('🔵 Starting application submission')
    console.log('🔵 Session storage at submission time:', sessionStorage.getItem("personality_analysis_id"))
    console.log('🔵 All session storage keys at submission:', Object.keys(sessionStorage))
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
      // Get latest personality analysis ID from sessionStorage, localStorage, or history API
      let personalityAnalysisId = sessionStorage.getItem("personality_analysis_id") || localStorage.getItem("personality_analysis_id")
      
      console.log("🔵 [handleSubmit] personalityAnalysisId from sessionStorage:", sessionStorage.getItem("personality_analysis_id"))
      console.log("🔵 [handleSubmit] personalityAnalysisId from localStorage:", localStorage.getItem("personality_analysis_id"))
      console.log("🔵 [handleSubmit] initial personalityAnalysisId:", personalityAnalysisId)
      
      if (!personalityAnalysisId) {
        console.log("🔵 [handleSubmit] No ID in storage, fetching from history API")
        try {
          const personalityResponse = await fetch(`/api/personality/history?student_id=${studentProfile.id}`)
          if (personalityResponse.ok) {
            const personalityData = await personalityResponse.json()
            const latestAnalysis = personalityData.analyses?.[0] // Get the most recent analysis
            personalityAnalysisId = latestAnalysis?.id
            console.log("🔵 [handleSubmit] personalityAnalysisId from history:", personalityAnalysisId)
            
            // Store it for future use
            if (personalityAnalysisId) {
              sessionStorage.setItem("personality_analysis_id", personalityAnalysisId)
              localStorage.setItem("personality_analysis_id", personalityAnalysisId)
              console.log("🔵 [handleSubmit] Stored ID in storage for future use")
            }
          } else {
            console.log("🔴 [handleSubmit] Failed to fetch personality history")
          }
        } catch (error) {
          console.warn("Could not fetch personality analysis:", error)
        }
      }      // Validate personality analysis ID if found
      if (personalityAnalysisId) {
        try {
          console.log("🔵 [handleSubmit] Validating personality analysis ID:", personalityAnalysisId)
          const validateResponse = await fetch(`/api/personality/validate/${personalityAnalysisId}`)
          if (!validateResponse.ok) {
            console.log("🟡 [handleSubmit] Personality analysis ID validation failed, proceeding without it")
            personalityAnalysisId = null
          } else {
            console.log("✅ [handleSubmit] Personality analysis ID validated")
          }
        } catch (error) {
          console.log("🟡 [handleSubmit] Error validating personality analysis ID, proceeding without it:", error)
          personalityAnalysisId = null
        }
      }
      
      if (personalityAnalysisId) {
        console.log(`🔵 [handleSubmit] Including personality analysis ID: ${personalityAnalysisId}`)
      } else {
        console.log(`🟡 [handleSubmit] No valid personality analysis ID - submitting without it`)
      }

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

        // Include personality analysis ID if available
        if (personalityAnalysisId) {
          console.log(`🔵 [handleSubmit] Adding personalityAnalysisId to formData for job ${job.id}:`, personalityAnalysisId)
          formData.append("personalityAnalysisId", personalityAnalysisId)
        } else {
          console.log(`🟡 [handleSubmit] No personalityAnalysisId for job ${job.id}`)
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
      
      // Clear personality analysis ID from session after submission
      sessionStorage.removeItem("personality_analysis_id")
      
      toast({
        title: "✅ Success",
        description: `${jobs.length} application(s) submitted successfully`,
        duration: 5000, // Show for 5 seconds
      })

      // Redirect after showing toast
      setTimeout(() => {
        router.push("/student/applications")
      }, 3000)
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
                      <div className="rounded-lg border border-primary/50 bg-secondary/30 p-4 space-y-2">
                        <p className="text-sm font-medium">AI Assistant</p>
                        <Textarea
                          value={refinementInput}
                          onChange={(e) => setRefinementInput(e.target.value)}
                          placeholder="e.g., 'Make it more formal' or 'Shorten this to three paragraphs'"
                          rows={2}
                        />
                        <Button 
                          size="sm" 
                          onClick={() => handleRefine(job.id, coverLetter?.content || "")}
                          disabled={isRefining === job.id}
                        >
                          {isRefining === job.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          Refine
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Success Alert - Show after generation */}
      {!loading && coverLetters.every(cl => !cl.isGenerating && cl.content.length > 0) && (
        <Alert className="mb-6 border-green-500/50 bg-green-500/10">
          <Sparkles className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-500">
            ✨ Cover letters generated successfully! You can edit them or proceed to the next step.
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="mt-8 space-y-4">
        {/* Video Interview Option */}
        <Alert>
          <Video className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-1">🎥 Complete a Video Interview (Recommended)</p>
            <p className="text-sm text-muted-foreground">
              Stand out by adding a 45-60 second introduction video to your applications
            </p>
          </AlertDescription>
        </Alert>

        {/* Video Interview Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => {
              // Save current jobs and cover letters to session for return
              const jobIds = jobs.map(j => j.id).join(',')
              const coverLettersData = coverLetters.map(cl => ({
                jobId: cl.jobId,
                content: cl.content
              }))
              sessionStorage.setItem('pending_cover_letters', JSON.stringify(coverLettersData))
              router.push(`/student/personality/record?returnTo=/student/cover-letters?jobs=${jobIds}`)
            }}
            variant="default"
            disabled={submitting || jobs.length === 0}
            size="lg"
          >
            <Video className="mr-2 h-4 w-4" />
            Next: Video Interview
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 justify-end">
          <Button
            onClick={handleSubmitAll}
            variant="outline"
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
                Skip & Submit Applications
              </>
            )}
          </Button>
        </div>

        {!studentProfile?.resume_url && (
          <p className="text-sm text-center text-destructive">
            Please upload your resume in your profile before submitting applications
          </p>
        )}
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
