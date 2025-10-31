import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmailService } from "@/lib/email-service";
import crypto from "crypto";

/**
 * AI-Powered Interview Scheduling Endpoint
 *
 * This endpoint receives natural language input from the recruiter
 * (e.g., "schedule on Monday and Tuesday at 9am") and:
 * 1. Parses the dates/times using an LLM
 * 2. Stores the proposed slots in the database
 * 3. Sends an email to the student with a confirmation link
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: applicationId } = await params;
    const body = await request.json();
    const { message, recruiterName, recruiterEmail, jobTitle } = body;

    if (!message || !recruiterName || !recruiterEmail || !jobTitle) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Step 1: Call Python backend to parse the natural language scheduling request
    console.log("📝 Parsing scheduling request:", message);

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

    // Step 2: Get application details
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select(
        `
        *,
        profiles!applications_student_id_fkey (
          id,
          name,
          email
        )
      `
      )
      .eq("id", applicationId)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Step 3: Generate confirmation token
    const confirmationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // Token expires in 7 days

    // Step 4: Update application with proposed slots
    const { error: updateError } = await supabase
      .from("applications")
      .update({
        proposed_slots: parseData.slots,
        interview_status: "slots_proposed",
        confirmation_token: confirmationToken,
        token_expires_at: tokenExpiresAt.toISOString(),
      })
      .eq("id", applicationId);

    if (updateError) {
      console.error("Failed to update application:", updateError);
      return NextResponse.json(
        { error: "Failed to save interview slots" },
        { status: 500 }
      );
    }

    // Step 5: Send email to student with confirmation link
    await EmailService.sendInterviewSlotsEmail(
      application.profiles.email,
      application.profiles.name || "Student",
      recruiterName,
      recruiterEmail,
      jobTitle,
      parseData.slots,
      confirmationToken,
      applicationId
    );

    return NextResponse.json({
      success: true,
      slots: parseData.slots,
      message:
        parseData.ai_message ||
        `I've scheduled interview slots and sent them to ${
          application.profiles.name || "the candidate"
        }.`,
      studentEmail: application.profiles.email,
      studentName: application.profiles.name,
    });
  } catch (error) {
    console.error("Error in AI scheduling:", error);
    return NextResponse.json(
      { error: "Failed to schedule interview" },
      { status: 500 }
    );
  }
}
