"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload, Eye, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface UserProfile {
  id: number
  email: string
  role: string
  name?: string
  phone?: string
  hobbies?: string
  skills?: string
}

export default function ProfilePage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [currentResumeUrl, setCurrentResumeUrl] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/auth/me")
      const data = await response.json()
      setProfile(data.user)
      // Set the current resume URL from the profile data
      if (data.user?.resume_url) {
        setCurrentResumeUrl(data.user.resume_url)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return
    
    setSaving(true)
    try {
      // First, upload resume if a new one is selected
      const studentId = profile.id
      let resumeUrl = currentResumeUrl
      let didUpload = false
      if (resumeFile) {
        const uploadedUrl = await uploadResume()
        if (uploadedUrl) {
          resumeUrl = uploadedUrl
          didUpload = true
        }
      }

      // Then update profile with form data (always save profile info)
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          skills: profile.skills,
          hobbies: profile.hobbies,
          resume_url: resumeUrl,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update profile")
      }

      toast({
        title: "✅ Profile saved successfully!",
        description: resumeFile 
          ? "Your profile and resume have been updated" 
          : "Your profile has been updated",
      })

      // Clear the resume file input after successful upload
      setResumeFile(null)
      if (resumeUrl) {
        setCurrentResumeUrl(resumeUrl)
      }
      
      // Refresh profile data from server (ensure resume_url is persisted in DB)
      await fetchProfile()
      
      // If we just uploaded a resume, trigger backend vectorisation (after resume_url saved)
      if (didUpload && resumeUrl) {
        try {
          const fd = new FormData()
          fd.append("student_id", studentId.toString())

          const processResponse = await fetch("http://localhost:8000/resume/process", {
            method: "POST",
            body: fd,
          })

          if (processResponse.ok) {
            const processData = await processResponse.json()
            console.log("Resume vectorised:", processData)
            toast({
              title: "Resume processed",
              description: "Your resume has been analysed and vectorised",
            })
          } else {
            const contentType = processResponse.headers.get("content-type") || ""
            const errBody = contentType.includes("application/json") ? await processResponse.json() : await processResponse.text()
            console.error("Failed to vectorise resume:", errBody)
            toast({
              title: "Processing incomplete",
              description: "Resume uploaded but vectorisation failed",
              variant: "destructive",
            })
          }
        } catch (vectorError) {
          console.error("Vectorisation error:", vectorError)
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const uploadResume = async (): Promise<string | null> => {
    if (!resumeFile || !profile) return null

    try {
      const formData = new FormData()
      formData.append("file", resumeFile) // Changed from "resume" to "file"

      const response = await fetch("/api/applications/resume", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to upload resume")
      }

      const data = await response.json()
      
      toast({
        title: "✅ Resume uploaded",
        description: "Your resume has been uploaded successfully",
      })
      return data.resumeUrl
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload resume",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleRemoveResume = async () => {
    if (!currentResumeUrl || !profile) return

    try {
      setSaving(true)

      // First, delete the file from storage bucket
      const deleteResponse = await fetch("/api/applications/resume", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumePath: currentResumeUrl }),
      })

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json()
        throw new Error(errorData.error || "Failed to delete resume from storage")
      }

      // Then update profile to remove resume_url
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          skills: profile.skills,
          hobbies: profile.hobbies,
          resume_url: null, // Remove the resume URL
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to remove resume from profile")
      }

      // Clear local state
      setCurrentResumeUrl(null)
      setResumeFile(null)

      toast({
        title: "✅ Resume removed",
        description: "Your resume has been removed successfully",
      })

      await fetchProfile()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove resume",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleViewResume = () => {
    if (currentResumeUrl) {
      window.open(currentResumeUrl, '_blank')
    }
  }

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setResumeFile(file)
      toast({
        title: "Resume Selected",
        description: file.name,
      })
    } else {
      toast({
        title: "Error",
        description: "Please select a PDF file",
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account information</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={profile?.name || ""}
                onChange={(e) => setProfile({ ...profile!, name: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile?.email || ""} disabled className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={profile?.phone || ""}
                onChange={(e) => setProfile({ ...profile!, phone: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Skills</Label>
              <Input
                id="skills"
                value={profile?.skills || ""}
                onChange={(e) => setProfile({ ...profile!, skills: e.target.value })}
                placeholder="JavaScript, React, Node.js"
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hobbies">Hobbies</Label>
              <Input
                id="hobbies"
                value={profile?.hobbies || ""}
                onChange={(e) => setProfile({ ...profile!, hobbies: e.target.value })}
                placeholder="Reading, Hiking, Photography"
                className="bg-secondary/50"
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resume</CardTitle>
            <CardDescription>Upload your resume (PDF format)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/20 p-8 text-center">
              <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-2 text-sm font-medium">
                {resumeFile ? resumeFile.name : "Drag and drop or click to upload"}
              </p>
              <p className="mb-4 text-xs text-muted-foreground">PDF files only, max 5MB</p>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleResumeUpload}
                className="hidden"
                id="resume-upload"
              />
              <label htmlFor="resume-upload">
                <Button variant="outline" asChild>
                  <span>Choose File</span>
                </Button>
              </label>
            </div>
            {resumeFile && (
              <div className="space-y-2">
                <div className="rounded-lg bg-primary/10 p-3 text-sm">
                  <p className="font-medium text-primary">📄 {resumeFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ready to upload when you save your profile
                  </p>
                </div>
              </div>
            )}
            {currentResumeUrl && !resumeFile && (
              <div className="space-y-3">
                <div className="rounded-lg bg-green-500/10 p-3 text-sm border border-green-500/20">
                  <p className="font-medium text-green-600">✅ Resume uploaded</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can view, update, or remove your resume
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleViewResume}
                    className="flex-1"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Resume
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleRemoveResume}
                    disabled={saving}
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Resume
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
