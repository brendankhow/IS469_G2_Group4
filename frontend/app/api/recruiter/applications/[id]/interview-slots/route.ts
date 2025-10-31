import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: applicationId } = await params

    // Get application with interview slots
    const { data: application, error } = await supabase
      .from("applications")
      .select("proposed_slots, confirmed_slot, interview_status")
      .eq("id", applicationId)
      .single()

    if (error || !application) {
      console.error("Application not found:", error)
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      )
    }

    console.log("Fetched interview slots for application", applicationId, {
      proposedSlots: application.proposed_slots,
      confirmedSlot: application.confirmed_slot,
      interviewStatus: application.interview_status,
    })

    return NextResponse.json({
      proposedSlots: application.proposed_slots || [],
      confirmedSlot: application.confirmed_slot || null,
      interviewStatus: application.interview_status || 'not_scheduled',
    })
  } catch (error) {
    console.error("Error fetching interview slots:", error)
    return NextResponse.json(
      { error: "Failed to fetch interview slots" },
      { status: 500 }
    )
  }
}
