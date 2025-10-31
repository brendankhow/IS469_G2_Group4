import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { EmailService } from "@/lib/email-service"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createClient()
    const { token } = await params

    // Find coffee chat by confirmation token
    const { data: coffeeChat, error } = await supabase
      .from("coffeechat")
      .select(`
        *,
        student:profiles!coffeechat_student_id_fkey (
          id,
          name,
          email
        ),
        recruiter:profiles!coffeechat_recruiter_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq("confirmation_token", token)
      .single()

    if (error || !coffeeChat) {
      return NextResponse.json(
        { error: "Invalid or expired confirmation link", isValid: false },
        { status: 404 }
      )
    }

    // Check if token is expired
    const tokenExpiresAt = coffeeChat.token_expires_at ? new Date(coffeeChat.token_expires_at) : null
    const isExpired = tokenExpiresAt ? new Date() > tokenExpiresAt : false

    if (isExpired) {
      return NextResponse.json(
        { error: "This confirmation link has expired", isValid: false, isExpired: true },
        { status: 400 }
      )
    }

    return NextResponse.json({
      isValid: true,
      isExpired: false,
      studentName: coffeeChat.student?.name || "Student",
      recruiterName: coffeeChat.recruiter?.name || "Recruiter",
      recruiterEmail: coffeeChat.recruiter?.email || "",
      slots: coffeeChat.proposed_slots || [],
      confirmedSlot: coffeeChat.confirmed_slot || null,
      coffeeChatStatus: coffeeChat.coffeechat_status,
    })
  } catch (error) {
    console.error("Error fetching coffee chat confirmation data:", error)
    return NextResponse.json(
      { error: "Failed to load confirmation data", isValid: false },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createClient()
    const { token } = await params
    const body = await request.json()
    const { selectedSlot } = body

    if (!selectedSlot || !selectedSlot.date || !selectedSlot.time) {
      return NextResponse.json(
        { error: "Invalid slot selection" },
        { status: 400 }
      )
    }

    // Find coffee chat by confirmation token
    const { data: coffeeChat, error: coffeeChatError } = await supabase
      .from("coffeechat")
      .select(`
        *,
        student:profiles!coffeechat_student_id_fkey (
          id,
          name,
          email
        ),
        recruiter:profiles!coffeechat_recruiter_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq("confirmation_token", token)
      .single()

    if (coffeeChatError || !coffeeChat) {
      return NextResponse.json(
        { error: "Invalid or expired confirmation link" },
        { status: 404 }
      )
    }

    // Check if token is expired
    const tokenExpiresAt = coffeeChat.token_expires_at ? new Date(coffeeChat.token_expires_at) : null
    const isExpired = tokenExpiresAt ? new Date() > tokenExpiresAt : false

    if (isExpired) {
      return NextResponse.json(
        { error: "This confirmation link has expired" },
        { status: 400 }
      )
    }

    // Check if already confirmed
    if (coffeeChat.confirmed_slot) {
      return NextResponse.json(
        { error: "Coffee chat has already been confirmed" },
        { status: 400 }
      )
    }

    // Verify selected slot is in proposed slots
    const proposedSlots = coffeeChat.proposed_slots || []
    const isValidSlot = proposedSlots.some(
      (slot: any) => slot.date === selectedSlot.date && slot.time === selectedSlot.time
    )

    if (!isValidSlot) {
      return NextResponse.json(
        { error: "Selected slot is not available" },
        { status: 400 }
      )
    }

    // Update coffee chat with confirmed slot using admin client
    const confirmedSlot = {
      date: selectedSlot.date,
      time: selectedSlot.time,
      confirmed_at: new Date().toISOString(),
    }

    console.log("🔄 Updating coffee chat with confirmed slot:", {
      coffeeChatId: coffeeChat.id,
      confirmedSlot,
      coffeechat_status: 'confirmed'
    })

    const adminSupabase = createAdminClient()
    const { data: updateData, error: updateError } = await adminSupabase
      .from("coffeechat")
      .update({
        confirmed_slot: confirmedSlot,
        coffeechat_status: 'confirmed',
      })
      .eq("id", coffeeChat.id)
      .select()

    if (updateError) {
      console.error("❌ Failed to update coffee chat:", updateError)
      return NextResponse.json(
        { error: "Failed to confirm coffee chat", details: updateError.message },
        { status: 500 }
      )
    }

    console.log("✅ Successfully updated coffee chat with confirmed slot")
    console.log("📊 Updated data:", updateData)

    // Send confirmation emails to both student and recruiter
    await EmailService.sendCoffeeChatConfirmation(
      coffeeChat.student.email,
      coffeeChat.student.name || "Student",
      coffeeChat.recruiter.email,
      coffeeChat.recruiter.name || "Recruiter",
      confirmedSlot
    )

    return NextResponse.json({
      success: true,
      message: "Coffee chat confirmed successfully",
      confirmedSlot,
    })
  } catch (error) {
    console.error("Error confirming coffee chat:", error)
    return NextResponse.json(
      { error: "Failed to confirm coffee chat" },
      { status: 500 }
    )
  }
}
