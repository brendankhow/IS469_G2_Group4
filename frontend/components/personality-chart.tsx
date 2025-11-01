
"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface PersonalityTrait {
  trait: string
  score: number
  raw_score: number
  description: string
  level: string
}

interface PersonalityChartProps {
  results: PersonalityTrait[]
  showDescriptions?: boolean
}

export function PersonalityChart({ results, showDescriptions = true }: PersonalityChartProps) {
  // Filter out Interview Score - only show Big Five personality traits
  const filteredResults = results.filter((trait) => trait.trait !== "Interview Score")
  
  // Prepare data for chart
  const chartData = filteredResults.map((trait) => ({
    name: trait.trait,
    score: trait.score,
    level: trait.level,
  }))

  // Color mapping based on level
  const getColor = (level: string) => {
    switch (level) {
      case "high":
        return "#10b981" // Green
      case "medium":
        return "#f59e0b" // Yellow/Orange
      case "low":
        return "#ef4444" // Red
      default:
        return "#3b82f6" // Blue
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personality Analysis Results</CardTitle>
        <CardDescription>Based on Big Five personality traits and interview performance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chart */}
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 30, right: 20 }}>
              <XAxis type="number" domain={[0, 100]} />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Score"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  color: "white",
                }}
                labelStyle={{ color: 'white' }}
                itemStyle={{ color: 'white' }}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.level)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trait Descriptions */}
        {showDescriptions && (
          <div className="space-y-3">
            {filteredResults.map((trait) => (
              <div key={trait.trait} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="flex-shrink-0">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white"
                    style={{
                      backgroundColor:
                        trait.level === "high"
                          ? "#10b981"
                          : trait.level === "medium"
                            ? "#f59e0b"
                            : "#ef4444",
                    }}
                  >
                    {trait.score.toFixed(0)}%
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{trait.trait}</h4>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        trait.level === "high"
                          ? "bg-green-500/10 text-green-500"
                          : trait.level === "medium"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {trait.level.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{trait.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// "use client"

// import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// interface PersonalityTrait {
//   trait: string
//   score: number
//   raw_score: number
//   description: string
//   level: string
// }

// interface PersonalityChartProps {
//   results: PersonalityTrait[]
//   showDescriptions?: boolean
// }

// export function PersonalityChart({ results, showDescriptions = true }: PersonalityChartProps) {
//   // Prepare data for chart
//   const chartData = results.map((trait) => ({
//     name: trait.trait,
//     score: trait.score,
//     level: trait.level,
//   }))

//   // Color mapping based on level
//   const getColor = (level: string) => {
//     switch (level) {
//       case "high":
//         return "#10b981" // Green
//       case "medium":
//         return "#f59e0b" // Yellow/Orange
//       case "low":
//         return "#ef4444" // Red
//       default:
//         return "#3b82f6" // Blue
//     }
//   }

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Personality Analysis Results</CardTitle>
//         <CardDescription>Based on Big Five personality traits and interview performance</CardDescription>
//       </CardHeader>
//       <CardContent className="space-y-6">
//         {/* Chart */}
//         <div className="h-[300px]">
//           <ResponsiveContainer width="100%" height="100%">
//             <BarChart data={chartData} layout="vertical" margin={{ left: 30, right: 20 }}>
//               <XAxis type="number" domain={[0, 100]} />
//               <YAxis dataKey="name" type="category" width={120} />
//               <Tooltip
//                 formatter={(value: number) => [`${value.toFixed(1)}%`, "Score"]}
//                 contentStyle={{
//                   backgroundColor: "hsl(var(--background))",
//                   border: "1px solid hsl(var(--border))",
//                   borderRadius: "6px",
//                   color: "white",
//                 }}
//                 labelStyle={{ color: 'white' }}
//                 itemStyle={{ color: 'white' }}
//               />
//               <Bar dataKey="score" radius={[0, 4, 4, 0]}>
//                 {chartData.map((entry, index) => (
//                   <Cell key={`cell-${index}`} fill={getColor(entry.level)} />
//                 ))}
//               </Bar>
//             </BarChart>
//           </ResponsiveContainer>
//         </div>

//         {/* Trait Descriptions */}
//         {showDescriptions && (
//           <div className="space-y-3">
//             {results.map((trait) => (
//               <div key={trait.trait} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
//                 <div className="flex-shrink-0">
//                   <div
//                     className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white"
//                     style={{
//                       backgroundColor:
//                         trait.level === "high"
//                           ? "#10b981"
//                           : trait.level === "medium"
//                             ? "#f59e0b"
//                             : "#ef4444",
//                     }}
//                   >
//                     {trait.score.toFixed(0)}%
//                   </div>
//                 </div>
//                 <div className="flex-1">
//                   <div className="flex items-center gap-2 mb-1">
//                     <h4 className="font-semibold">{trait.trait}</h4>
//                     <span
//                       className={`text-xs px-2 py-0.5 rounded-full ${
//                         trait.level === "high"
//                           ? "bg-green-500/10 text-green-500"
//                           : trait.level === "medium"
//                             ? "bg-yellow-500/10 text-yellow-500"
//                             : "bg-red-500/10 text-red-500"
//                       }`}
//                     >
//                       {trait.level.toUpperCase()}
//                     </span>
//                   </div>
//                   <p className="text-sm text-muted-foreground">{trait.description}</p>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </CardContent>
//     </Card>
//   )
// }
