import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const video = formData.get("video") as File
    const student_id = formData.get("student_id") as string
    const upload_to_storage = formData.get("upload_to_storage") as string

    // Validate required fields
    if (!video) {
      return NextResponse.json({ error: "Video file is required" }, { status: 400 })
    }

    // Validate file size (100MB)
    if (video.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: `File size (${(video.size / 1024 / 1024).toFixed(1)}MB) exceeds 100MB limit` },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/avi"]
    if (!validTypes.includes(video.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${video.type}. Allowed: MP4, WebM, MOV, MKV, AVI` },
        { status: 400 }
      )
    }

    // Prepare form data for Python backend
    const backendFormData = new FormData()
    backendFormData.append("video", video)
    if (student_id) {
      backendFormData.append("student_id", student_id)
    }
    backendFormData.append("upload_to_storage", upload_to_storage || "false")

    console.log(`[Personality API] Analyzing video: ${video.name} (${(video.size / 1024 / 1024).toFixed(1)}MB)`)

    // Call Python backend
    const response = await fetch("http://127.0.0.1:8000/personality/analyze", {
      method: "POST",
      body: backendFormData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error("[Personality API] Backend error:", errorData)
      return NextResponse.json(
        { error: errorData?.detail || "Failed to analyze video" },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log("[Personality API] Analysis successful")
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Personality API] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
