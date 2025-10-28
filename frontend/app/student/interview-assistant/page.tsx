"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Send, Bot, Sparkles, User, MessageSquare, Video } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import ReactMarkdown from "react-markdown"
import { VideoRecorder } from "@/components/video-recorder"
import { PersonalityResults } from "@/components/personality-results"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface UserProfile {
  id: number
  name?: string
  resume_url?: string
}

interface InterviewChatHistory {
  [studentId: string]: {
    messages: ChatMessage[]
    expiresAt: number
  }
}

// LocalStorage utilities for chat persistence
const INTERVIEW_CHAT_STORAGE_KEY = "interview_assistant_chats"
const CHAT_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

const loadInterviewChats = (): InterviewChatHistory => {
  if (typeof window === "undefined") return {}
  
  try {
    const stored = localStorage.getItem(INTERVIEW_CHAT_STORAGE_KEY)
    if (!stored) return {}
    
    const parsed: InterviewChatHistory = JSON.parse(stored)
    const now = Date.now()
    
    // Filter out expired chats silently
    const filtered: InterviewChatHistory = {}
    Object.keys(parsed).forEach((studentId) => {
      if (parsed[studentId].expiresAt > now) {
        filtered[studentId] = {
          ...parsed[studentId],
          messages: parsed[studentId].messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }
      }
    })
    
    return filtered
  } catch (error) {
    console.error("Error loading interview chat history:", error)
    return {}
  }
}

const saveInterviewChats = (history: InterviewChatHistory) => {
  if (typeof window === "undefined") return
  
  try {
    localStorage.setItem(INTERVIEW_CHAT_STORAGE_KEY, JSON.stringify(history))
  } catch (error) {
    console.error("Error saving interview chat history:", error)
  }
}

