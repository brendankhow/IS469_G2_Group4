import { type NextRequest, NextResponse } from "next/server"
import { ApplicationModel } from "@/lib/models/application"
import { JobModel } from "@/lib/models/job"
import { AuthService } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.role !== "recruiter") {
      return NextResponse.json({ error: "Only recruiters can view applicants" }, { status: 403 })
    }

    const { id } = params
    const job = await JobModel.findById(Number.parseInt(id))

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (job.recruiter_id !== currentUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const applicants = await ApplicationModel.findByJobId(Number.parseInt(id))
    return NextResponse.json({ applicants })
  } catch (error) {
    console.error("Get applicants error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
