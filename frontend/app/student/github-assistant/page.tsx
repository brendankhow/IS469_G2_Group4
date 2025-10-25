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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Send, Bot, Github, MessageSquare, Sparkles, Briefcase, Code2, Search } from "lucide-react"
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
    overall: {
      messages: ChatMessage[]
      expiresAt: number
    }
    repository: {
      messages: ChatMessage[]
      expiresAt: number
    }
    jobFit: {
      messages: ChatMessage[]
      expiresAt: number
    }
  }
}

type AnalysisType = "quick" | "interview_prep" | "resume" | "job_fit"
type AnalysisFocus = "all" | "interview"
type TabType = "overall" | "repository" | "job-fit"

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
      const studentData = parsed[studentId]
      
      // Handle both old and new formats
      if (studentData.overall && studentData.repository) {
        // New format
        if (studentData.overall.expiresAt > now || studentData.repository.expiresAt > now || studentData.jobFit?.expiresAt > now) {
          filtered[studentId] = {
            overall: {
              messages: studentData.overall.expiresAt > now 
                ? studentData.overall.messages.map(msg => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                  }))
                : [],
              expiresAt: studentData.overall.expiresAt
            },
            repository: {
              messages: studentData.repository.expiresAt > now
                ? studentData.repository.messages.map(msg => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                  }))
                : [],
              expiresAt: studentData.repository.expiresAt
            },
            jobFit: {
              messages: studentData.jobFit && studentData.jobFit.expiresAt > now
                ? studentData.jobFit.messages.map(msg => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                  }))
                : [],
              expiresAt: studentData.jobFit?.expiresAt || Date.now() + CHAT_EXPIRY_MS
            }
          }
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
  const [overallChatHistory, setOverallChatHistory] = useState<ChatMessage[]>([])
  const [repositoryChatHistory, setRepositoryChatHistory] = useState<ChatMessage[]>([])
  const [jobFitChatHistory, setJobFitChatHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<AnalysisType>("quick")
  const [selectedAnalysisFocus, setSelectedAnalysisFocus] = useState<AnalysisFocus>("interview")
  const [activeTab, setActiveTab] = useState<TabType>("overall")
  const [repoName, setRepoName] = useState("")
  const [targetRole, setTargetRole] = useState("")
  const [availableRepos, setAvailableRepos] = useState<string[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [chatInput, setChatInput] = useState("")

  const chatHistory = activeTab === "overall" ? overallChatHistory : activeTab === "repository" ? repositoryChatHistory : jobFitChatHistory
  const setChatHistory = activeTab === "overall" ? setOverallChatHistory : activeTab === "repository" ? setRepositoryChatHistory : setJobFitChatHistory

  useEffect(() => {
    fetchProfile()
  }, [])
  
  // Load chat history from localStorage when profile is loaded
  useEffect(() => {
    if (profile) {
      const studentKey = profile.id.toString()
      const allChats = loadGithubChats()
      
      if (allChats[studentKey]) {
        if (allChats[studentKey].overall?.messages) {
          setOverallChatHistory(allChats[studentKey].overall.messages)
        }
        if (allChats[studentKey].repository?.messages) {
          setRepositoryChatHistory(allChats[studentKey].repository.messages)
        }
        if (allChats[studentKey].jobFit?.messages) {
          setJobFitChatHistory(allChats[studentKey].jobFit.messages)
        }
      }
    }
  }, [profile])
  
  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (profile && (overallChatHistory.length > 0 || repositoryChatHistory.length > 0 || jobFitChatHistory.length > 0)) {
      const studentKey = profile.id.toString()
      const allChats = loadGithubChats()
      
      if (!allChats[studentKey]) {
        allChats[studentKey] = {
          overall: { messages: [], expiresAt: Date.now() + CHAT_EXPIRY_MS },
          repository: { messages: [], expiresAt: Date.now() + CHAT_EXPIRY_MS },
          jobFit: { messages: [], expiresAt: Date.now() + CHAT_EXPIRY_MS }
        }
      }
      
      allChats[studentKey].overall = {
        messages: overallChatHistory,
        expiresAt: Date.now() + CHAT_EXPIRY_MS
      }
      
      allChats[studentKey].repository = {
        messages: repositoryChatHistory,
        expiresAt: Date.now() + CHAT_EXPIRY_MS
      }
      
      allChats[studentKey].jobFit = {
        messages: jobFitChatHistory,
        expiresAt: Date.now() + CHAT_EXPIRY_MS
      }
      
      saveGithubChats(allChats)
    }
  }, [overallChatHistory, repositoryChatHistory, jobFitChatHistory, profile])

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

  const fetchAvailableRepos = async () => {
    if (!profile?.id) return
    
    setLoadingRepos(true)
    try {
      const response = await fetch(`/api/ai/github-repos?student_id=${profile.id}`)
      if (!response.ok) throw new Error("Failed to fetch repos")
      
      const data = await response.json()
      setAvailableRepos(data.repos || [])
    } catch (error) {
      console.error("Error fetching repos:", error)
      toast({
        title: "Error",
        description: "Failed to load available repositories",
        variant: "destructive",
      })
    } finally {
      setLoadingRepos(false)
    }
  }

  useEffect(() => {
    if (profile && activeTab === "repository" && availableRepos.length === 0) {
      fetchAvailableRepos()
    }
  }, [profile, activeTab])

  const handleAnalysisRequest = async () => {
    if (!profile || !profile.github_username) return
    if (activeTab === "repository" && !repoName.trim()) {
      toast({
        title: "Repository Required",
        description: "Please enter a repository name",
        variant: "destructive",
      })
      return
    }
    if (activeTab === "job-fit" && !targetRole.trim()) {
      toast({
        title: "Target Role Required",
        description: "Please enter a target job role",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    // Add user message to history
    const userMessage: ChatMessage = {
      role: "user",
      content: activeTab === "overall" 
        ? `Generate ${analysisTypeLabels[selectedAnalysisType]} analysis`
        : activeTab === "repository"
        ? `Analyze ${repoName} - ${selectedAnalysisFocus === "all" ? "Complete Analysis" : "Interview Preparation"}`
        : `Analyze fit for ${targetRole} role`,
      timestamp: new Date(),
      analysisType: activeTab === "overall" ? selectedAnalysisType : undefined,
    }
    setChatHistory((prev) => [...prev, userMessage])

    try {
      let response
      if (activeTab === "overall") {
        response = await fetch("/api/ai/github-analysis", {
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
      } else if (activeTab === "repository") {
        response = await fetch("/api/ai/github-repo-analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            student_id: profile.id.toString(),
            repo_name: repoName,
            analysis_focus: selectedAnalysisFocus,
          }),
        })
      } else {
        response = await fetch("/api/ai/github-job-fit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            student_id: profile.id.toString(),
            target_role: targetRole,
          }),
        })
      }

      if (!response.ok) {
        throw new Error("Failed to get GitHub analysis")
      }

      const data = await response.json()

      // Format the response based on analysis type
      const formattedContent = activeTab === "overall"
        ? formatAnalysisResponse(data.analysis, selectedAnalysisType)
        : activeTab === "repository"
        ? formatRepositoryAnalysis(data.analysis, selectedAnalysisFocus)
        : formatJobFitAnalysis(data.analysis)

      const aiMessage: ChatMessage = {
        role: "assistant",
        content: formattedContent,
        timestamp: new Date(),
        analysisType: activeTab === "overall" ? selectedAnalysisType : undefined,
      }

      setChatHistory((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("GitHub analysis error:", error)
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: activeTab === "overall"
          ? "Sorry, I couldn't analyze your GitHub profile. Please make sure your GitHub username is set in your profile and try again."
          : activeTab === "repository"
          ? "Sorry, I couldn't analyze this repository. Please make sure the repository name is correct and try again."
          : "Sorry, I couldn't analyze the job fit. Please try again.",
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

  const formatRepositoryAnalysis = (analysis: any, focus: AnalysisFocus) => {
    if (!analysis) return "No analysis data received."

    let content = `# Repository Analysis\n\n`

    // Project Overview
    if (analysis.project_overview) {
      content += `## 📋 Project Overview

**One-liner:** ${analysis.project_overview.one_liner}

${analysis.project_overview.detailed_summary}

**Problem Statement:** ${analysis.project_overview.problem_statement}

**Solution Approach:** ${analysis.project_overview.solution_approach}

**Target Users:** ${analysis.project_overview.target_users}

**Real-world Application:** ${analysis.project_overview.real_world_application}\n\n`
    }

    // Technical Deep Dive
    if (analysis.technical_deep_dive) {
      content += `## 🔧 Technical Deep Dive

**Architecture:** ${analysis.technical_deep_dive.architecture}

**Design Patterns:** ${analysis.technical_deep_dive.design_patterns?.join(", ")}

### Technology Choices\n`
      
      analysis.technical_deep_dive.technology_choices?.forEach((tech: any) => {
        content += `\n**${tech.technology}**
- Why Good Choice: ${tech.why_good_choice}
- Alternatives: ${tech.alternatives?.join(", ")}\n`
      })

      content += `\n**Code Quality Score:** ${analysis.technical_deep_dive.code_quality_assessment?.score}/10

**Strengths:**
${analysis.technical_deep_dive.code_quality_assessment?.strengths?.map((s: string) => `- ${s}`).join("\n")}

**Areas for Improvement:**
${analysis.technical_deep_dive.code_quality_assessment?.areas_for_improvement?.map((a: string) => `- ${a}`).join("\n")}

**Scalability:** ${analysis.technical_deep_dive.scalability_analysis}

**Security:** ${analysis.technical_deep_dive.security_considerations}

**Complexity:** ${analysis.technical_deep_dive.complexity_rating}\n\n`
    }

    // Interview Discussion Guide (always shown but especially for interview focus)
    if (analysis.interview_discussion_guide) {
      content += `## 🎤 Interview Discussion Guide

**Elevator Pitch:** ${analysis.interview_discussion_guide.elevator_pitch}

**Key Talking Points:**
${analysis.interview_discussion_guide.key_talking_points?.map((p: string) => `- ${p}`).join("\n")}

### Expected Technical Questions\n`

      analysis.interview_discussion_guide.technical_questions_to_expect?.forEach((q: any, i: number) => {
        content += `\n**Q${i + 1}: ${q.question}**
*Suggested Answer:* ${q.suggested_answer}\n`
      })

      if (analysis.interview_discussion_guide.challenges_to_discuss?.length > 0) {
        content += `\n### Challenges to Discuss\n`
        analysis.interview_discussion_guide.challenges_to_discuss.forEach((c: any) => {
          content += `\n**Challenge:** ${c.challenge}
**Solution:** ${c.solution}
**Learning:** ${c.learning}\n`
        })
      }

      if (analysis.interview_discussion_guide.advanced_discussion_topics?.length > 0) {
        content += `\n**Advanced Discussion Topics:**
${analysis.interview_discussion_guide.advanced_discussion_topics?.map((t: string) => `- ${t}`).join("\n")}\n\n`
      }
    }

    // Full analysis includes presentation improvements and enhancements
    if (focus === "all") {
      if (analysis.presentation_improvements) {
        content += `## 📝 Presentation Improvements

### README Assessment
**Current Quality:** ${analysis.presentation_improvements.readme_assessment?.current_quality}

**Missing Elements:**
${analysis.presentation_improvements.readme_assessment?.missing_elements?.map((e: string) => `- ${e}`).join("\n")}

**Suggested README Structure:**
${analysis.presentation_improvements.readme_assessment?.suggested_structure?.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}

### Suggested Content

**Title:** ${analysis.presentation_improvements.suggested_readme_content?.title_and_tagline}

**Description:** ${analysis.presentation_improvements.suggested_readme_content?.description}

**Key Features:**
${analysis.presentation_improvements.suggested_readme_content?.key_features?.map((f: string) => `- ${f}`).join("\n")}

**Tech Stack:** ${analysis.presentation_improvements.suggested_readme_content?.tech_stack_presentation}

### Demo Recommendations
**What to Show:**
${analysis.presentation_improvements.demo_recommendations?.what_to_show?.map((s: string) => `- ${s}`).join("\n")}

**Demo Flow:** ${analysis.presentation_improvements.demo_recommendations?.demo_flow}

**Talking Points:**
${analysis.presentation_improvements.demo_recommendations?.talking_points_during_demo?.map((p: string) => `- ${p}`).join("\n")}\n\n`
      }

      if (analysis.enhancement_suggestions?.length > 0) {
        content += `## 🚀 Enhancement Suggestions\n`
        analysis.enhancement_suggestions.forEach((suggestion: any, i: number) => {
          content += `\n### ${i + 1}. ${suggestion.suggestion} (${suggestion.priority} priority)
**Impact:** ${suggestion.impact}
**Effort:** ${suggestion.effort}
**Implementation Hints:** ${suggestion.implementation_hints}\n`
        })
      }

      if (analysis.portfolio_value) {
        content += `\n## 💼 Portfolio Value

**Current Score:** ${analysis.portfolio_value.current_score}/10
**Value for Job Search:** ${analysis.portfolio_value.value_for_job_search}

**Best Used For:**
${analysis.portfolio_value.best_used_for?.map((u: string) => `- ${u}`).join("\n")}

**Demonstrates Fit For:**
${analysis.portfolio_value.roles_this_demonstrates_fit_for?.map((r: string) => `- ${r}`).join("\n")}`
      }
    }

    return content
  }

  const formatJobFitAnalysis = (analysis: any) => {
    if (!analysis) return "No analysis data received."

    let content = `# Job Fit Analysis for ${targetRole}\n\n`

    // Role Requirements
    if (analysis.role_requirements) {
      content += `## 📋 Role Requirements\n\n`
      
      content += `### Must-Have Skills\n`
      content += analysis.role_requirements.must_have_skills?.map((skill: string) => `- ${skill}`).join("\n")
      
      content += `\n\n### Nice-to-Have Skills\n`
      content += analysis.role_requirements.nice_to_have_skills?.map((skill: string) => `- ${skill}`).join("\n")
      
      content += `\n\n### Typical Projects\n`
      content += analysis.role_requirements.typical_projects?.map((project: string) => `- ${project}`).join("\n")
      content += `\n\n`
    }

    // Gap Analysis
    if (analysis.gap_analysis) {
      content += `## 📊 Gap Analysis\n\n`
      content += `**Overall Fit Score:** ${analysis.gap_analysis.overall_fit_score}/10\n\n`
      
      content += `### ✅ Skills You Have\n`
      content += analysis.gap_analysis.has?.map((skill: string) => `- ${skill}`).join("\n")
      
      content += `\n\n### ⚠️ Missing Critical Skills\n`
      content += analysis.gap_analysis.missing_critical?.map((skill: string) => `- ${skill}`).join("\n")
      
      content += `\n\n### 💡 Missing Nice-to-Have Skills\n`
      content += analysis.gap_analysis.missing_nice_to_have?.map((skill: string) => `- ${skill}`).join("\n")
      content += `\n\n`
    }

    // Projects that Demonstrate Fit
    if (analysis.projects_that_demonstrate_fit?.length > 0) {
      content += `## 💼 Your Projects That Demonstrate Fit\n\n`
      analysis.projects_that_demonstrate_fit.forEach((project: any) => {
        content += `### ${project.project}\n`
        content += `**Relevant Skills:** ${project.relevant_skills?.join(", ")}\n\n`
        content += `**How to Present:** ${project.how_to_present}\n\n`
      })
    }

    // Skill Building Roadmap
    if (analysis.skill_building_roadmap?.length > 0) {
      content += `## 🎯 Skill Building Roadmap\n\n`
      analysis.skill_building_roadmap.forEach((item: any, index: number) => {
        content += `### ${index + 1}. ${item.skill} (${item.priority} priority)\n`
        content += `**Why Important:** ${item.why_important}\n\n`
        content += `**How to Learn:** ${item.how_to_learn}\n\n`
        content += `**Project Idea:** ${item.project_idea}\n\n`
        content += `**Timeline:** ${item.timeline}\n\n`
      })
    }

    // Current Competitiveness
    if (analysis.current_competitiveness) {
      content += `## 🏆 Current Competitiveness\n\n`
      content += `**Rating:** ${analysis.current_competitiveness.rating}\n\n`
      content += `**Reasoning:** ${analysis.current_competitiveness.reasoning}\n\n`
      content += `**Percentile Estimate:** ${analysis.current_competitiveness.percentile_estimate}\n\n`
    }

    // Application Strategy
    if (analysis.application_strategy) {
      content += `## 🎯 Application Strategy\n\n`
      content += `**Should Apply Now:** ${analysis.application_strategy.should_apply_now}\n\n`
      content += `**Reasoning:** ${analysis.application_strategy.reasoning}\n\n`
      content += `**How to Position Yourself:** ${analysis.application_strategy.how_to_position_yourself}\n\n`
      
      content += `### Resume Focus\n`
      content += analysis.application_strategy.resume_focus?.map((item: string) => `- ${item}`).join("\n")
      
      content += `\n\n### Interview Preparation Focus\n`
      content += analysis.application_strategy.interview_preparation_focus?.map((item: string) => `- ${item}`).join("\n")
    }

    return content
  }

  const handleChatMessage = async () => {
    if (!chatInput.trim() || !profile) return
    
    setLoading(true)
    
    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput,
      timestamp: new Date()
    }
    setChatHistory((prev) => [...prev, userMessage])
    setChatInput("")
    
    try {
      // Send follow-up question with context from previous analysis
      const response = await fetch("/api/ai/github-followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: profile.id.toString(),
          github_username: profile.github_username,
          question: chatInput,
          chat_history: overallChatHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to get follow-up response")
      }
      
      const data = await response.json()
      
      const aiMessage: ChatMessage = {
        role: "assistant",
        content: data.response,
        timestamp: new Date()
      }
      
      setChatHistory((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("Follow-up question error:", error)
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I couldn't process your question. Please try again.",
        timestamp: new Date(),
      }
      setChatHistory((prev) => [...prev, errorMessage])
      toast({
        title: "Error",
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
      const allChats = loadGithubChats()
      
      if (allChats[studentKey]) {
        if (activeTab === "overall") {
          allChats[studentKey].overall = { messages: [], expiresAt: Date.now() + CHAT_EXPIRY_MS }
        } else if (activeTab === "repository") {
          allChats[studentKey].repository = { messages: [], expiresAt: Date.now() + CHAT_EXPIRY_MS }
        } else {
          allChats[studentKey].jobFit = { messages: [], expiresAt: Date.now() + CHAT_EXPIRY_MS }
        }
        saveGithubChats(allChats)
      }
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
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="flex-1 flex flex-col min-h-0">
                <div className="border-b-2 px-6 pt-4 flex-shrink-0">
                  <TabsList className="grid w-full max-w-2xl grid-cols-3">
                    <TabsTrigger value="overall" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Overall Analysis
                    </TabsTrigger>
                    <TabsTrigger value="repository" className="gap-2">
                      <Code2 className="h-4 w-4" />
                      Repository Analysis
                    </TabsTrigger>
                    <TabsTrigger value="job-fit" className="gap-2">
                      <Briefcase className="h-4 w-4" />
                      Job Fit Analysis
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overall" className="flex-1 flex flex-col m-0 data-[state=active]:flex overflow-hidden">
                  {/* Overall Analysis Content */}
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-8">
                      <div className="pb-4">
                        {overallChatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
                      <div className="max-w-4xl w-full space-y-6">
                        {/* Header Section */}
                        <div className="text-center space-y-3">
                          <div className="flex items-center justify-center gap-2">
                            <Github className="h-8 w-8 text-primary" />
                            <h2 className="text-2xl font-bold">Analyze Your GitHub Profile</h2>
                          </div>
                          <p className="text-muted-foreground">
                            Select an analysis mode to get personalized career insights for{" "}
                            <span className="font-mono font-semibold text-primary">@{profile.github_username}</span>
                          </p>
                        </div>

                        {/* Analysis Mode Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                          {/* Quick Summary Card */}
                          <Card 
                            className={`cursor-pointer transition-all border-2 hover:border-primary hover:shadow-lg ${
                              selectedAnalysisType === "quick" ? "border-primary shadow-md bg-primary/5" : ""
                            }`}
                            onClick={() => setSelectedAnalysisType("quick")}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <Sparkles className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-base">Quick Summary</CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    30 seconds • Essential overview
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-4">
                              <p className="text-sm text-muted-foreground">
                                Get a snapshot of your technical identity, standout projects, key skills, and job readiness assessment.
                              </p>
                            </CardContent>
                          </Card>

                          {/* Interview Prep Card */}
                          <Card 
                            className={`cursor-pointer transition-all border-2 hover:border-primary hover:shadow-lg ${
                              selectedAnalysisType === "interview_prep" ? "border-primary shadow-md bg-primary/5" : ""
                            }`}
                            onClick={() => setSelectedAnalysisType("interview_prep")}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <MessageSquare className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-base">Interview Preparation</CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    5 minutes • Practice & prepare
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-4">
                              <p className="text-sm text-muted-foreground">
                                Craft your elevator pitch, prepare project talking points, and practice likely interview questions.
                              </p>
                            </CardContent>
                          </Card>

                          {/* Resume Content Card */}
                          <Card 
                            className={`cursor-pointer transition-all border-2 hover:border-primary hover:shadow-lg ${
                              selectedAnalysisType === "resume" ? "border-primary shadow-md bg-primary/5" : ""
                            }`}
                            onClick={() => setSelectedAnalysisType("resume")}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <Bot className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-base">Resume Builder</CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    3 minutes • Professional content
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-4">
                              <p className="text-sm text-muted-foreground">
                                Generate professional summaries, achievement bullet points, and ATS-optimized keywords from your projects.
                              </p>
                            </CardContent>
                          </Card>

                          {/* Job Fit Card */}
                          <Card 
                            className={`cursor-pointer transition-all border-2 hover:border-primary hover:shadow-lg ${
                              selectedAnalysisType === "job_fit" ? "border-primary shadow-md bg-primary/5" : ""
                            }`}
                            onClick={() => setSelectedAnalysisType("job_fit")}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <Briefcase className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-base">Job Fit Analysis</CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    4 minutes • Career guidance
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-4">
                              <p className="text-sm text-muted-foreground">
                                Discover ideal job titles, target industries, salary expectations, and competitive positioning.
                              </p>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Call to Action */}
                        <div className="text-center pt-4">
                          <Button 
                            size="lg" 
                            onClick={handleAnalysisRequest}
                            disabled={loading}
                            className="border-2 px-8"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Analyzing GitHub Profile...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Start {analysisTypeLabels[selectedAnalysisType]} Analysis
                              </>
                            )}
                          </Button>
                        </div>
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
                      </div>
                    </ScrollArea>
                  </div>

                {/* Analysis Controls */}
                <div className="p-4 border-t-2 flex-shrink-0 bg-background">
                  {overallChatHistory.length > 0 && (
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
                  
                  {overallChatHistory.length === 0 ? (
                    // Initial analysis mode
                    <>
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
                    </>
                  ) : (
                    // Chat mode after initial analysis
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ask a follow-up question about your analysis..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleChatMessage()
                            }
                          }}
                          disabled={loading}
                          className="border-2 flex-1"
                        />
                        <Button
                          onClick={handleChatMessage}
                          disabled={loading || !chatInput.trim()}
                          className="border-2"
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MessageSquare className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Ask for clarification, deeper insights, or specific recommendations
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAnalysisRequest}
                          disabled={loading}
                          className="text-xs"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          New Analysis
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                </TabsContent>

                {/* Repository Analysis Tab */}
                <TabsContent value="repository" className="flex-1 flex flex-col m-0 data-[state=active]:flex overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-8">
                      <div className="pb-4">
                        {repositoryChatHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
                        <div className="max-w-3xl w-full space-y-6">
                          {/* Header Section */}
                          <div className="text-center space-y-3">
                            <div className="flex items-center justify-center gap-2">
                              <Code2 className="h-8 w-8 text-primary" />
                              <h2 className="text-2xl font-bold">Analyze a Repository</h2>
                            </div>
                            <p className="text-muted-foreground">
                              Get detailed insights about a specific project from your portfolio
                            </p>
                          </div>

                          {/* Repository Input Section */}
                          <Card className="border-2">
                            <CardHeader>
                              <CardTitle className="text-base">Select Repository</CardTitle>
                              <CardDescription>
                                Enter or select a repository name to analyze
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  {loadingRepos ? (
                                    <div className="flex items-center justify-center p-3 border-2 rounded-md bg-muted">
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      <span className="text-sm text-muted-foreground">Loading repositories...</span>
                                    </div>
                                  ) : availableRepos.length > 0 ? (
                                    <Select value={repoName} onValueChange={setRepoName}>
                                      <SelectTrigger className="border-2">
                                        <SelectValue placeholder="Select a repository" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableRepos.map((repo) => (
                                          <SelectItem key={repo} value={repo}>
                                            <div className="flex items-center gap-2">
                                              <Code2 className="h-4 w-4" />
                                              {repo}
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      placeholder="e.g., instagram-scraper"
                                      value={repoName}
                                      onChange={(e) => setRepoName(e.target.value)}
                                      className="border-2"
                                    />
                                  )}
                                </div>
                                {availableRepos.length === 0 && !loadingRepos && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={fetchAvailableRepos}
                                    title="Load repositories"
                                  >
                                    <Search className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              {/* Analysis Focus Selection */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Analysis Focus</label>
                                <div className="grid grid-cols-2 gap-2">
                                  <Button
                                    variant={selectedAnalysisFocus === "interview" ? "default" : "outline"}
                                    onClick={() => setSelectedAnalysisFocus("interview")}
                                    className="justify-start"
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Interview Prep
                                  </Button>
                                  <Button
                                    variant={selectedAnalysisFocus === "all" ? "default" : "outline"}
                                    onClick={() => setSelectedAnalysisFocus("all")}
                                    className="justify-start"
                                  >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Complete Analysis
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {selectedAnalysisFocus === "interview"
                                    ? "Focus on interview preparation and talking points"
                                    : "Comprehensive analysis including improvements and portfolio value"}
                                </p>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Call to Action */}
                          <div className="text-center">
                            <Button
                              size="lg"
                              onClick={handleAnalysisRequest}
                              disabled={loading || !repoName.trim()}
                              className="border-2 px-8"
                            >
                              {loading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Analyzing Repository...
                                </>
                              ) : (
                                <>
                                  <Code2 className="h-4 w-4 mr-2" />
                                  Analyze Repository
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {repositoryChatHistory.map((message, index) => (
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
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Repository Analysis Controls */}
                  <div className="p-4 border-t-2 flex-shrink-0 bg-background">
                    {repositoryChatHistory.length > 0 && (
                      <div className="mb-2 flex justify-between items-center">
                        <div className="flex gap-2">
                          {loadingRepos ? (
                            <div className="flex items-center justify-center p-2 border-2 rounded-md bg-muted w-64">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span className="text-sm">Loading...</span>
                            </div>
                          ) : availableRepos.length > 0 ? (
                            <Select value={repoName} onValueChange={setRepoName}>
                              <SelectTrigger className="w-64 border-2">
                                <SelectValue placeholder="Select repository" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableRepos.map((repo) => (
                                  <SelectItem key={repo} value={repo}>
                                    <div className="flex items-center gap-2">
                                      <Code2 className="h-4 w-4" />
                                      {repo}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex gap-2">
                              <Input
                                placeholder="Repository name"
                                value={repoName}
                                onChange={(e) => setRepoName(e.target.value)}
                                className="border-2 w-64"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={fetchAvailableRepos}
                                title="Load repositories"
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          <Select
                            value={selectedAnalysisFocus}
                            onValueChange={(value) => setSelectedAnalysisFocus(value as AnalysisFocus)}
                          >
                            <SelectTrigger className="w-48 border-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="interview">Interview Prep</SelectItem>
                              <SelectItem value="all">Complete Analysis</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleAnalysisRequest}
                            disabled={loading || !repoName.trim()}
                            variant="default"
                          >
                            Analyze
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearHistory}
                        >
                          Clear History
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Job Fit Analysis Tab */}
                <TabsContent value="job-fit" className="flex-1 flex flex-col m-0 data-[state=active]:flex overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-8">
                      <div className="pb-4">
                        {jobFitChatHistory.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
                            <div className="max-w-3xl w-full space-y-6">
                              {/* Header Section */}
                              <div className="text-center space-y-3">
                                <div className="flex items-center justify-center gap-2">
                                  <Briefcase className="h-8 w-8 text-primary" />
                                  <h2 className="text-2xl font-bold">Analyze Job Fit</h2>
                                </div>
                                <p className="text-muted-foreground">
                                  See how well your GitHub profile matches a specific role
                                </p>
                              </div>

                              {/* Target Role Input Section */}
                              <Card className="border-2">
                                <CardHeader>
                                  <CardTitle className="text-base">Target Role</CardTitle>
                                  <CardDescription>
                                    Enter the job role you're interested in
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  <div className="space-y-2">
                                    <Input
                                      placeholder="e.g., Full Stack Developer"
                                      value={targetRole}
                                      onChange={(e) => setTargetRole(e.target.value)}
                                      className="border-2"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Common roles: Frontend Developer, Backend Developer, Full Stack Developer, 
                                      Data Scientist, Machine Learning Engineer, Mobile Developer, DevOps Engineer
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Call to Action */}
                              <div className="text-center">
                                <Button
                                  size="lg"
                                  onClick={handleAnalysisRequest}
                                  disabled={loading || !targetRole.trim()}
                                  className="border-2 px-8"
                                >
                                  {loading ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Analyzing Job Fit...
                                    </>
                                  ) : (
                                    <>
                                      <Briefcase className="h-4 w-4 mr-2" />
                                      Analyze Job Fit
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {jobFitChatHistory.map((message, index) => (
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
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Job Fit Analysis Controls */}
                  <div className="p-4 border-t-2 flex-shrink-0 bg-background">
                    {jobFitChatHistory.length > 0 && (
                      <div className="mb-2 flex justify-between items-center">
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., Full Stack Developer"
                            value={targetRole}
                            onChange={(e) => setTargetRole(e.target.value)}
                            className="border-2 w-80"
                          />
                          <Button
                            onClick={handleAnalysisRequest}
                            disabled={loading || !targetRole.trim()}
                            variant="default"
                          >
                            Analyze
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearHistory}
                        >
                          Clear History
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
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
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="font-semibold">Overall Analysis</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Analyze your entire GitHub profile and career readiness
              </p>
              <div className="space-y-1.5 ml-6">
                <p className="text-xs"><span className="font-medium">⚡ Quick Summary:</span> 30-sec profile overview</p>
                <p className="text-xs"><span className="font-medium">🎤 Interview Prep:</span> Talking points & questions</p>
                <p className="text-xs"><span className="font-medium">📝 Resume Builder:</span> ATS-optimized content</p>
                <p className="text-xs"><span className="font-medium">🎯 Job Fit:</span> Best matching roles</p>
              </div>
            </div>
            
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-1">
                <Code2 className="h-4 w-4 text-primary" />
                <p className="font-semibold">Repository Analysis</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Deep dive into a specific project from your portfolio
              </p>
              <div className="space-y-1.5 ml-6">
                <p className="text-xs"><span className="font-medium">🎤 Interview Prep:</span> Project talking points</p>
                <p className="text-xs"><span className="font-medium">📋 Complete Analysis:</span> Full technical review</p>
              </div>
            </div>
            
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="h-4 w-4 text-primary" />
                <p className="font-semibold">Job Fit Analysis</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                See how your profile matches specific job roles
              </p>
              <div className="space-y-1.5 ml-6">
                <p className="text-xs">• Skills gap analysis</p>
                <p className="text-xs">• Relevant projects showcase</p>
                <p className="text-xs">• Learning roadmap</p>
                <p className="text-xs">• Application strategy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          {/* <CardHeader>
            <CardTitle className="text-sm">💡Quick Tips</CardTitle>
          </CardHeader> */}
          <CardContent className="text-sm">
            <div>
              <p className="font-semibold">💡 Quick Tips</p>
              <p className="font-medium"> Start with Overall Analysis</p>
              <p className="text-xs text-muted-foreground">
                Use Quick Summary to understand your technical profile first
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
