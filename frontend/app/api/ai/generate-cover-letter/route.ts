import { type NextRequest, NextResponse } from "next/server"
import { AIService } from "@/lib/ai-service"
import { AuthService } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { jobTitle, jobDescription, requirements, studentSkills, studentHobbies } = body

    if (!jobTitle || !jobDescription) {
      return NextResponse.json({ error: "Job title and description are required" }, { status: 400 })
    }

    const coverLetter = await AIService.generateCoverLetter({
      jobTitle,
      jobDescription,
      requirements,
      studentSkills,
      studentHobbies,
    })

    return NextResponse.json({ coverLetter })
  } catch (error) {
    console.error("Generate cover letter error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
