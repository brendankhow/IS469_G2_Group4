import { type NextRequest, NextResponse } from "next/server"
import { ApplicationModel } from "@/lib/models/application"
import { JobModel } from "@/lib/models/job"
import { AuthService } from "@/lib/auth"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.role !== "recruiter") {
      return NextResponse.json({ error: "Only recruiters can reject applications" }, { status: 403 })
    }

    const { id } = params
    const job = await JobModel.findById(Number.parseInt(id))

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (job.recruiter_id !== currentUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all pending applications before rejecting
    const pendingApplications = (await ApplicationModel.findByJobId(Number.parseInt(id))).filter(
      (app) => app.status === "pending",
    )

    // Reject all pending applications
    const rejectedCount = await ApplicationModel.rejectRemainingByJobId(Number.parseInt(id))

    const emailPromises = pendingApplications.map((app) => {
      if (app.student_email) {
        console.log(`Would send rejection email to ${app.student_email} for ${job.title}`)
      }
      return Promise.resolve()
    })

    // Send all emails in parallel
    await Promise.all(emailPromises)

    return NextResponse.json({ success: true, rejectedCount })
  } catch (error) {
    console.error("Reject remaining error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
