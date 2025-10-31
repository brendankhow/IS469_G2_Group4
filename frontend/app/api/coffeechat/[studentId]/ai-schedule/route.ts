import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmailService } from "@/lib/email-service";
import crypto from "crypto";

/**
 * AI-Powered Coffee Chat Scheduling Endpoint
 *
 * This endpoint receives natural language input from the recruiter
 * (e.g., "schedule coffee chat on Monday and Tuesday at 9am") and:
 * 1. Parses the dates/times using an LLM
 * 2. Stores the proposed slots in the coffeechat table
 * 3. Sends an email to the student with a confirmation link
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { studentId } = await params;
    const body = await request.json();
    const { message, recruiterName, recruiterEmail, recruiterId } = body;

    if (!message || !recruiterName || !recruiterEmail || !recruiterId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Step 1: Call Python backend to parse the natural language scheduling request
    console.log("📝 Parsing coffee chat scheduling request:", message);

    const parseResponse = await fetch(
      "http://localhost:8000/chat/parse_schedule",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          current_date: new Date().toISOString(),
        }),
      }
    );

    if (!parseResponse.ok) {
      throw new Error("Failed to parse scheduling request");
    }

    const parseData = await parseResponse.json();
    console.log("✅ Parsed slots:", parseData.slots);

    if (!parseData.slots || parseData.slots.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not understand the scheduling request. Please try again with specific dates and times (e.g., 'Monday and Tuesday at 9am').",
        },
        { status: 400 }
      );
    }

    // Step 2: Get student details
    const { data: student, error: studentError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Step 3: Generate confirmation token
    const confirmationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // Token expires in 7 days

    // Step 4: Check if coffee chat already exists
    const { data: existingCoffeeChat } = await supabase
      .from("coffeechat")
      .select("id")
      .eq("recruiter_id", recruiterId)
      .eq("student_id", studentId)
      .in("coffeechat_status", ["slots_proposed", "confirmed"])
      .single();

    let coffeeChatId: string;

    if (existingCoffeeChat) {
      // Update existing coffee chat
      const { error: updateError } = await supabase
        .from("coffeechat")
        .update({
          proposed_slots: parseData.slots,
          coffeechat_status: "slots_proposed",
          confirmation_token: confirmationToken,
          token_expires_at: tokenExpiresAt.toISOString(),
          confirmed_slot: null, // Reset confirmed slot
        })
        .eq("id", existingCoffeeChat.id);

      if (updateError) {
        console.error("Failed to update coffee chat:", updateError);
        return NextResponse.json(
          { error: "Failed to save coffee chat slots" },
          { status: 500 }
        );
      }

      coffeeChatId = existingCoffeeChat.id;
    } else {
      // Create new coffee chat
      const { data: newCoffeeChat, error: createError } = await supabase
        .from("coffeechat")
        .insert({
          recruiter_id: recruiterId,
          student_id: studentId,
          proposed_slots: parseData.slots,
          coffeechat_status: "slots_proposed",
          confirmation_token: confirmationToken,
          token_expires_at: tokenExpiresAt.toISOString(),
        })
        .select()
        .single();

      if (createError || !newCoffeeChat) {
        console.error("Failed to create coffee chat:", createError);
        return NextResponse.json(
          { error: "Failed to save coffee chat slots" },
          { status: 500 }
        );
      }

      coffeeChatId = newCoffeeChat.id;
    }

    // Step 5: Send email to student with confirmation link
    await EmailService.sendCoffeeChatSlotsEmail(
      student.email,
      student.name || "Student",
      recruiterName,
      recruiterEmail,
      parseData.slots,
      confirmationToken,
      coffeeChatId
    );

    return NextResponse.json({
      success: true,
      slots: parseData.slots,
      message:
        parseData.ai_message ||
        `I've scheduled coffee chat slots and sent them to ${
          student.name || "the candidate"
        }.`,
      studentEmail: student.email,
      studentName: student.name,
      coffeeChatId,
    });
  } catch (error) {
    console.error("Error in AI coffee chat scheduling:", error);
    return NextResponse.json(
      { error: "Failed to schedule coffee chat" },
      { status: 500 }
    );
  }
}
