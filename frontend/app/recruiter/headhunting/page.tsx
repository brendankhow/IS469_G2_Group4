"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, Search, Sparkles, Star, Github, ExternalLink } from "lucide-react"
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
}

interface SearchResult {
  message?: string
  candidates?: CandidateResult[]
  timestamp: Date
  isUser: boolean
}

export default function HeadhuntingPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchHistory, setSearchHistory] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

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
    toast({
      title: "History Cleared",
      description: "Search history has been cleared",
    })
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden p-4 gap-6">
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
            <ScrollArea className="flex-1 p-8 overflow-y-auto">
              {searchHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
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
                                          {candidate.github_link && (
                                            <a
                                              href={candidate.github_link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                                            >
                                              <Github className="h-3 w-3" />
                                              GitHub
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-4 pt-4">
                                    {candidate.evaluation_bullets.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">Evaluation</p>
                                        <ul className="text-sm space-y-1.5 list-disc list-inside">
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
                                          {candidate.notable_github_projects.map((project, projIndex) => (
                                            <li key={projIndex} className="flex items-start gap-2">
                                              <ExternalLink className="h-3 w-3 mt-1 flex-shrink-0" />
                                              {project}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    <div className="pt-3 border-t-2">
                                      <p className="text-xs font-medium text-muted-foreground mb-2">Recommended Next Step</p>
                                      <p className="text-sm">{candidate.next_step}</p>
                                    </div>
                                    {candidate.candidate_link && (
                                      <Button variant="outline" size="sm" className="w-full border-2" asChild>
                                        <a href={candidate.candidate_link} target="_blank" rel="noopener noreferrer">
                                          View Full Profile
                                        </a>
                                      </Button>
                                    )}
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
    </div>
  )
}
