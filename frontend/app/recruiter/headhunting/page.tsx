"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Loader2, Send, Search, Sparkles, Star, Github, ExternalLink, MessageSquare, Bot, User, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import ReactMarkdown from "react-markdown"
import { Badge } from "@/components/ui/badge"

interface CandidateResult {
  name: string
  fit_score: number
  evaluation_bullets: string[]
  notable_github_projects: string[]
  next_step: string
  github_link: string
  candidate_link: string
  student_id?: string  // Added to track student ID for chat
}

interface SearchResult {
  message?: string
  candidates?: CandidateResult[]
  timestamp: Date
  isUser: boolean
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface CandidateChatHistory {
  [studentId: string]: {
    messages: ChatMessage[]
    expiresAt: number
    candidateName: string
  }
}

// LocalStorage utilities for chat history with expiry
const CHAT_STORAGE_KEY = "headhunt_candidate_chats"
const SEARCH_HISTORY_STORAGE_KEY = "headhunt_search_history"
const CHAT_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

const loadChatHistory = (): CandidateChatHistory => {
  if (typeof window === "undefined") return {}
  
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!stored) return {}
    
    const parsed: CandidateChatHistory = JSON.parse(stored)
    const now = Date.now()
    
    // Filter out expired chats silently
    const filtered: CandidateChatHistory = {}
    Object.keys(parsed).forEach((studentId) => {
      if (parsed[studentId].expiresAt > now) {
        // Convert timestamp strings back to Date objects
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
    console.error("Error loading chat history:", error)
    return {}
  }
}

const saveChatHistory = (history: CandidateChatHistory) => {
  if (typeof window === "undefined") return
  
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history))
  } catch (error) {
    console.error("Error saving chat history:", error)
  }
}

const loadSearchHistory = (): SearchResult[] => {
  if (typeof window === "undefined") return []
  
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY)
    if (!stored) return []
    
    const parsed = JSON.parse(stored)
    // Convert timestamp strings back to Date objects
    return parsed.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp)
    }))
  } catch (error) {
    console.error("Error loading search history:", error)
    return []
  }
}

const saveSearchHistory = (history: SearchResult[]) => {
  if (typeof window === "undefined") return
  
  try {
    localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(history))
  } catch (error) {
    console.error("Error saving search history:", error)
  }
}

