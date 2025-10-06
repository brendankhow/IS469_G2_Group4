import { type NextRequest, NextResponse } from "next/server"
import { ApplicationModel } from "@/lib/models/application"
import { JobModel } from "@/lib/models/job"
import { AuthService } from "@/lib/auth"
import { UserModel } from "@/lib/models/user"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.role !== "recruiter") {
      return NextResponse.json({ error: "Only recruiters can update application status" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { status } = body

    if (!status || !["pending", "accepted", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const application = await ApplicationModel.findById(Number.parseInt(id))

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    // Verify the recruiter owns this job
    const job = await JobModel.findById(application.job_id)
    if (!job || job.recruiter_id !== currentUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await ApplicationModel.updateStatus(Number.parseInt(id), status)

    const student = await UserModel.findById(application.student_id)
    if (student?.email) {
      if (status === "rejected") {
        console.log(`Would send rejection email to ${student.email} for ${job.title}`)
      } else if (status === "accepted") {
        console.log(`Would send acceptance email to ${student.email} for ${job.title}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update application status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
