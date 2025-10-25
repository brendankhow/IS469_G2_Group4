"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Send, Bot, Github, MessageSquare, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import ReactMarkdown from "react-markdown"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  analysisType?: string
}

interface UserProfile {
  id: number
  name?: string
  github_username?: string
}

interface GithubChatHistory {
  [studentId: string]: {
    messages: ChatMessage[]
    expiresAt: number
  }
}

type AnalysisType = "quick" | "interview_prep" | "resume" | "job_fit"

// LocalStorage utilities for chat persistence
const GITHUB_CHAT_STORAGE_KEY = "github_assistant_chats"
const CHAT_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

const loadGithubChats = (): GithubChatHistory => {
  if (typeof window === "undefined") return {}
  
  try {
    const stored = localStorage.getItem(GITHUB_CHAT_STORAGE_KEY)
    if (!stored) return {}
    
    const parsed: GithubChatHistory = JSON.parse(stored)
    const now = Date.now()
    
    // Filter out expired chats silently
    const filtered: GithubChatHistory = {}
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
    console.error("Error loading GitHub chat history:", error)
    return {}
  }
}

const saveGithubChats = (history: GithubChatHistory) => {
  if (typeof window === "undefined") return
  
  try {
    localStorage.setItem(GITHUB_CHAT_STORAGE_KEY, JSON.stringify(history))
  } catch (error) {
    console.error("Error saving GitHub chat history:", error)
  }
}

const analysisTypeLabels: Record<AnalysisType, string> = {
  quick: "Quick Summary",
  interview_prep: "Interview Preparation",
  resume: "Resume Content",
  job_fit: "Job Fit Analysis"
}

const analysisTypeDescriptions: Record<AnalysisType, string> = {
  quick: "Get a 30-second overview of your technical identity, standout projects, and key skills",
  interview_prep: "Prepare elevator pitches, project talking points, and likely interview questions",
  resume: "Generate professional summaries, bullet points, and ATS-optimized keywords",
  job_fit: "Discover ideal job titles, target industries, and salary expectations"
}

