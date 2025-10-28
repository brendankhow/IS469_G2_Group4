"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { VideoRecorder } from "@/components/video-recorder"
import { PersonalityChart } from "@/components/personality-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Video, CheckCircle, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PersonalityTrait {
  trait: string
  score: number
  raw_score: number
  description: string
  level: string
}

interface AnalysisResult {
  success: boolean
  results: PersonalityTrait[]
  storage_path?: string
}

export default function PersonalityRecordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Get return URL from query params (for navigation after completion)
  const returnTo = searchParams.get("returnTo") || "/student/dashboard"

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/me")
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      }
    } catch (error) {
      console.error("Failed to fetch user:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleVideoReady = async (blob: Blob, fileName: string) => {
    console.log("🔵 handleVideoReady called with file:", fileName)
    
    if (!currentUser) {
      console.log("🔴 No current user in handleVideoReady")
      toast({
        title: "Error",
        description: "Please log in to continue",
        variant: "destructive",
      })
      return
    }

    console.log("🔵 Starting analysis for user:", currentUser.id)
    setAnalyzing(true)
    setError(null)

    try {
      // Create form data
      const formData = new FormData()
      formData.append("video", blob, fileName)
      formData.append("student_id", currentUser.id)
      formData.append("upload_to_storage", "true")

      console.log("Uploading video for analysis...")

      // Call API
      const response = await fetch("/api/personality/analyze", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to analyze video")
      }

      const data = await response.json()

      console.log("🔵 Analysis API response received:", data)
      console.log("🔵 analysis_id in response:", data.analysis_id)
      console.log("🔵 data.success:", data.success)

      if (data.success) {
        console.log("✅ Analysis successful, entering success block")
        setAnalysisResult(data)

        // Store the analysis ID directly from the response or fetch from history
        let analysisId = data.analysis_id
        console.log("Initial analysisId from response:", analysisId)
        
        if (!analysisId) {
          console.warn("No analysis_id in response, fetching from history")
          const historyResponse = await fetch(`/api/personality/history?student_id=${currentUser.id}`)
          if (historyResponse.ok) {
            const historyData = await historyResponse.json()
            if (historyData.analyses && historyData.analyses.length > 0) {
              analysisId = historyData.analyses[0].id
              console.log("analysisId from history:", analysisId)
            }
          }
        }
        
        if (analysisId) {
          console.log("Setting analysisId in state and storage:", analysisId)
          setAnalysisId(analysisId)
          sessionStorage.setItem("personality_analysis_id", analysisId)
          localStorage.setItem("personality_analysis_id", analysisId) // Backup to localStorage
          console.log("Stored personality analysis ID:", analysisId)
          console.log("Session storage contents:", sessionStorage.getItem("personality_analysis_id"))
          console.log("Local storage contents:", localStorage.getItem("personality_analysis_id"))
        } else {
          console.warn("Could not get analysis ID")
        }

        toast({
          title: "Success!",
          description: "Your video has been analyzed successfully",
        })
      } else {
        console.log("❌ Analysis failed - data.success is false")
        throw new Error(data.error || "Analysis failed")
      }
    } catch (err: any) {
      console.error("❌ Analysis error:", err)
      console.error("❌ Error stack:", err.stack)
      setError(err.message || "Failed to analyze video. Please try again.")
      toast({
        title: "Analysis Failed",
        description: err.message || "Please try again",
        variant: "destructive",
      })
    } finally {
      console.log("🔵 Analysis process finished")
      setAnalyzing(false)
    }
  }

  const handleReRecord = () => {
    setAnalysisResult(null)
    setAnalysisId(null)
    sessionStorage.removeItem("personality_analysis_id")
    setError(null)
  }

  const handleContinue = async () => {
    try {
      // Get job IDs from returnTo URL
      const url = new URL(returnTo, window.location.origin)
      const jobIds = url.searchParams.get('jobs')?.split(',') || []
      
      if (jobIds.length === 0) {
        toast({
          title: "Error",
          description: "No jobs found to submit applications for",
          variant: "destructive",
        })
        return
      }

      // Get cover letters from session storage
      const coverLettersData = sessionStorage.getItem('pending_cover_letters')
      if (!coverLettersData) {
        toast({
          title: "Error",
          description: "No cover letters found. Please go back and generate them.",
          variant: "destructive",
        })
        return
      }

      const coverLetters = JSON.parse(coverLettersData)
      
      // Get student profile for resume URL
      const profileResponse = await fetch("/api/auth/me")
      if (!profileResponse.ok) {
        throw new Error("Failed to fetch profile")
      }
      const profileData = await profileResponse.json()
      const studentProfile = profileData.user

      if (!studentProfile?.resume_url) {
        toast({
          title: "Error",
          description: "Please complete your profile with a resume before submitting",
          variant: "destructive",
        })
        router.push("/student/profile")
        return
      }

      // Get latest personality analysis ID from session storage
      const personalityAnalysisId = sessionStorage.getItem("personality_analysis_id")

      console.log("🔵 [handleContinue] personalityAnalysisId from sessionStorage:", personalityAnalysisId)

      if (!personalityAnalysisId) {
        toast({
          title: "Error",
          description: "No personality analysis found. Please complete personality analysis first.",
          variant: "destructive",
        })
        return
      }

      // Validate that the personality analysis ID exists in the database
      try {
        console.log("🔵 [handleContinue] Validating personality analysis ID:", personalityAnalysisId)
        const validateResponse = await fetch(`/api/personality/validate/${personalityAnalysisId}`)
        if (!validateResponse.ok) {
          console.log("🔴 [handleContinue] Personality analysis ID validation failed")
          toast({
            title: "Error",
            description: "Personality analysis data not found. Please complete video analysis again.",
            variant: "destructive",
          })
          sessionStorage.removeItem("personality_analysis_id")
          return
        }
        console.log("✅ [handleContinue] Personality analysis ID validated")
      } catch (error) {
        console.log("🔴 [handleContinue] Error validating personality analysis ID:", error)
        toast({
          title: "Error",
          description: "Failed to validate personality analysis. Please try again.",
          variant: "destructive",
        })
        return
      }

      // Submit applications for all jobs
      const submissionPromises = jobIds.map(async (jobId) => {
        const coverLetter = coverLetters.find((cl: any) => cl.jobId === jobId)
        const coverLetterContent = coverLetter?.content || ""
        
        console.log(`🔵 [handleContinue] Submitting job ${jobId} with personalityAnalysisId:`, personalityAnalysisId)
        
        const formData = new FormData()
        formData.append("jobId", jobId)
        formData.append("coverLetter", coverLetterContent)
        formData.append("resumeUrl", studentProfile.resume_url)
        formData.append("personalityAnalysisId", personalityAnalysisId)

        const response = await fetch("/api/applications", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to submit application")
        }

        return response.json()
      })

      await Promise.all(submissionPromises)

      // Clear session storage
      sessionStorage.removeItem("personality_analysis_id")
      sessionStorage.removeItem("pending_cover_letters")

      toast({
        title: "✅ Applications Submitted",
        description: `${jobIds.length} application(s) submitted successfully`,
        duration: 5000, // Show for 5 seconds
      })

      // Redirect after showing toast
      setTimeout(() => {
        router.push("/student/applications")
      }, 3000)

    } catch (error) {
      console.error('Continue submission error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit applications",
        variant: "destructive",
      })
    }
  }

  const handleSkip = async () => {
    try {
      // Get job IDs from returnTo URL
      const url = new URL(returnTo, window.location.origin)
      const jobIds = url.searchParams.get('jobs')?.split(',') || []
      
      if (jobIds.length === 0) {
        toast({
          title: "Error",
          description: "No jobs found to submit applications for",
          variant: "destructive",
        })
        return
      }

      // Get cover letters from session storage
      const coverLettersData = sessionStorage.getItem('pending_cover_letters')
      if (!coverLettersData) {
        toast({
          title: "Error",
          description: "No cover letters found. Please go back and generate them.",
          variant: "destructive",
        })
        return
      }

      const coverLetters = JSON.parse(coverLettersData)
      
      // Get student profile for resume URL
      const profileResponse = await fetch("/api/auth/me")
      if (!profileResponse.ok) {
        throw new Error("Failed to fetch profile")
      }
      const profileData = await profileResponse.json()
      const studentProfile = profileData.user

      if (!studentProfile?.resume_url) {
        toast({
          title: "Error",
          description: "Please complete your profile with a resume before submitting",
          variant: "destructive",
        })
        router.push("/student/profile")
        return
      }

      // Submit applications for all jobs
      const submissionPromises = jobIds.map(async (jobId) => {
        const coverLetter = coverLetters.find((cl: any) => cl.jobId === jobId)
        const coverLetterContent = coverLetter?.content || ""
        
        const formData = new FormData()
        formData.append("jobId", jobId)
        formData.append("coverLetter", coverLetterContent)
        formData.append("resumeUrl", studentProfile.resume_url)

        const response = await fetch("/api/applications", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to submit application")
        }

        return response.json()
      })

      await Promise.all(submissionPromises)

      // Clear session storage
      sessionStorage.removeItem("personality_analysis_id")
      sessionStorage.removeItem("pending_cover_letters")

      toast({
        title: "✅ Success",
        description: `${jobIds.length} application(s) submitted successfully`,
        duration: 5000, // Show for 5 seconds
      })

      // Redirect after showing toast
      setTimeout(() => {
        router.push("/student/applications")
      }, 3000)
    } catch (error) {
      console.error('Skip submission error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit applications",
        variant: "destructive",
      })
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
    <div className="container mx-auto p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold mb-2">Video Interview</h1>
        <p className="text-muted-foreground">
          Complete a short introduction to showcase your personality and stand out to recruiters
        </p>
      </div>

      {/* Info Card */}
      {!analysisResult && (
        <Alert className="mb-6">
          <Video className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">📹 Record a 45-60 second introduction</p>
              <p className="text-sm">Answer these questions:</p>
              <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                <li>Tell us about yourself and your background</li>
                <li>What value can you bring to a team?</li>
                <li>What are you most passionate about in tech?</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                💡 This video will be included in all your applications from this session
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {!analysisResult ? (
        <>
          {/* Video Recorder */}
          {analyzing ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-semibold">Analyzing your video...</p>
                  <p className="text-sm text-muted-foreground">This may take 30-60 seconds</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <VideoRecorder
              onVideoReady={handleVideoReady}
              maxDuration={60}
              minDuration={10}
              maxFileSize={100 * 1024 * 1024}
              allowUpload={true}
            />
          )}

          {/* Skip Option */}
          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={handleSkip}>
              Skip & Submit Applications
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Success Message */}
          <Alert className="mb-6 border-green-500/50 bg-green-500/10">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-500">
              Video analyzed successfully! Review your personality profile below.
            </AlertDescription>
          </Alert>

          {/* Analysis Results */}
          <PersonalityChart results={analysisResult.results} showDescriptions={true} />

          {/* Action Buttons */}
          <div className="flex gap-4 mt-6">
            <Button variant="outline" onClick={handleReRecord} className="flex-1">
              <Video className="mr-2 h-4 w-4" />
              Re-record Video
            </Button>
            <Button onClick={handleContinue} className="flex-1">
              Continue with Applications
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Your personality analysis has been saved and will be included in your applications
          </p>
        </>
      )}
    </div>
  )
}
