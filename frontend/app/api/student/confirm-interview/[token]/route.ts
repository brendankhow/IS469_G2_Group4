import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createClient();
    const { token } = await params;

    // Find application by confirmation token
    const { data: application, error } = await supabase
      .from("applications")
      .select(
        `
        *,
        profiles!applications_student_id_fkey (
          id,
          name,
          email
        ),
        jobs!applications_job_id_fkey (
          id,
          title,
          recruiter_id
        )
      `
      )
      .eq("confirmation_token", token)
      .single();

    if (error || !application) {
      return NextResponse.json(
        { error: "Invalid or expired confirmation link", isValid: false },
        { status: 404 }
      );
    }

    // Check if token is expired
    const tokenExpiresAt = application.token_expires_at
      ? new Date(application.token_expires_at)
      : null;
    const isExpired = tokenExpiresAt ? new Date() > tokenExpiresAt : false;

    if (isExpired) {
      return NextResponse.json(
        {
          error: "This confirmation link has expired",
          isValid: false,
          isExpired: true,
        },
        { status: 400 }
      );
    }

    // Get recruiter details
    const { data: recruiterProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", application.jobs.recruiter_id)
      .single();

    return NextResponse.json({
      isValid: true,
      isExpired: false,
      studentName: application.profiles?.name || "Student",
      recruiterName: recruiterProfile?.name || "Recruiter",
      recruiterEmail: recruiterProfile?.email || "",
      jobTitle: application.jobs?.title || "Position",
      slots: application.proposed_slots || [],
      confirmedSlot: application.confirmed_slot || null,
      interviewStatus: application.interview_status,
    });
  } catch (error) {
    console.error("Error fetching confirmation data:", error);
    return NextResponse.json(
      { error: "Failed to load confirmation data", isValid: false },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createClient();
    const { token } = await params;
    const body = await request.json();
    const { selectedSlot } = body;

    if (!selectedSlot || !selectedSlot.date || !selectedSlot.time) {
      return NextResponse.json(
        { error: "Invalid slot selection" },
        { status: 400 }
      );
    }

    // Find application by confirmation token
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select(
        `
        *,
        profiles!applications_student_id_fkey (
          id,
          name,
          email
        ),
        jobs!applications_job_id_fkey (
          id,
          title,
          recruiter_id
        )
      `
      )
      .eq("confirmation_token", token)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { error: "Invalid or expired confirmation link" },
        { status: 404 }
      );
    }

    // Check if token is expired
    const tokenExpiresAt = application.token_expires_at
      ? new Date(application.token_expires_at)
      : null;
    const isExpired = tokenExpiresAt ? new Date() > tokenExpiresAt : false;

    if (isExpired) {
      return NextResponse.json(
        { error: "This confirmation link has expired" },
        { status: 400 }
      );
    }

    // Check if already confirmed
    if (application.confirmed_slot) {
      return NextResponse.json(
        { error: "Interview has already been confirmed" },
        { status: 400 }
      );
    }

    // Verify selected slot is in proposed slots
    const proposedSlots = application.proposed_slots || [];
    const isValidSlot = proposedSlots.some(
      (slot: any) =>
        slot.date === selectedSlot.date && slot.time === selectedSlot.time
    );

    if (!isValidSlot) {
      return NextResponse.json(
        { error: "Selected slot is not available" },
        { status: 400 }
      );
    }

    // Get recruiter details
    const { data: recruiterProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", application.jobs.recruiter_id)
      .single();

    // Update application with confirmed slot
    const confirmedSlot = {
      date: selectedSlot.date,
      time: selectedSlot.time,
      confirmed_at: new Date().toISOString(),
    };

    console.log("🔄 Updating application with confirmed slot:", {
      applicationId: application.id,
      confirmedSlot,
      interview_status: "confirmed",
    });

    // Use admin client to bypass RLS for the update
    const adminSupabase = createAdminClient();
    const { data: updateData, error: updateError } = await adminSupabase
      .from("applications")
      .update({
        confirmed_slot: confirmedSlot,
        interview_status: "confirmed",
      })
      .eq("id", application.id)
      .select();

    if (updateError) {
      console.error("❌ Failed to update application:", updateError);
      return NextResponse.json(
        { error: "Failed to confirm interview", details: updateError.message },
        { status: 500 }
      );
    }

    console.log("✅ Successfully updated application with confirmed slot");
    console.log("📊 Updated data:", updateData);

    // Verify the update by re-fetching
    const { data: verifyData, error: verifyError } = await adminSupabase
      .from("applications")
      .select("confirmed_slot, interview_status")
      .eq("id", application.id)
      .single();

    console.log("🔍 Verification query result:", verifyData);
    if (verifyError) {
      console.error("❌ Verification query failed:", verifyError);
    }

    // Send confirmation emails (imported dynamically to avoid circular deps)
    const { EmailService } = await import("@/lib/email-service");

    // Send confirmation to student
    await EmailService.sendInterviewInvitation(
      application.profiles.email,
      application.profiles.name || "Student",
      recruiterProfile?.name || "Recruiter",
      recruiterProfile?.email || "",
      application.jobs.title,
      selectedSlot.date,
      selectedSlot.time
    );

    // Send confirmation to recruiter
    await EmailService.sendInterviewConfirmationToRecruiter(
      recruiterProfile?.email || "",
      recruiterProfile?.name || "Recruiter",
      application.profiles.name || "Student",
      application.profiles.email,
      application.jobs.title,
      confirmedSlot
    );

    return NextResponse.json({
      success: true,
      message: "Interview confirmed successfully",
      confirmedSlot,
    });
  } catch (error) {
    console.error("Error confirming interview:", error);
    return NextResponse.json(
      { error: "Failed to confirm interview" },
      { status: 500 }
    );
  }
}