export default function GithubAssistantPage() {
  const { toast } = useToast()
  const [currentMessage, setCurrentMessage] = useState("")
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<AnalysisType>("quick")

  useEffect(() => {
    fetchProfile()
  }, [])
  
  // Load chat history from localStorage when profile is loaded
  useEffect(() => {
    if (profile) {
      const studentKey = profile.id.toString()
      const allChats = loadGithubChats()
      
      if (allChats[studentKey] && allChats[studentKey].messages) {
        setChatHistory(allChats[studentKey].messages)
      }
    }
  }, [profile])
  
  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (profile && chatHistory.length > 0) {
      const studentKey = profile.id.toString()
      const allChats = loadGithubChats()
      
      allChats[studentKey] = {
        messages: chatHistory,
        expiresAt: Date.now() + CHAT_EXPIRY_MS
      }
      
      saveGithubChats(allChats)
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

  const handleAnalysisRequest = async () => {
    if (!profile || !profile.github_username) return

    setLoading(true)

    // Add user message to history
    const userMessage: ChatMessage = {
      role: "user",
      content: `Generate ${analysisTypeLabels[selectedAnalysisType]} analysis`,
      timestamp: new Date(),
      analysisType: selectedAnalysisType,
    }
    setChatHistory((prev) => [...prev, userMessage])

    try {
      const response = await fetch("/api/ai/github-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: profile.id.toString(),
          github_username: profile.github_username,
          analysis_type: selectedAnalysisType,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get GitHub analysis")
      }

      const data = await response.json()

      // Format the response based on analysis type
      const formattedContent = formatAnalysisResponse(data.analysis, selectedAnalysisType)

      const aiMessage: ChatMessage = {
        role: "assistant",
        content: formattedContent,
        timestamp: new Date(),
        analysisType: selectedAnalysisType,
      }

      setChatHistory((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("GitHub analysis error:", error)
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I couldn't analyze your GitHub profile. Please make sure your GitHub username is set in your profile and try again.",
        timestamp: new Date(),
      }
      setChatHistory((prev) => [...prev, errorMessage])
      toast({
        title: "Analysis Failed",
        description: "Failed to get GitHub analysis. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatAnalysisResponse = (analysis: any, type: AnalysisType): string => {
    if (!analysis) return "No analysis data received."

    switch (type) {
      case "quick":
        return formatQuickSummary(analysis)
      case "interview_prep":
        return formatInterviewPrep(analysis)
      case "resume":
        return formatResume(analysis)
      case "job_fit":
        return formatJobFit(analysis)
      default:
        return JSON.stringify(analysis, null, 2)
    }
  }

  const formatQuickSummary = (analysis: any) => {
    return `# Quick Summary

**Technical Identity:** ${analysis.technical_identity}

${analysis.quick_summary}

## 🌟 Standout Projects
${analysis.standout_projects?.map((project: string) => `- ${project}`).join("\n")}

## 💡 Key Skills
${analysis.key_skills?.map((skill: string) => `- ${skill}`).join("\n")}

## 📊 Job Readiness
**Status:** ${analysis.job_readiness}

## 🎯 One Thing to Improve
${analysis.one_thing_to_improve}`
  }

  const formatInterviewPrep = (analysis: any) => {
    let content = `# Interview Preparation

## 🎤 Elevator Pitch
${analysis.elevator_pitch}

## 💼 Project Talking Points\n`

    analysis.project_talking_points?.forEach((project: any) => {
      content += `\n### ${project.project}
**What to Say:** ${project.what_to_say}

**Technical Details:**
${project.technical_details_to_highlight?.map((detail: string) => `- ${detail}`).join("\n")}

**Challenges Overcome:** ${project.challenges_overcome}\n`
    })

    content += `\n## ❓ Likely Interview Questions\n`
    analysis.likely_questions?.forEach((q: any, i: number) => {
      content += `\n**Q${i + 1}: ${q.question}**
*How to Answer:* ${q.how_to_answer}
*Reference Projects:* ${q.projects_to_reference?.join(", ")}\n`
    })

    content += `\n## 📚 Technical Discussion Prep\n`
    analysis.technical_discussion_prep?.forEach((topic: any) => {
      content += `\n### ${topic.topic}
- **What You Know:** ${topic.what_you_know}
- **What to Study:** ${topic.what_to_study}\n`
    })

    if (analysis.behavioral_stories?.length > 0) {
      content += `\n## 💡 Behavioral Stories\n`
      analysis.behavioral_stories.forEach((story: string, i: number) => {
        content += `${i + 1}. ${story}\n`
      })
    }

    if (analysis.questions_to_ask_interviewer?.length > 0) {
      content += `\n## 🤔 Questions to Ask Interviewer\n`
      analysis.questions_to_ask_interviewer.forEach((q: string) => {
        content += `- ${q}\n`
      })
    }

    return content
  }

  const formatResume = (analysis: any) => {
    let content = `# Resume Content

## 📝 Professional Summary
${analysis.professional_summary}

## 🛠️ Technical Skills

**Programming Languages:** ${analysis.technical_skills?.programming_languages?.join(", ")}

**Frameworks & Libraries:** ${analysis.technical_skills?.frameworks_libraries?.join(", ")}

**Tools & Platforms:** ${analysis.technical_skills?.tools_platforms?.join(", ")}

**Databases:** ${analysis.technical_skills?.databases?.join(", ")}

**Concepts:** ${analysis.technical_skills?.concepts?.join(", ")}

## 💼 Project Experience\n`

    analysis.project_experience?.forEach((project: any, i: number) => {
      content += `\n### ${project.project_title}
**Role:** ${project.role} | **Date:** ${project.date}

**Achievements:**
${project.bullet_points?.map((point: string) => `- ${point}`).join("\n")}

**Technologies:** ${project.technologies_used?.join(", ")}\n`
    })

    content += `\n## 🎯 ATS Keywords
${analysis.ats_keywords?.join(", ")}

## 📈 Achievement Metrics
${analysis.achievement_metrics?.map((metric: string) => `- ${metric}`).join("\n")}

## ✍️ Suggested Action Verbs
${analysis.suggested_action_verbs?.join(", ")}`

    return content
  }

  const formatJobFit = (analysis: any) => {
    let content = `# Job Fit Analysis

## 📊 Current Level Assessment
**Experience Level:** ${analysis.current_level_assessment?.experience_level}
**Years Equivalent:** ${analysis.current_level_assessment?.years_equivalent}
**Reasoning:** ${analysis.current_level_assessment?.reasoning}

## 🎯 Ideal Job Titles\n`

    analysis.ideal_job_titles?.forEach((job: any) => {
      content += `\n### ${job.title} (Fit Score: ${job.fit_score}/10)
**Match Strengths:**
${job.match_strengths?.map((s: string) => `- ${s}`).join("\n")}

**Skill Gaps:**
${job.skill_gaps?.map((s: string) => `- ${s}`).join("\n")}

**Example Companies:** ${job.example_companies?.join(", ")}\n`
    })

    if (analysis.stretch_roles?.length > 0) {
      content += `\n## 🚀 Stretch Roles\n`
      analysis.stretch_roles.forEach((role: any) => {
        content += `\n### ${role.title}
**What to Strengthen:**
${role.what_to_strengthen?.map((s: string) => `- ${s}`).join("\n")}
**Timeline:** ${role.timeline}\n`
      })
    }

    content += `\n## 🏢 Industries to Target\n`
    analysis.industries_to_target?.forEach((industry: any) => {
      content += `\n### ${industry.industry}
**Why Good Fit:** ${industry.why_good_fit}
**Example Companies:** ${industry.example_companies?.join(", ")}\n`
    })

    content += `\n## 🏭 Company Size Fit
- **Startup:** ${analysis.company_size_fit?.startup}
- **Mid-size:** ${analysis.company_size_fit?.mid_size}
- **Enterprise:** ${analysis.company_size_fit?.enterprise}

## 💰 Salary Expectations
**Estimated Range:** ${analysis.salary_expectations?.estimated_range}

**Factors:**
${analysis.salary_expectations?.factors?.map((f: string) => `- ${f}`).join("\n")}

**Growth Potential:** ${analysis.salary_expectations?.growth_potential}

## 🌟 Competitive Positioning

**Strong Differentiators:**
${analysis.competitive_positioning?.strong_differentiators?.map((d: string) => `- ${d}`).join("\n")}

**Common Gaps:**
${analysis.competitive_positioning?.common_gaps?.map((g: string) => `- ${g}`).join("\n")}

**Unique Value Proposition:** ${analysis.competitive_positioning?.unique_value_proposition}

## 🔍 Job Search Strategy
${analysis.job_search_strategy?.map((s: string) => `- ${s}`).join("\n")}`

    return content
  }

  const handleClearHistory = () => {
    setChatHistory([])
    
    // Clear from localStorage as well
    if (profile) {
      const studentKey = profile.id.toString()
      const allChats = loadGithubChats()
      delete allChats[studentKey]
      saveGithubChats(allChats)
    }
    
    toast({
      title: "History Cleared",
      description: "Chat history has been cleared",
    })
  }

  if (profileLoading) {
    return (
      <div className="flex h-[calc(100vh-2rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const hasGithubUsername = profile && profile.github_username

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden p-2 gap-6">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        <Card className="flex-1 flex flex-col h-full overflow-hidden border-2">
          <CardHeader className="border-b-2 flex-shrink-0">
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5 text-primary" />
              GitHub Assistant
            </CardTitle>
            <CardDescription>
              Get career insights, interview prep, and resume content based on your GitHub activity
            </CardDescription>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
            {!hasGithubUsername ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8">
                <Github className="h-16 w-16 text-muted-foreground/50" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Add Your GitHub Username</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    To use the GitHub Assistant, you need to add your GitHub username in your profile.
                    This allows the AI to analyze your repositories and provide personalized career insights.
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
                        <h3 className="text-lg font-semibold">Start Your Analysis</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          Select an analysis mode below and click "Analyze" to get personalized insights based on your GitHub profile.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Analyzing: <span className="font-mono font-semibold">{profile.github_username}</span>
                        </p>
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

                {/* Analysis Controls */}
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
                    <Select
                      value={selectedAnalysisType}
                      onValueChange={(value) => setSelectedAnalysisType(value as AnalysisType)}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-[280px] border-2">
                        <SelectValue placeholder="Select analysis mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quick">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            <span>Quick Summary</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="interview_prep">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            <span>Interview Preparation</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="resume">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            <span>Resume Content</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="job_fit">
                          <div className="flex items-center gap-2">
                            <Github className="h-4 w-4" />
                            <span>Job Fit Analysis</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAnalysisRequest}
                      disabled={loading}
                      className="border-2 flex-1"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Analyze
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {analysisTypeDescriptions[selectedAnalysisType]}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analysis Modes Sidebar */}
      <div className="w-80 space-y-4 flex-shrink-0">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Analysis Modes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">⚡ Quick Summary</p>
              <p className="text-xs text-muted-foreground">
                30-second overview of technical identity, standout projects, and key skills
              </p>
            </div>
            <div>
              <p className="font-medium">🎤 Interview Prep</p>
              <p className="text-xs text-muted-foreground">
                Elevator pitches, project talking points, and likely interview questions
              </p>
            </div>
            <div>
              <p className="font-medium">📝 Resume Builder</p>
              <p className="text-xs text-muted-foreground">
                Professional summaries, bullet points, and ATS-optimized keywords
              </p>
            </div>
            <div>
              <p className="font-medium">🎯 Job Fit Analysis</p>
              <p className="text-xs text-muted-foreground">
                Ideal job titles, target industries, and salary expectations
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Start with Quick Summary</p>
              <p className="text-xs text-muted-foreground">
                Get an overview of your technical profile first
              </p>
            </div>
            <div>
              <p className="font-medium">Use Interview Prep Before Interviews</p>
              <p className="text-xs text-muted-foreground">
                Practice your talking points and prepare answers
              </p>
            </div>
            <div>
              <p className="font-medium">Update Your Resume</p>
              <p className="text-xs text-muted-foreground">
                Use the resume analysis to improve your content
              </p>
            </div>
            <div>
              <p className="font-medium">Check Job Fit Regularly</p>
              <p className="text-xs text-muted-foreground">
                Understand which roles match your skills best
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
