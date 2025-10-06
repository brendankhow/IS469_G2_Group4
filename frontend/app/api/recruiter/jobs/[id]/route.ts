import { type NextRequest, NextResponse } from "next/server"
import { JobModel } from "@/lib/models/job"
import { AuthService } from "@/lib/auth"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.role !== "recruiter") {
      return NextResponse.json({ error: "Only recruiters can delete jobs" }, { status: 403 })
    }

    const { id } = params
    const job = await JobModel.findById(Number.parseInt(id))

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (job.recruiter_id !== currentUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await JobModel.delete(Number.parseInt(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete job error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
