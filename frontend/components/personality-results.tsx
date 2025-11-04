"use client"


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, TrendingUp, Users, Brain, Lightbulb, Target } from "lucide-react"

interface PersonalityTrait {
  trait: string
  score: number
  raw_score: number
  description: string
  level: string
}

interface PersonalityResultsProps {
  results: PersonalityTrait[]
  overallScore?: number
  compact?: boolean
}

export function PersonalityResults({ results, overallScore, compact = false }: PersonalityResultsProps) {
  // Find interview score for top display
  const interviewScoreTrait = results.find((t) => t.trait === "Interview Score")
  const displayScore = overallScore ?? interviewScoreTrait?.score ?? 0
  
  // Filter out Interview Score from the list below (only show Big Five traits)
  const displayResults = results.filter((t) => t.trait !== "Interview Score")

  // Get icon for trait
  const getTraitIcon = (trait: string) => {
    switch (trait.toLowerCase()) {
      case "extraversion":
        return <Users className="h-4 w-4" />
      case "agreeableness":
        return <CheckCircle className="h-4 w-4" />
      case "conscientiousness":
        return <Target className="h-4 w-4" />
      case "neuroticism":
      case "emotional stability":
        return <TrendingUp className="h-4 w-4" />
      case "openness":
        return <Lightbulb className="h-4 w-4" />
      default:
        return <Brain className="h-4 w-4" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500"
    if (score >= 50) return "text-yellow-500"
    return "text-red-500"
  }

  const getScoreBadgeClass = (score: number) => {
    if (score >= 70) return "bg-green-500/10 text-green-500 border-green-500/20"
    if (score >= 50) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    return "bg-red-500/10 text-red-500 border-red-500/20"
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall Interview Score</span>
          <Badge className={getScoreBadgeClass(displayScore)}>{displayScore.toFixed(0)}/100</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {displayResults.map((trait) => (
            <div key={trait.trait} className="flex items-center justify-between p-2 rounded bg-secondary/50">
              <span className="text-muted-foreground">{trait.trait}</span>
              <span className={getScoreColor(trait.score)}>{trait.score.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Personality Profile</CardTitle>
            <CardDescription>Based on video analysis</CardDescription>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${getScoreColor(displayScore)}`}>{displayScore.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Interview Score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayResults.map((trait) => (
            <div key={trait.trait} className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex-shrink-0 p-2 rounded-full bg-primary/10">{getTraitIcon(trait.trait)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm">{trait.trait}</h4>
                  <Badge
                    variant="outline"
                    className={
                      trait.level === "high"
                        ? "bg-green-500/10 text-green-500 border-green-500/20"
                        : trait.level === "medium"
                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                    }
                  >
                    {trait.score.toFixed(0)}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{trait.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}







// "use client"

// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { Badge } from "@/components/ui/badge"
// import { CheckCircle, TrendingUp, Users, Brain, Lightbulb, Target } from "lucide-react"

// interface PersonalityTrait {
//   trait: string
//   score: number
//   raw_score: number
//   description: string
//   level: string
// }

// interface PersonalityResultsProps {
//   results: PersonalityTrait[]
//   overallScore?: number
//   compact?: boolean
// }

// export function PersonalityResults({ results, overallScore, compact = false }: PersonalityResultsProps) {
//   // Find interview score
//   const interviewScoreTrait = results.find((t) => t.trait === "Interview Score")
//   const displayScore = overallScore ?? interviewScoreTrait?.score ?? 0

//   // Get icon for trait
//   const getTraitIcon = (trait: string) => {
//     switch (trait.toLowerCase()) {
//       case "extraversion":
//         return <Users className="h-4 w-4" />
//       case "agreeableness":
//         return <CheckCircle className="h-4 w-4" />
//       case "conscientiousness":
//         return <Target className="h-4 w-4" />
//       case "neuroticism":
//         return <TrendingUp className="h-4 w-4" />
//       case "openness":
//         return <Lightbulb className="h-4 w-4" />
//       // case "interview score":
//       //   return <Brain className="h-4 w-4" />
//       default:
//         return <CheckCircle className="h-4 w-4" />
//     }
//   }

//   const getScoreColor = (score: number) => {
//     if (score >= 70) return "text-green-500"
//     if (score >= 50) return "text-yellow-500"
//     return "text-red-500"
//   }

//   const getScoreBadgeClass = (score: number) => {
//     if (score >= 70) return "bg-green-500/10 text-green-500 border-green-500/20"
//     if (score >= 50) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
//     return "bg-red-500/10 text-red-500 border-red-500/20"
//   }

//   if (compact) {
//     return (
//       <div className="space-y-2">
//         <div className="flex items-center justify-between">
//           <span className="text-sm font-medium">Overall Interview Score</span>
//           <Badge className={getScoreBadgeClass(displayScore)}>{displayScore.toFixed(0)}/100</Badge>
//         </div>
//         <div className="grid grid-cols-2 gap-2 text-xs">
//           {results
//             .filter((t) => t.trait !== "Interview Score")
//             .map((trait) => (
//               <div key={trait.trait} className="flex items-center justify-between p-2 rounded bg-secondary/50">
//                 <span className="text-muted-foreground">{trait.trait}</span>
//                 <span className={getScoreColor(trait.score)}>{trait.score.toFixed(0)}%</span>
//               </div>
//             ))}
//         </div>
//       </div>
//     )
//   }

//   return (
//     <Card>
//       <CardHeader>
//         <div className="flex items-center justify-between">
//           <div>
//             <CardTitle>Personality Profile</CardTitle>
//             <CardDescription>Based on video analysis</CardDescription>
//           </div>
//           <div className="text-center">
//             <div className={`text-3xl font-bold ${getScoreColor(displayScore)}`}>{displayScore.toFixed(0)}</div>
//             <div className="text-xs text-muted-foreground">Interview Score</div>
//           </div>
//         </div>
//       </CardHeader>
//       <CardContent>
//         <div className="space-y-3">
//           {results.map((trait) => (
//             <div key={trait.trait} className="flex items-center gap-3 p-3 rounded-lg border">
//               <div className="flex-shrink-0 p-2 rounded-full bg-primary/10">{getTraitIcon(trait.trait)}</div>
//               <div className="flex-1 min-w-0">
//                 <div className="flex items-center gap-2 mb-1">
//                   <h4 className="font-medium text-sm">{trait.trait}</h4>
//                   <Badge
//                     variant="outline"
//                     className={
//                       trait.level === "high"
//                         ? "bg-green-500/10 text-green-500 border-green-500/20"
//                         : trait.level === "medium"
//                           ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
//                           : "bg-red-500/10 text-red-500 border-red-500/20"
//                     }
//                   >
//                     {trait.score.toFixed(0)}%
//                   </Badge>
//                 </div>
//                 <p className="text-xs text-muted-foreground">{trait.description}</p>
//               </div>
//             </div>
//           ))}
//         </div>
//       </CardContent>
//     </Card>
//   )
// }

