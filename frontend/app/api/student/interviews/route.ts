import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all interviews for this student
    const { data: applications, error } = await supabase
      .from("applications")
      .select(
        `
        id,
        student_id,
        proposed_slots,
        confirmed_slot,
        interview_status,
        confirmation_token,
        token_expires_at,
        created_at,
        jobs!inner (
          title,
          recruiter_id,
          profiles!jobs_recruiter_id_fkey (
            name,
            email
          )
        )
      `
      )
      .eq("student_id", user.id)
      .not("proposed_slots", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching interviews:", error);
      return NextResponse.json(
        { error: "Failed to fetch interviews" },
        { status: 500 }
      );
    }

    // Transform the data
    const interviews = applications.map((app: any) => ({
      id: app.id,
      recruiter_id: app.jobs?.recruiter_id,
      recruiter_name: app.jobs?.profiles?.name || "Unknown",
      recruiter_email: app.jobs?.profiles?.email || "",
      job_title: app.jobs?.title || "Unknown Position",
      proposed_slots: app.proposed_slots || [],
      confirmed_slot: app.confirmed_slot,
      interview_status: app.interview_status || "pending",
      created_at: app.created_at,
    }));

    return NextResponse.json({ interviews });
  } catch (error) {
    console.error("Error in GET /api/student/interviews:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
