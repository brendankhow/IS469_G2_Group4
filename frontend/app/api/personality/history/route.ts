import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const student_id = searchParams.get("student_id")

    if (!student_id) {
      return NextResponse.json({ error: "student_id is required" }, { status: 400 })
    }

    console.log(`[Personality History API] Fetching history for student: ${student_id}`)

    // Call Python backend
    const response = await fetch(`http://127.0.0.1:8000/personality/student/${student_id}/history`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error("[Personality History API] Backend error:", errorData)
      return NextResponse.json(
        { error: errorData?.detail || "Failed to fetch personality history" },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log(`[Personality History API] Found ${data.count} analyses`)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Personality History API] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