export default function InterviewAssistantPage() {
  const { toast } = useToast()
  const [currentMessage, setCurrentMessage] = useState("")
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  
  // Practice video interview state
  const [practiceModalOpen, setPracticeModalOpen] = useState(false)
  const [practiceStep, setPracticeStep] = useState<"record" | "analyzing" | "results">("record")
  const [practiceAnalysis, setPracticeAnalysis] = useState<any>(null)

  useEffect(() => {
    fetchProfile()
  }, [])
  
  // Load chat history from localStorage when profile is loaded
  useEffect(() => {
    if (profile) {
      const studentKey = profile.id.toString()
      const allChats = loadInterviewChats()
      
      if (allChats[studentKey] && allChats[studentKey].messages) {
        setChatHistory(allChats[studentKey].messages)
      }
    }
  }, [profile])
  
  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (profile && chatHistory.length > 0) {
      const studentKey = profile.id.toString()
      const allChats = loadInterviewChats()
      
      allChats[studentKey] = {
        messages: chatHistory,
        expiresAt: Date.now() + CHAT_EXPIRY_MS
      }
      
      saveInterviewChats(allChats)
    }
  }, [chatHistory, profile])

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/auth/me")
      const data = await response.json()
      setProfile(data.user)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      })
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !profile) return

    // Add user message to history
    const userMessage: ChatMessage = {
      role: "user",
      content: currentMessage,
      timestamp: new Date(),
    }
    setChatHistory((prev) => [...prev, userMessage])
    setCurrentMessage("")
    setLoading(true)

    try {
      const response = await fetch("http://localhost:8000/student/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: profile.id.toString(),
          message: userMessage.content,
          temperature: 0.7,
          conversation_history: chatHistory.slice(-4).map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json()

      const aiMessage: ChatMessage = {
        role: "assistant",
        content: data.response || "No response received",
        timestamp: new Date(),
      }

      setChatHistory((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I couldn't process your message. Please try again.",
        timestamp: new Date(),
      }
      setChatHistory((prev) => [...prev, errorMessage])
      toast({
        title: "Chat Failed",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = () => {
    setChatHistory([])
    
    // Clear from localStorage as well
    if (profile) {
      const studentKey = profile.id.toString()
      const allChats = loadInterviewChats()
      delete allChats[studentKey]
      saveInterviewChats(allChats)
    }
    
    toast({
      title: "History Cleared",
      description: "Chat history has been cleared",
    })
  }
  
  const handlePracticeVideoComplete = async (blob: Blob, fileName: string) => {
    setPracticeStep("analyzing")
    
    try {
      // Convert blob to File
      const videoFile = new File([blob], fileName, { type: blob.type })
      
      const formData = new FormData()
      formData.append("video", videoFile)
      formData.append("student_id", profile?.id.toString() || "")
      formData.append("upload_to_storage", "false") // Don't save to database
      
      const response = await fetch("/api/personality/analyze", {
        method: "POST",
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error("Analysis failed")
      }
      
      const data = await response.json()
      setPracticeAnalysis(data)
      setPracticeStep("results")
      
      toast({
        title: "Analysis Complete",
        description: "Your practice interview has been analyzed",
      })
    } catch (error) {
      console.error("Practice analysis error:", error)
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze your practice video",
        variant: "destructive",
      })
      setPracticeModalOpen(false)
      setPracticeStep("record")
    }
  }
  
  const handleClosePracticeModal = () => {
    setPracticeModalOpen(false)
    setPracticeStep("record")
    setPracticeAnalysis(null)
  }

  if (profileLoading) {
    return (
      <div className="flex h-[calc(100vh-2rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const hasRequiredProfile = profile && profile.resume_url

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden p-2 gap-6">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        <Card className="flex-1 flex flex-col h-full overflow-hidden border-2">
          <CardHeader className="border-b-2 flex-shrink-0">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Interview Assistant
            </CardTitle>
            <CardDescription>
              Practice interviews with your digital twin trained on your resume and GitHub portfolio
            </CardDescription>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
            {!hasRequiredProfile ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8">
                <Bot className="h-16 w-16 text-muted-foreground/50" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Complete Your Profile First</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    To use the AI Interview Assistant, you need to upload your resume in your profile.
                    This allows the AI to learn about your experience and provide personalized interview practice.
                  </p>
                </div>
                <Button onClick={() => window.location.href = '/student/profile'}>
                  Go to Profile
                </Button>
              </div>
            ) : (
              <>
                {/* Chat History */}
                <ScrollArea className="flex-1 p-8 overflow-y-auto h-full">
                  {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 min-h-[400px]">
                      <MessageSquare className="h-16 w-16 text-muted-foreground/50" />
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Start Your Interview Practice</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          Ask your digital twin any interview questions. Practice answering questions about your experience, skills, and projects.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentMessage("Tell me about your most challenging project")}
                        >
                          Challenging Project
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentMessage("What are your key technical skills?")}
                        >
                          Technical Skills
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentMessage("Describe a time you solved a difficult problem")}
                        >
                          Problem Solving
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {chatHistory.map((message, index) => (
                        <div key={index} className="space-y-4">
                          {message.role === "user" ? (
                            <div className="flex justify-end">
                              <div className="max-w-[85%] rounded-lg p-5 bg-primary text-primary-foreground shadow-md border-2 border-primary/20">
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                <p className="text-xs mt-2 opacity-70">
                                  {message.timestamp.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-start">
                              <div className="max-w-[85%] space-y-2">
                                <div className="bg-secondary rounded-lg p-5 border-2 shadow-sm">
                                  <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown
                                      components={{
                                        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                                        ul: ({ children }) => <ul className="my-3 ml-4 list-disc space-y-2">{children}</ul>,
                                        ol: ({ children }) => <ol className="my-3 ml-4 list-decimal space-y-2">{children}</ol>,
                                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                        strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                                        em: ({ children }) => <em className="italic">{children}</em>,
                                        code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h1>,
                                        h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                                        h3: ({ children }) => <h3 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
                                        blockquote: ({ children }) => <blockquote className="border-l-2 border-primary pl-3 my-3 italic">{children}</blockquote>,
                                      }}
                                    >
                                      {message.content}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground pl-2">
                                  {message.timestamp.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {loading && (
                        <div className="flex justify-start">
                          <div className="bg-secondary rounded-lg p-5 border-2 shadow-sm">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 border-t-2 flex-shrink-0 bg-background">
                  {chatHistory.length > 0 && (
                    <div className="mb-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearHistory}
                      >
                        Clear History
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Input
                      placeholder="Ask me about my experience, skills, or projects..."
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      disabled={loading}
                      className="flex-1 border-2"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!currentMessage.trim() || loading}
                      size="icon"
                      className="border-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Press Enter to send • Your digital twin is trained on your resume and GitHub projects
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tips Sidebar */}
      <div className="w-80 space-y-4 flex-shrink-0">
        {hasRequiredProfile && (
          <Card className="border-2 border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Video className="h-4 w-4" />
                Practice Video Interview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Record a 45-60 second practice video to get instant personality analysis feedback. 
                Practice as many times as you want - nothing is saved!
              </p>
              <Button 
                onClick={() => setPracticeModalOpen(true)}
                className="w-full"
                variant="default"
              >
                <Video className="mr-2 h-4 w-4" />
                Start Practice
              </Button>
            </CardContent>
          </Card>
        )}
        
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm">Interview Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Be Specific</p>
              <p className="text-xs text-muted-foreground">
                Ask detailed questions about your projects and experiences
              </p>
            </div>
            <div>
              <p className="font-medium">Practice Common Questions</p>
              <p className="text-xs text-muted-foreground">
                Use typical interview questions to prepare better
              </p>
            </div>
            <div>
              <p className="font-medium">Review Your Responses</p>
              <p className="text-xs text-muted-foreground">
                Look back at the conversation to improve your answers
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm">Example Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              • "Tell me about a challenging project you worked on"
            </p>
            <p className="text-muted-foreground">
              • "What are your strongest technical skills?"
            </p>
            <p className="text-muted-foreground">
              • "Describe a time when you had to learn a new technology quickly"
            </p>
            <p className="text-muted-foreground">
              • "How do you approach problem-solving in your projects?"
            </p>
            <p className="text-muted-foreground">
              • "What's your experience with [specific technology]?"
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Practice Video Interview Modal */}
      <Dialog open={practiceModalOpen} onOpenChange={handleClosePracticeModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Practice Video Interview</DialogTitle>
            <DialogDescription>
              {practiceStep === "record" && "Record a 45-60 second practice video. This won't be saved - it's just for practice!"}
              {practiceStep === "analyzing" && "Analyzing your video interview..."}
              {practiceStep === "results" && "Here are your practice results. Try again to improve!"}
            </DialogDescription>
          </DialogHeader>
          
          {practiceStep === "record" && (
            <VideoRecorder
              onVideoReady={handlePracticeVideoComplete}
              maxDuration={60}
              minDuration={10}
            />
          )}
          
          {practiceStep === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Analyzing your personality traits...</p>
            </div>
          )}
          
          {practiceStep === "results" && practiceAnalysis && (
            <div className="space-y-6">
              <PersonalityResults 
                results={practiceAnalysis.results || []} 
                overallScore={practiceAnalysis.interview_score}
              />
              
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={handleClosePracticeModal}>
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    setPracticeStep("record")
                    setPracticeAnalysis(null)
                  }}
                >
                  <Video className="mr-2 h-4 w-4" />
                  Practice Again
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
