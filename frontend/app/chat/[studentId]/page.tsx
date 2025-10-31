"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, Bot, User, X, Share2, ExternalLink, Github } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import ReactMarkdown from "react-markdown"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface StudentProfile {
  id: string
  name: string
  email: string
  github_username?: string
  skills?: string
  bio?: string
}

const CHAT_STORAGE_PREFIX = "public_student_chat_"
const CHAT_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

export default function PublicStudentChatPage() {
  const params = useParams()
  const studentId = params.studentId as string
  const { toast } = useToast()
  
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatStorageKey = `${CHAT_STORAGE_PREFIX}${studentId}`

  // Load student profile
  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        setLoading(true)
        // Fetch from the existing /profiles endpoint
        const response = await fetch(`http://localhost:8000/profiles`)
        
        if (!response.ok) {
          throw new Error("Unable to fetch profiles")
        }
        
        const profiles = await response.json()
        
        // Find the student profile by ID
        const student = profiles.find((p: any) => p.id === studentId)
        
        if (!student) {
          throw new Error("Student not found")
        }
        
        const profileData = {
          id: student.id,
          name: student.name || "Unknown",
          email: student.email || "",
          github_username: student.github_username,
          skills: student.skills,
          bio: student.bio
        }
        
        setStudentProfile(profileData)
        
        // Load chat history from localStorage
        loadChatHistory(profileData.name)
      } catch (err) {
        console.error("Error fetching student profile:", err)
        setError("Unable to load student profile. Please check the link and try again.")
      } finally {
        setLoading(false)
      }
    }
    
    if (studentId) {
      fetchStudentProfile()
    }
  }, [studentId])

  // Load chat history from localStorage
  const loadChatHistory = (studentName: string) => {
    if (typeof window === "undefined") return
    
    try {
      const stored = localStorage.getItem(chatStorageKey)
      if (!stored) {
        // Initialize with welcome message
        initializeChat(studentName)
        return
      }
      
      const parsed = JSON.parse(stored)
      const now = Date.now()
      
      // Check if chat has expired
      if (parsed.expiresAt && parsed.expiresAt > now) {
        setMessages(parsed.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })))
      } else {
        // Expired, reset chat
        initializeChat(studentName)
      }
    } catch (error) {
      console.error("Error loading chat history:", error)
      initializeChat(studentName)
    }
  }

  // Initialize chat with welcome message
  const initializeChat = (studentName: string) => {
    const welcomeMessage: ChatMessage = {
      role: "assistant",
      content: `Hi! I'm an AI assistant that can help you learn about ${studentName}'s background, skills, and experience. Feel free to ask me anything!`,
      timestamp: new Date()
    }
    setMessages([welcomeMessage])
    saveChatHistory([welcomeMessage])
  }

  // Save chat history to localStorage
  const saveChatHistory = (msgs: ChatMessage[]) => {
    if (typeof window === "undefined") return
    
    try {
      const data = {
        messages: msgs,
        expiresAt: Date.now() + CHAT_EXPIRY_MS
      }
      localStorage.setItem(chatStorageKey, JSON.stringify(data))
    } catch (error) {
      console.error("Error saving chat history:", error)
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatScrollRef.current) {
      const scrollContainer = chatScrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !studentId) return
    
    const userMessage: ChatMessage = {
      role: "user",
      content: currentMessage,
      timestamp: new Date()
    }
    
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setCurrentMessage("")
    setSendingMessage(true)
    
    try {
      const messagesForAPI = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      
      const response = await fetch("http://localhost:8000/chat/chat_with_history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messagesForAPI,
          temperature: 0.7,
          student_id: studentId
        }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to get response")
      }
      
      const data = await response.json()
      
      const aiMessage: ChatMessage = {
        role: "assistant",
        content: data.raw_response || data.response || "No response received",
        timestamp: new Date()
      }
      
      const finalMessages = [...updatedMessages, aiMessage]
      setMessages(finalMessages)
      saveChatHistory(finalMessages)
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I couldn't process your message. Please try again.",
        timestamp: new Date()
      }
      
      const finalMessages = [...updatedMessages, errorMessage]
      setMessages(finalMessages)
      saveChatHistory(finalMessages)
      
      toast({
        title: "Chat Failed",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSendingMessage(false)
    }
  }

  const handleClearChat = () => {
    const studentName = studentProfile?.name || "this candidate"
    initializeChat(studentName)
    toast({
      title: "Chat Cleared",
      description: "Chat history has been reset",
    })
  }

  const handleCopyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    toast({
      title: "Link Copied",
      description: "Shareable link copied to clipboard",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error || !studentProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error || "Unable to load profile"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Profile Header */}
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${studentProfile.name}`} />
                  <AvatarFallback>{studentProfile.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <CardTitle className="text-2xl">{studentProfile.name}</CardTitle>
                  <CardDescription className="text-base">
                    {studentProfile.email}
                  </CardDescription>
                  {studentProfile.bio && (
                    <p className="text-sm text-muted-foreground mt-2">{studentProfile.bio}</p>
                  )}
                  {studentProfile.skills && (
                    <p className="text-sm mt-2">
                      <span className="font-medium">Skills:</span> {studentProfile.skills}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
            {studentProfile.github_username && (
              <div className="pt-4 border-t mt-4">
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={`https://github.com/${studentProfile.github_username}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="gap-2"
                  >
                    <Github className="h-4 w-4" />
                    @{studentProfile.github_username}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Chat Interface */}
        <Card className="border-2 flex flex-col h-[600px]">
          <CardHeader className="border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Chat with AI Assistant
                </CardTitle>
                <CardDescription>
                  Ask me anything about {studentProfile.name.split(' ')[0]}'s background and experience
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            {/* Messages */}
            <ScrollArea ref={chatScrollRef} className="flex-1 p-6">
              <div className="space-y-4">
                {messages.map((message, index) => (
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
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                              code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                      <p className="text-xs mt-2 opacity-70">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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

            {/* Input */}
            <div className="p-4 border-t flex-shrink-0">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about experience, skills, projects..."
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
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send • Chat expires after 1 hour of inactivity
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>This is a public chat interface powered by AI. Responses are based on the student's profile data.</p>
        </div>
      </div>
    </div>
  )
}
