import { type NextRequest, NextResponse } from "next/server"
import { ApplicationModel } from "@/lib/models/application"
import { AuthService } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const application = ApplicationModel.findById(Number.parseInt(id))

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    // Check authorization
    if (currentUser.role === "student" && application.student_id !== currentUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!application.resume_base64) {
      return NextResponse.json({ error: "No resume found" }, { status: 404 })
    }

    const resumeBuffer = Buffer.from(application.resume_base64, "base64")

    return new NextResponse(resumeBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${application.resume_filename || "resume.pdf"}"`,
      },
    })
  } catch (error) {
    console.error("Get resume error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
