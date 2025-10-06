import { NextResponse } from "next/server"
import { JobModel } from "@/lib/models/job"

export async function GET() {
  try {
    const jobs = await JobModel.findAll()
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error("Get jobs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
