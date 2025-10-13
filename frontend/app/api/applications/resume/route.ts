import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StorageService } from '@/lib/services/storage.service';
import { AuthService } from '@/lib/services/auth.service';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the file from FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Create unique filename: userId_timestamp.pdf
    const timestamp = Date.now();
    const fileName = `${session.user.id}_${timestamp}.pdf`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      
      // Check if bucket doesn't exist
      if (uploadError.message?.includes('Bucket not found') || 
          uploadError.message?.includes('bucket') ||
          uploadError.message?.includes('404')) {
        return NextResponse.json({ 
          error: 'Storage bucket "resumes" not found. Please create it in Supabase Dashboard.',
          details: 'Go to Storage → New bucket → Name: "resumes" → Make it public',
          technicalError: uploadError.message
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to upload file to storage',
        details: uploadError.message 
      }, { status: 500 });
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(fileName);

    return NextResponse.json({ 
      success: true,
      resumeUrl: urlData.publicUrl,
      fileName: fileName
    });

  } catch (error) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await AuthService.getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { resumePath } = body;

    if (!resumePath) {
      return NextResponse.json({ error: 'Resume path is required' }, { status: 400 });
    }

    // Delete the resume from storage
    const deleted = await StorageService.deleteResume(resumePath);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete resume from storage' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Resume deleted successfully'
    });

  } catch (error) {
    console.error('Resume deletion error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

