import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { student_id, target_role } = body

    // Validate required fields
    if (!student_id || !target_role) {
      return NextResponse.json(
        { error: "Missing required fields: student_id or target_role" },
        { status: 400 }
      )
    }

    // Call the Python backend
    const response = await fetch("http://localhost:8000/github/analyze/job-fit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        student_id,
        target_role,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error("Backend error:", errorData)
      return NextResponse.json(
        { error: errorData?.detail || "Failed to analyze job fit" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("GitHub job fit analysis API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
