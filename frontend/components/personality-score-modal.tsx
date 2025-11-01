"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PersonalityResults } from "@/components/personality-results"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

interface PersonalityTrait {
  trait: string
  score: number
  raw_score: number
  description: string
  level: string
}

interface PersonalityAnalysis {
  id: string
  video_url: string | null
  extraversion: number
  agreeableness: number
  conscientiousness: number
  neuroticism: number
  openness: number
  interview_score: number
  created_at: string
}

interface PersonalityScoreModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  personalityAnalysisId: string | null
  candidateName?: string
}

export function PersonalityScoreModal({
  open,
  onOpenChange,
  personalityAnalysisId,
  candidateName = "Candidate",
}: PersonalityScoreModalProps) {
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState<PersonalityAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && personalityAnalysisId) {
      fetchAnalysis()
    }
  }, [open, personalityAnalysisId])

  const fetchAnalysis = async () => {
    if (!personalityAnalysisId) return

    setLoading(true)
    setError(null)

    try {
      // Fetch from Supabase via frontend API
      const response = await fetch(`/api/supabase/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "personality_analyses",
          filter: { id: personalityAnalysisId },
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch personality analysis")
      }

      const data = await response.json()
      if (data.data && data.data.length > 0) {
        setAnalysis(data.data[0])
      } else {
        setError("No personality analysis found")
      }
    } catch (err: any) {
      console.error("Error fetching personality analysis:", err)
      setError(err.message || "Failed to load personality analysis")
    } finally {
      setLoading(false)
    }
  }

  const formatResults = (analysis: PersonalityAnalysis): PersonalityTrait[] => {
    return [
      {
        trait: "Extraversion",
        score: analysis.extraversion * 100,
        raw_score: analysis.extraversion,
        description: getDescription("Extraversion", analysis.extraversion),
        level: getLevel(analysis.extraversion),
      },
      {
        trait: "Agreeableness",
        score: analysis.agreeableness * 100,
        raw_score: analysis.agreeableness,
        description: getDescription("Agreeableness", analysis.agreeableness),
        level: getLevel(analysis.agreeableness),
      },
      {
        trait: "Conscientiousness",
        score: analysis.conscientiousness * 100,
        raw_score: analysis.conscientiousness,
        description: getDescription("Conscientiousness", analysis.conscientiousness),
        level: getLevel(analysis.conscientiousness),
      },
      {
        trait: "Emotional Stability",
        score: (1 - analysis.neuroticism) * 100,
        raw_score: 1 - analysis.neuroticism,
        description: getDescription("Neuroticism", 1 - analysis.neuroticism),
        level: getLevel(1 - analysis.neuroticism),
      },
      {
        trait: "Openness",
        score: analysis.openness * 100,
        raw_score: analysis.openness,
        description: getDescription("Openness", analysis.openness),
        level: getLevel(analysis.openness),
      }
      // ,
      // {
      //   trait: "Interview Score",
      //   score: analysis.interview_score * 100,
      //   raw_score: analysis.interview_score,
      //   description: getDescription("Interview Score", analysis.interview_score),
      //   level: getLevel(analysis.interview_score),
      // },
    ]
  }

  const getLevel = (score: number): string => {
    if (score < 0.4) return "low"
    if (score < 0.6) return "medium"
    return "high"
  }

  const getDescription = (trait: string, score: number): string => {
    const level = getLevel(score)
    const descriptions: Record<string, Record<string, string>> = {
      Extraversion: {
        low: "Reserved and thoughtful, prefers working independently",
        medium: "Balanced between social interaction and independent work",
        high: "Outgoing and energetic, thrives in collaborative environments",
      },
      Agreeableness: {
        low: "Direct and analytical, values honesty over harmony",
        medium: "Cooperative when needed, maintains professional boundaries",
        high: "Highly collaborative and empathetic, excellent team player",
      },
      Conscientiousness: {
        low: "Flexible and adaptable, comfortable with ambiguity",
        medium: "Organized when necessary, balances structure and flexibility",
        high: "Highly organized and detail-oriented, strong work ethic",
      },
      Neuroticism: {
        low: "Calm under pressure, emotionally stable and resilient",
        medium: "Generally stable with normal stress responses",
        high: "Sensitive and perceptive, deeply invested in work quality",
      },
      Openness: {
        low: "Practical and results-focused, values proven methods",
        medium: "Open to new ideas within structured frameworks",
        high: "Creative and innovative, embraces new technologies and approaches",
      }
      // ,
      // "Interview Score": {
      //   low: "May benefit from interview coaching and practice",
      //   medium: "Solid interview performance with clear communication",
      //   high: "Excellent presentation skills and professional demeanor",
      // },
    }

    return descriptions[trait]?.[level] || ""
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Video Interview - {candidateName}</DialogTitle>
          <DialogDescription>Personality analysis and video recording</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && analysis && (
          <div className="space-y-6">
            {/* Video Player */}
            {analysis.video_url && (
              <Card>
                <CardContent className="p-6">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <video src={analysis.video_url} controls className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Recorded on {new Date(analysis.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Personality Results */}
            <PersonalityResults results={formatResults(analysis)} overallScore={analysis.interview_score * 100} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
