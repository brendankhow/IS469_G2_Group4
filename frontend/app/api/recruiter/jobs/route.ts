import { type NextRequest, NextResponse } from "next/server"
import { JobModel } from "@/lib/models/job"
import { AuthService } from "@/lib/auth"

export async function GET() {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.role !== "recruiter") {
      return NextResponse.json({ error: "Only recruiters can view their jobs" }, { status: 403 })
    }

    const jobs = await JobModel.findByRecruiterId(currentUser.userId)
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error("Get recruiter jobs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.role !== "recruiter") {
      return NextResponse.json({ error: "Only recruiters can post jobs" }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, requirements, location, salary_range } = body

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 })
    }

    const job = await JobModel.create(title, description, currentUser.userId, {
      requirements,
      location,
      salary_range,
    })

    return NextResponse.json({ job }, { status: 201 })
  } catch (error) {
    console.error("Create job error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