export default function HeadhuntingPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchHistory, setSearchHistory] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResult | null>(null)
  const [candidateChats, setCandidateChats] = useState<CandidateChatHistory>({})
  const [currentChatMessage, setCurrentChatMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  
  // Load chat history from localStorage on mount
  useEffect(() => {
    const loadedChats = loadChatHistory()
    setCandidateChats(loadedChats)
    
    const loadedSearchHistory = loadSearchHistory()
    setSearchHistory(loadedSearchHistory)
  }, [])
  
  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(candidateChats).length > 0) {
      saveChatHistory(candidateChats)
    }
  }, [candidateChats])
  
  // Save search history to localStorage whenever it changes
  useEffect(() => {
    if (searchHistory.length > 0) {
      saveSearchHistory(searchHistory)
    }
  }, [searchHistory])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a job description or requirements",
        variant: "destructive",
      })
      return
    }

    // Add user message to history
    const userMessage: SearchResult = {
      message: searchQuery,
      timestamp: new Date(),
      isUser: true,
    }
    setSearchHistory((prev) => [...prev, userMessage])
    setLoading(true)

    try {
      const response = await fetch("http://localhost:8000/chat/community", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: searchQuery,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to search candidates")
      }

      const data = await response.json()
      
      // Add AI response to history - handle both structured and raw responses
      const aiMessage: SearchResult = {
        candidates: data.response || undefined,
        message: data.raw_response || undefined,
        timestamp: new Date(),
        isUser: false,
      }
      
      if (!aiMessage.candidates && !aiMessage.message) {
        throw new Error("Invalid response format")
      }
      
      setSearchHistory((prev) => [...prev, aiMessage])
      setSearchQuery("") // Clear input after successful search
    } catch (error) {
      console.error("Search error:", error)
      toast({
        title: "Search Failed",
        description: "Failed to find candidates. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = () => {
    setSearchHistory([])
    if (typeof window !== "undefined") {
      localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY)
    }
    toast({
      title: "History Cleared",
      description: "Search history has been cleared",
    })
  }
  
  // Chat functions
  const handleOpenCandidateChat = (candidate: CandidateResult) => {
    if (!candidate.student_id) {
      toast({
        title: "Cannot Open Chat",
        description: "Student ID not available for this candidate",
        variant: "destructive",
      })
      return
    }
    
    setSelectedCandidate(candidate)
    
    // Initialize chat if doesn't exist
    if (!candidateChats[candidate.student_id]) {
      const now = Date.now()
      const newChat = {
        messages: [
          {
            role: "assistant" as const,
            content: `Hi! I'm here to help you learn more about **${candidate.name}**. You can ask me about their skills, experience, projects, or how well they match your requirements.`,
            timestamp: new Date()
          }
        ],
        expiresAt: now + CHAT_EXPIRY_MS,
        candidateName: candidate.name
      }
      
      setCandidateChats(prev => ({
        ...prev,
        [candidate.student_id!]: newChat
      }))
    }
    
    setChatOpen(true)
  }
  
  const handleSendChatMessage = async () => {
    if (!currentChatMessage.trim() || !selectedCandidate || !selectedCandidate.student_id) return
    
    const studentId = selectedCandidate.student_id
    const userMessage: ChatMessage = {
      role: "user",
      content: currentChatMessage,
      timestamp: new Date()
    }
    
    // Add user message to chat history
    setCandidateChats(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        messages: [...prev[studentId].messages, userMessage],
        expiresAt: Date.now() + CHAT_EXPIRY_MS // Extend expiry on activity
      }
    }))
    
    setCurrentChatMessage("")
    setSendingMessage(true)
    
    try {
      const chatHistory = candidateChats[studentId].messages
      const messagesForAPI = [...chatHistory, userMessage].map(msg => ({
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
      
      setCandidateChats(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          messages: [...prev[studentId].messages, aiMessage]
        }
      }))
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I couldn't process your message. Please try again.",
        timestamp: new Date()
      }
      
      setCandidateChats(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          messages: [...prev[studentId].messages, errorMessage]
        }
      }))
      
      toast({
        title: "Chat Failed",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSendingMessage(false)
    }
  }
  
  const handleClearCandidateChat = () => {
    if (!selectedCandidate || !selectedCandidate.student_id) return
    
    const studentId = selectedCandidate.student_id
    const candidateName = selectedCandidate.name
    
    // Reset to initial message
    const now = Date.now()
    setCandidateChats(prev => ({
      ...prev,
      [studentId]: {
        messages: [
          {
            role: "assistant" as const,
            content: `Hi! I'm here to help you learn more about **${candidateName}**. You can ask me about their skills, experience, projects, or how well they match your requirements.`,
            timestamp: new Date()
          }
        ],
        expiresAt: now + CHAT_EXPIRY_MS,
        candidateName: candidateName
      }
    }))
    
    toast({
      title: "Chat Cleared",
      description: `Chat history with ${candidateName} has been cleared`,
    })
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden p-2 gap-6">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        <Card className="flex-1 flex flex-col h-full overflow-hidden border-2">
          <CardHeader className="border-b-2 flex-shrink-0">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Powered Headhunting
            </CardTitle>
            <CardDescription>
              Search for candidates using natural language. Describe the ideal candidate and let AI find the best matches.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
            {/* Chat History */}
            <ScrollArea className="flex-1 p-8 overflow-y-auto h-full">
              {searchHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 min-h-[400px]">
                  <Search className="h-16 w-16 text-muted-foreground/50" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Start Your Search</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Describe the candidate you're looking for. For example:
                      "Find me a senior software engineer with Python and React experience"
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery("Find me a software engineer with 3+ years of Python experience")}
                    >
                      Python Developer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery("Looking for a full-stack developer with React and Node.js skills")}
                    >
                      Full-Stack Developer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery("Need a data scientist with machine learning experience")}
                    >
                      Data Scientist
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {searchHistory.map((item, index) => (
                    <div key={index} className="space-y-4">
                      {item.isUser ? (
                        <div className="flex justify-end">
                          <div className="max-w-[85%] rounded-lg p-5 bg-primary text-primary-foreground shadow-md border-2 border-primary/20">
                            <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                            <p className="text-xs mt-2 opacity-70">
                              {item.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {/* Render structured candidate results */}
                          {item.candidates && item.candidates.length > 0 && (
                            <div className="space-y-5">
                              <div className="text-sm font-medium text-muted-foreground">
                                Found {item.candidates.length} matching candidate{item.candidates.length !== 1 ? 's' : ''}
                              </div>
                              {item.candidates.map((candidate, candIndex) => (
                                <Card key={candIndex} className="overflow-hidden border-2 shadow-sm hover:shadow-md transition-shadow">
                                  <CardHeader className="pb-4 bg-muted/30 border-b-2">
                                    <div className="flex items-start justify-between">
                                      <div className="space-y-1 flex-1">
                                        <CardTitle className="text-lg">{candidate.name}</CardTitle>
                                        <div className="flex gap-2 items-center">
                                          <Badge variant={candidate.fit_score >= 80 ? "default" : candidate.fit_score >= 60 ? "secondary" : "outline"} className="border-2">
                                            <Star className="h-3 w-3 mr-1" />
                                            Fit Score: {candidate.fit_score}%
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-4 pt-4">
                                    {candidate.evaluation_bullets.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">Evaluation</p>
                                        <ul className="text-sm space-y-1.5">
                                          {candidate.evaluation_bullets.map((bullet, bulletIndex) => (
                                            <li key={bulletIndex}>{bullet}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {candidate.notable_github_projects.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">Notable Projects</p>
                                        <ul className="text-sm space-y-1.5">
                                          {candidate.notable_github_projects.map((project, projIndex) => {
                                            // Extract repo name from project string (format: "repo-name: description" or just "repo-name")
                                            const repoMatch = project.match(/^([^:]+)/)
                                            const repoName = repoMatch ? repoMatch[1].trim() : project
                                            
                                            // Extract username from github_link if available
                                            let repoUrl = null
                                            if (candidate.github_link && candidate.github_link !== "N/A") {
                                              const usernameMatch = candidate.github_link.match(/github\.com\/([^\/]+)/)
                                              if (usernameMatch) {
                                                const username = usernameMatch[1]
                                                repoUrl = `https://github.com/${username}/${repoName}`
                                              }
                                            }
                                            
                                            return (
                                              <li key={projIndex} className="flex items-start gap-2 group">
                                                {repoUrl ? (
                                                  <>
                                                    <a 
                                                      href={repoUrl} 
                                                      target="_blank" 
                                                      rel="noopener noreferrer"
                                                      className="flex items-start gap-2 hover:text-primary transition-colors flex-1"
                                                    >
                                                      <ExternalLink className="h-3 w-3 mt-1 flex-shrink-0 group-hover:text-primary" />
                                                      <span className="group-hover:underline">{project}</span>
                                                    </a>
                                                  </>
                                                ) : (
                                                  <>
                                                    <ExternalLink className="h-3 w-3 mt-1 flex-shrink-0 text-muted-foreground" />
                                                    {project}
                                                  </>
                                                )}
                                              </li>
                                            )
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                    <div className="pt-3 border-t-2">
                                      <p className="text-xs font-medium text-muted-foreground mb-2">Recommended Next Step</p>
                                      <p className="text-sm">{candidate.next_step}</p>
                                    </div>
                                    
                                    {/* Links Section */}
                                    <div className="pt-3 border-t-2 space-y-2">
                                      {candidate.student_id && (
                                        <Button 
                                          variant="default" 
                                          size="sm" 
                                          className="w-full border-2 bg-primary" 
                                          onClick={() => handleOpenCandidateChat(candidate)}
                                        >
                                          <MessageSquare className="h-4 w-4 mr-2" />
                                          Know More About This Person
                                        </Button>
                                      )}
                                      {candidate.github_link && candidate.github_link !== "N/A" && (
                                        <Button variant="outline" size="sm" className="w-full border-2" asChild>
                                          <a href={candidate.github_link} target="_blank" rel="noopener noreferrer">
                                            <Github className="h-4 w-4 mr-2" />
                                            View GitHub Profile
                                          </a>
                                        </Button>
                                      )}
                                      {candidate.candidate_link && (
                                        <Button variant="outline" size="sm" className="w-full border-2" asChild>
                                          <a href={candidate.candidate_link} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            View Full Profile
                                          </a>
                                        </Button>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                          {/* Render raw text response if structured data not available */}
                          {item.message && (
                            <div className="bg-secondary rounded-lg p-5 border-2 shadow-sm">
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{item.message}</ReactMarkdown>
                              </div>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {item.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
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
              {searchHistory.length > 0 && (
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
                  placeholder="Describe the candidate you're looking for..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSearch()
                    }
                  }}
                  disabled={loading}
                  className="flex-1 border-2"
                />
                <Button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || loading}
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
                Press Enter to search • Uses AI-powered semantic matching across resumes and GitHub portfolios
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tips Sidebar */}
      <div className="w-80 space-y-4 flex-shrink-0">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm">Search Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Be Specific</p>
              <p className="text-xs text-muted-foreground">
                Include skills, experience level, and technologies
              </p>
            </div>
            <div>
              <p className="font-medium">Use Natural Language</p>
              <p className="text-xs text-muted-foreground">
                Describe requirements as you would to a person
              </p>
            </div>
            <div>
              <p className="font-medium">Include Context</p>
              <p className="text-xs text-muted-foreground">
                Mention project types or industry experience
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm">Example Queries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              • "Senior developer with React and TypeScript, 5+ years experience"
            </p>
            <p className="text-muted-foreground">
              • "Machine learning engineer familiar with PyTorch and TensorFlow"
            </p>
            <p className="text-muted-foreground">
              • "Full-stack engineer with cloud experience (AWS/Azure)"
            </p>
            <p className="text-muted-foreground">
              • "Data analyst with SQL and Python, experience in finance"
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Candidate Chat Sheet */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="w-[500px] sm:w-[540px] sm:max-w-[540px] flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Chat About Candidate
            </SheetTitle>
            <SheetDescription>
              {selectedCandidate ? (
                <>Ask questions about <strong>{selectedCandidate.name}</strong> and their qualifications</>
              ) : (
                "Learn more about this candidate"
              )}
            </SheetDescription>
          </SheetHeader>
          
          {selectedCandidate && selectedCandidate.student_id && candidateChats[selectedCandidate.student_id] && (
            <>
              {/* Chat Messages */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-6">
                  <div className="space-y-4">
                    {candidateChats[selectedCandidate.student_id].messages.map((message, index) => (
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
              </div>
              
              {/* Chat Input */}
              <div className="p-6 pt-4 border-t border-border space-y-2">
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearCandidateChat}
                    className="text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear Chat
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={`Ask about ${selectedCandidate.name}...`}
                    value={currentChatMessage}
                    onChange={(e) => setCurrentChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendChatMessage()
                      }
                    }}
                    disabled={sendingMessage}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSendChatMessage} 
                    disabled={!currentChatMessage.trim() || sendingMessage} 
                    size="icon"
                  >
                    {sendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Enter to send • Chat expires after 1 hour of inactivity
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
