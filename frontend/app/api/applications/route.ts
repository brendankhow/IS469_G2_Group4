import { type NextRequest, NextResponse } from "next/server"
import { ApplicationModel } from "@/lib/models/application"
import { AuthService } from "@/lib/auth"

export async function GET() {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.role !== "student") {
      return NextResponse.json({ error: "Only students can view their applications" }, { status: 403 })
    }

    const applications = ApplicationModel.findByStudentId(currentUser.userId)
    return NextResponse.json({ applications })
  } catch (error) {
    console.error("Get applications error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.role !== "student") {
      return NextResponse.json({ error: "Only students can apply" }, { status: 403 })
    }

    const formData = await request.formData()
    const jobId = formData.get("jobId") as string
    const coverLetter = formData.get("coverLetter") as string
    const resumeFile = formData.get("resume") as File | null

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
    }

    // Check if already applied
    if (ApplicationModel.exists(currentUser.userId, Number.parseInt(jobId))) {
      return NextResponse.json({ error: "Already applied to this job" }, { status: 409 })
    }

    let resumeBase64: string | undefined
    let resumeFilename: string | undefined

    if (resumeFile) {
      const bytes = await resumeFile.arrayBuffer()
      resumeBase64 = Buffer.from(bytes).toString("base64")
      resumeFilename = resumeFile.name
    }

    const application = ApplicationModel.create(
      currentUser.userId,
      Number.parseInt(jobId),
      resumeBase64,
      resumeFilename,
      coverLetter,
    )

    return NextResponse.json({ application }, { status: 201 })
  } catch (error) {
    console.error("Create application error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
