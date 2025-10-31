import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * GET /api/coffeechat/[studentId]/slots
 * Fetch coffee chat scheduling status for a recruiter-student pair
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const supabase = createAdminClient()
    const { studentId } = await params
    
    // Get recruiter ID from query params (in production, get from session)
    const { searchParams } = new URL(request.url)
    const recruiterId = searchParams.get('recruiterId')
    
    if (!recruiterId) {
      return NextResponse.json(
        { error: "Recruiter ID required" },
        { status: 400 }
      )
    }

    // Fetch active coffee chat
    const { data: coffeeChat, error } = await supabase
      .from("coffeechat")
      .select("*")
      .eq("recruiter_id", recruiterId)
      .eq("student_id", studentId)
      .in("coffeechat_status", ["slots_proposed", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
      console.error("Error fetching coffee chat:", error)
      return NextResponse.json(
        { error: "Failed to fetch coffee chat status" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      proposedSlots: coffeeChat?.proposed_slots || [],
      confirmedSlot: coffeeChat?.confirmed_slot || null,
      coffeeChatStatus: coffeeChat?.coffeechat_status || "not_scheduled",
      coffeeChatId: coffeeChat?.id || null,
    })
  } catch (error) {
    console.error("Error in GET /api/coffeechat/[studentId]/slots:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
