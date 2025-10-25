import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { student_id, github_username, analysis_type } = body

    // Validate required fields
    if (!student_id || !github_username || !analysis_type) {
      return NextResponse.json(
        { error: "Missing required fields: student_id, github_username, or analysis_type" },
        { status: 400 }
      )
    }

    // Validate analysis_type
    const validTypes = ["quick", "interview_prep", "resume", "job_fit"]
    if (!validTypes.includes(analysis_type)) {
      return NextResponse.json(
        { error: "Invalid analysis_type. Must be one of: quick, interview_prep, resume, job_fit" },
        { status: 400 }
      )
    }

    // Call the Python backend
    const response = await fetch("http://localhost:8000/github/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        student_id,
        github_username,
        analysis_type,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error("Backend error:", errorData)
      return NextResponse.json(
        { error: errorData?.detail || "Failed to analyze GitHub profile" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("GitHub analysis API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
