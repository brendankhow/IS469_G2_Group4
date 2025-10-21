"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Mail, Phone, FileText, Sparkles, AlertCircle, Calendar, Download, Eye, Send, Bot, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PDFViewerWithChatModal } from "@/components/pdf-viewer-with-chat-modal"
import ReactMarkdown from "react-markdown"

interface Applicant {
  id: number
  student_id: number
  student_name?: string
  student_email?: string
  student_phone?: string
  student_skills?: string
  cover_letter?: string
  resume_url?: string
  resume_filename?: string
  status: "pending" | "accepted" | "rejected"
  created_at: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface Job {
  id: number
  title: string
  description: string
}

export default function ApplicantsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null)
  const [showCommunityChatbot, setShowCommunityChatbot] = useState(false)
  const [rejectingAll, setRejectingAll] = useState(false)
  
  // Chat sidebar state
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedCandidateForChat, setSelectedCandidateForChat] = useState<Applicant | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  
  // AI Matching state
  const [loadingAIMatching, setLoadingAIMatching] = useState(false)
  const [aiMatchingResults, setAiMatchingResults] = useState<string | null>(null)
  
  // PDF Viewer state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [selectedResumeUrl, setSelectedResumeUrl] = useState<string | null>(null)
  const [selectedCandidateForResume, setSelectedCandidateForResume] = useState<Applicant | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchApplicants()
  }, [params.id])

  useEffect(() => {
    if (chatScrollRef.current) {
      const scrollContainer = chatScrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [chatMessages, sendingMessage])

  const fetchApplicants = async () => {
    try {
      const response = await fetch(`/api/recruiter/jobs/${params.id}/applicants`)
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

  const handleOpenChat = (applicant: Applicant) => {
    // Check if we already have chat history for this candidate
    const isSameCandidate = selectedCandidateForChat?.id === applicant.id
    
    if (!isSameCandidate) {
      setSelectedCandidateForChat(applicant)
      setChatMessages([
        {
          role: "assistant",
          content: `Hi! I'm here to help you learn more about ${applicant.student_name || "this candidate"}. You can ask me about their skills, experience, or how well they match this position.`,
          timestamp: new Date()
        }
      ])
    }
    
    setChatOpen(true)
  }

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedCandidateForChat) return
    
    const userMessage: ChatMessage = {
      role: "user",
      content: currentMessage,
      timestamp: new Date()
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setCurrentMessage("")
    setSendingMessage(true)
    
    try {
      const response = await fetch('http://localhost:8000/chat/chat_with_history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: 0.7
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to get response')
      }
      
      const data = await response.json()
      
      const aiMessage: ChatMessage = {
        role: "assistant",
        content: data.raw_response || data.response || "No response received",
        timestamp: new Date()
      }
      
      setChatMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I couldn't process your message. Please try again.",
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setSendingMessage(false)
    }
  }

  const handleAIMatching = async () => {
    setShowCommunityChatbot(true)
    setLoadingAIMatching(true)
    setAiMatchingResults(null)
    
    try {
      // Step 1: Fetch job description
      const jobResponse = await fetch(`/api/jobs/${params.id}`)
      const jobData = await jobResponse.json()
      
      if (!jobData.job || !jobData.job.description) {
        setAiMatchingResults("Job description not found. Please ensure the job has a description.")
        return
      }
      
      const jobDescription = jobData.job.description
      
      // Step 2: Call /resume/search
      const searchResponse = await fetch('http://localhost:8000/resume/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          job_description: jobDescription,
          top_k: applicants.length.toString() // Search among current applicants
        })
      })
      
      const searchData = await searchResponse.json()
      
      // Step 3: Format and display results
      if (searchData.success && searchData.results.length > 0) {
        const results = searchData.results
        let summary = `**AI Matching Results** (${results.length} candidates analyzed)\n\n`
        
        results.forEach((result: any, index: number) => {
          const profile = result.profile || {}
          const matchPercentage = Math.round(result.similarity * 100)
          summary += `**${index + 1}. ${profile.name || 'Unknown'}** - ${matchPercentage}% match\n`
          summary += `• Skills: ${profile.skills || 'N/A'}\n`
          summary += `• Email: ${profile.email || 'N/A'}\n\n`
        })
        
        setAiMatchingResults(summary)
      } else {
        setAiMatchingResults("No matching candidates found for this job description.")
      }
    } catch (error) {
      console.error('AI Matching error:', error)
      setAiMatchingResults("Failed to load matching results. Please try again.")
    } finally {
      setLoadingAIMatching(false)
    }
  }

  const updateStatus = async (applicantId: number, status: "accepted" | "rejected") => {
    try {
      const response = await fetch(`/api/recruiter/applications/${applicantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error("Failed to update status")
      }

      toast({
        title: "Success",
        description: `Application ${status}`,
      })

      setApplicants(applicants.map((app) => (app.id === applicantId ? { ...app, status } : app)))
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      })
    }
  }

  const handleRejectRemaining = async () => {
    if (!confirm("Are you sure you want to reject all pending applications? This action cannot be undone.")) {
      return
    }

    setRejectingAll(true)
    try {
      const response = await fetch(`/api/recruiter/jobs/${params.id}/reject-remaining`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error("Failed to reject applications")
      }

      toast({
        title: "Success",
        description: `${data.rejectedCount} applications rejected`,
      })

      // Refresh applicants
      fetchApplicants()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject applications",
        variant: "destructive",
      })
    } finally {
      setRejectingAll(false)
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

  const handleViewResume = (resumeUrl: string, applicant: Applicant) => {
    if (resumeUrl) {
      setSelectedResumeUrl(resumeUrl)
      setSelectedCandidateForResume(applicant)
      
      // Initialize chat for this candidate if not already present
      const existingChat = chatMessages.length > 0 && selectedCandidateForChat?.id === applicant.id
      if (!existingChat) {
        setChatMessages([
          {
            role: "assistant",
            content: `Hi! I'm here to help you learn more about ${applicant.student_name || "this candidate"}. You can ask me about their skills, experience, or how well they match this position.`,
            timestamp: new Date()
          }
        ])
        setSelectedCandidateForChat(applicant)
      }
      
      setPdfViewerOpen(true)
    } else {
      toast({
        title: "Resume not available",
        description: "This applicant has not uploaded a resume",
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

  const pendingCount = applicants.filter((app) => app.status === "pending").length

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Applicants</h1>
          <p className="text-muted-foreground">
            {applicants.length} total applicants ({pendingCount} pending)
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleAIMatching}>
            <Sparkles className="mr-2 h-4 w-4" />
            AI Matching
          </Button>
          {pendingCount > 0 && (
            <Button variant="destructive" onClick={handleRejectRemaining} disabled={rejectingAll}>
              {rejectingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Reject All Remaining ({pendingCount})
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Community Chatbot */}
      {showCommunityChatbot && (
        <Card className="mb-6 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Candidate Matching Summary
            </CardTitle>
            <CardDescription>AI-powered matching analysis for this job's candidates</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAIMatching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Analyzing candidates for this job...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <ScrollArea className="max-h-[400px] pr-4">
                  <div className="rounded-lg bg-secondary/50 p-4 text-sm">
                    {aiMatchingResults?.split('\n').map((line, index) => {
                      if (line.startsWith('**')) {
                        return <p key={index} className="font-bold text-primary mt-3 first:mt-0">{line.replace(/\*\*/g, '')}</p>
                      } else if (line.startsWith('•')) {
                        return <p key={index} className="text-muted-foreground ml-2">{line}</p>
                      } else if (line.trim()) {
                        return <p key={index} className="text-muted-foreground">{line}</p>
                      }
                      return <br key={index} />
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {applicants.length === 0 ? (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No applicants yet</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {applicants.map((applicant) => (
            <Card key={applicant.id} className="hover:border-primary/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{applicant.student_name || "Anonymous"}</CardTitle>
                    <CardDescription className="mt-1">
                      Applied {new Date(applicant.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(applicant.status)}>{applicant.status.toUpperCase()}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {applicant.student_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {applicant.student_email}
                  </div>
                )}
                {applicant.student_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {applicant.student_phone}
                  </div>
                )}
                {applicant.student_skills && (
                  <div className="rounded-md bg-secondary/50 p-2 text-xs text-muted-foreground">
                    <strong>Skills:</strong> {applicant.student_skills}
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedApplicant(applicant)}>
                    <FileText className="mr-2 h-4 w-4" />
                    View Cover Letter
                  </Button>
                  
                  {applicant.resume_url && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleViewResume(applicant.resume_url!, applicant)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Resume
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenChat(applicant)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Chat with AI
                  </Button>

                  {applicant.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => updateStatus(applicant.id, "accepted")}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => updateStatus(applicant.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {applicant.status === "accepted" && (
                    <Button size="sm" variant="outline">
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule Interview
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
              <CardTitle>{selectedApplicant.student_name || "Anonymous"}</CardTitle>
              <CardDescription>Cover Letter</CardDescription>
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

      {/* Chat Sidebar */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="w-full sm:w-1/4 sm:max-w-none flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Chat with AI
            </SheetTitle>
            <SheetDescription>
              Ask questions about {selectedCandidateForChat?.student_name || "this candidate"}
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-hidden" ref={chatScrollRef}>
            <ScrollArea className="h-full p-6">
              <div className="space-y-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                      <p className="text-xs mt-1 opacity-70">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {message.role === "user" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                        <User className="h-4 w-4 text-accent-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {sendingMessage && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-secondary text-secondary-foreground rounded-lg p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>          <div className="p-6 pt-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about this candidate..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                disabled={sendingMessage}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!currentMessage.trim() || sendingMessage}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* PDF Viewer with Chat Modal */}
      {selectedCandidateForResume && (
        <PDFViewerWithChatModal
          isOpen={pdfViewerOpen}
          onClose={() => setPdfViewerOpen(false)}
          pdfUrl={selectedResumeUrl || ""}
          candidate={selectedCandidateForResume}
          chatMessages={chatMessages}
          onSendMessage={async (message: string) => {
            const userMessage: ChatMessage = {
              role: "user",
              content: message,
              timestamp: new Date()
            }
            
            setChatMessages(prev => [...prev, userMessage])
            setSendingMessage(true)
            
            try {
              const response = await fetch('http://localhost:8000/chat/chat_with_history', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messages: [...chatMessages, userMessage].map(msg => ({
                    role: msg.role,
                    content: msg.content
                  })),
                  temperature: 0.7
                })
              })
              
              if (!response.ok) {
                throw new Error('Failed to get response')
              }
              
              const data = await response.json()
              
              const aiMessage: ChatMessage = {
                role: "assistant",
                content: data.raw_response || data.response || "No response received",
                timestamp: new Date()
              }
              
              setChatMessages(prev => [...prev, aiMessage])
            } catch (error) {
              console.error('Chat error:', error)
              const errorMessage: ChatMessage = {
                role: "assistant",
                content: "Sorry, I couldn't process your message. Please try again.",
                timestamp: new Date()
              }
              setChatMessages(prev => [...prev, errorMessage])
            } finally {
              setSendingMessage(false)
            }
          }}
          sendingMessage={sendingMessage}
        />
      )}
    </div>
  )
}
