import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EmailService } from "@/lib/email-service";
import { randomBytes } from "crypto";

interface InterviewSlot {
  date: string;
  time: string;
}

interface ScheduleInterviewRequest {
  slots: InterviewSlot[];
  recruiterName: string;
  recruiterEmail: string;
  jobTitle: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const body: ScheduleInterviewRequest = await request.json();
    const { slots, recruiterName, recruiterEmail, jobTitle } = body;
    const { id: applicationId } = await params;

    // Validate required fields
    if (
      !slots ||
      slots.length === 0 ||
      !recruiterName ||
      !recruiterEmail ||
      !jobTitle
    ) {
      return NextResponse.json(
        { error: "Missing required fields or no slots provided" },
        { status: 400 }
      );
    }

    // Get applicant details
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
      console.error("Application query error:", appError);
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const studentName = application.profiles?.name || "Candidate";
    const studentEmail = application.profiles?.email;

    if (!studentEmail) {
      return NextResponse.json(
        { error: "Student email not found" },
        { status: 400 }
      );
    }

    // Generate a secure token for the confirmation link
    const confirmationToken = randomBytes(32).toString("hex");

    // Send interview invitation email with confirmation link
    const emailSent = await EmailService.sendInterviewSlotsEmail(
      studentEmail,
      studentName,
      recruiterName,
      recruiterEmail,
      jobTitle,
      slots,
      confirmationToken,
      applicationId
    );

    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send interview invitation" },
        { status: 500 }
      );
    }

    // Update application with proposed slots
    const { error: updateError } = await supabase
      .from("applications")
      .update({
        proposed_slots: slots,
        interview_status: "slots_proposed",
        confirmation_token: confirmationToken,
        token_expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(), // 7 days
      })
      .eq("id", applicationId);

    if (updateError) {
      console.error("Failed to update application:", updateError);
      // Email was sent, so we still return success
    }

    return NextResponse.json({
      success: true,
      message: "Interview slots sent successfully",
      studentEmail,
      studentName,
      slotsCount: slots.length,
    });
  } catch (error) {
    console.error("Error scheduling interview:", error);
    return NextResponse.json(
      { error: "Failed to schedule interview" },
      { status: 500 }
    );
  }
}
