import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { student_id, repo_name, analysis_focus } = body

    // Validate required fields
    if (!student_id || !repo_name || !analysis_focus) {
      return NextResponse.json(
        { error: "Missing required fields: student_id, repo_name, or analysis_focus" },
        { status: 400 }
      )
    }

    // Validate analysis_focus
    const validFocus = ["all", "interview"]
    if (!validFocus.includes(analysis_focus)) {
      return NextResponse.json(
        { error: "Invalid analysis_focus. Must be one of: all, interview" },
        { status: 400 }
      )
    }

    // Call the Python backend
    const response = await fetch("http://localhost:8000/github/analyze/project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        student_id,
        repo_name,
        analysis_focus,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error("Backend error:", errorData)
      return NextResponse.json(
        { error: errorData?.detail || "Failed to analyze repository" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("GitHub repo analysis API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
