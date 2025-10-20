"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Users, Mail, Phone, FileText, Eye, Calendar, MapPin, DollarSign } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PDFViewerModal } from "@/components/pdf-viewer-modal"

interface Applicant {
  id: number
  student_id: number
  job_id: number
  status: "pending" | "accepted" | "rejected"
  created_at: string
  cover_letter?: string
  resume_url?: string
  resume_filename?: string
  student_name?: string
  student_email?: string
  student_phone?: string
  student_skills?: string
  job_title?: string
  job_location?: string
  job_salary_range?: string
}

export default function AllApplicantsPage() {
  const { toast } = useToast()
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null)
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false)
  const [selectedPdfUrl, setSelectedPdfUrl] = useState("")

  useEffect(() => {
    fetchAllApplicants()
  }, [])

  const fetchAllApplicants = async () => {
    try {
      const response = await fetch("/api/recruiter/applicants")
      const data = await response.json()
      setApplicants(data.applicants)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load applicants",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "rejected":
        return "bg-destructive/10 text-destructive border-destructive/20"
      default:
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
    }
  }

  // Group applicants by student to show all their applications
  const groupedApplicants = applicants.reduce((acc, applicant) => {
    const key = applicant.student_id
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(applicant)
    return acc
  }, {} as Record<number, Applicant[]>)

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
        <p className="text-muted-foreground">
          View all applicants across your job postings and consider them for other roles
        </p>
      </div>

      {Object.keys(groupedApplicants).length === 0 ? (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <div className="text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No applicants yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Applicants will appear here once students apply to your jobs
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedApplicants).map(([studentId, studentApplications]) => {
            const primaryApplicant = studentApplications[0] // Use first application for student info
            return (
              <Card key={studentId} className="hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{primaryApplicant.student_name || "Unknown Student"}</CardTitle>
                      <CardDescription className="mt-1">
                        <div className="flex items-center gap-4 text-sm">
                          {primaryApplicant.student_email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-4 w-4" />
                              {primaryApplicant.student_email}
                            </div>
                          )}
                          {primaryApplicant.student_phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {primaryApplicant.student_phone}
                            </div>
                          )}
                        </div>
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                      {studentApplications.length} Application{studentApplications.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {primaryApplicant.student_skills && (
                    <div>
                      <h4 className="font-semibold mb-2">Skills</h4>
                      <p className="text-sm text-muted-foreground">{primaryApplicant.student_skills}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold mb-3">Job Applications</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      {studentApplications.map((application) => (
                        <Card key={application.id} className="border-l-4 border-l-primary/50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h5 className="font-medium text-sm">{application.job_title}</h5>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  {application.job_location && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {application.job_location}
                                    </div>
                                  )}
                                  {application.job_salary_range && (
                                    <div className="flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />
                                      {application.job_salary_range}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Badge className={getStatusColor(application.status)}>
                                {application.status.toUpperCase()}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                              <Calendar className="h-3 w-3" />
                              Applied {new Date(application.created_at).toLocaleDateString()}
                            </div>

                            <div className="flex gap-2">
                              {application.cover_letter && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedApplicant(application)}
                                  className="flex-1"
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  Cover Letter
                                </Button>
                              )}
                              {application.resume_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPdfUrl(application.resume_url!)
                                    setIsPdfModalOpen(true)
                                  }}
                                  className="flex-1"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Resume
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Cover Letter Modal */}
      {selectedApplicant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setSelectedApplicant(null)}
        >
          <Card className="max-h-[80vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>{selectedApplicant.job_title}</CardTitle>
              <CardDescription>
                Cover letter from {selectedApplicant.student_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-lg bg-secondary/50 p-4 font-mono text-sm">
                {selectedApplicant.cover_letter || "No cover letter available"}
              </div>
              <Button className="mt-4 w-full" onClick={() => setSelectedApplicant(null)}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        pdfUrl={selectedPdfUrl}
        title="Resume"
      />
    </div>
  )
}
