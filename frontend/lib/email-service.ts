import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";
import { marked } from "marked";

interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer;
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

/**
 * Email Service using Gmail OAuth2 (Recommended) or App Password (Alternative)
 * Sends application confirmations, notifications, and status updates
 */
export const EmailService = {
  /**
   * Convert markdown to HTML for email display
   */
  convertMarkdownToHtml: (markdown: string): string => {
    try {
      // Configure marked to be safer and cleaner
      marked.setOptions({
        breaks: true, // Convert \n to <br>
        gfm: true, // GitHub flavored markdown
      });

      return marked.parse(markdown) as string;
    } catch (error) {
      // Return formatted plain text as fallback
      return markdown.replace(/\n/g, "<br>");
    }
  },

  /**
   * Extract storage path from Supabase public URL
   * Converts: https://.../storage/v1/object/public/resumes/path.pdf
   * To: path.pdf
   */
  extractStoragePath: (publicUrl: string): string | null => {
    try {
      const match = publicUrl.match(/\/resumes\/(.+)$/);
      return match ? match[1] : publicUrl; // Return path or full URL as fallback
    } catch (error) {
      return publicUrl; // Return original URL as fallback
    }
  },
  /**
   * Create Gmail transporter - supports both OAuth2 and App Password
   */
  createTransporter: () => {
    // Check if OAuth2 credentials are configured (preferred method)
    if (
      process.env.GMAIL_USER &&
      process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN
    ) {
      return nodemailer.createTransport({
        service: "Gmail",
        auth: {
          type: "OAuth2",
          user: process.env.GMAIL_USER,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        },
      });
    }

    // Fallback to App Password method (if OAuth2 not configured)
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      return nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
    }

    // No credentials configured - mock mode
    return null;
  },

  /**
   * Send generic email with optional attachments
   */
  sendEmail: async (options: SendEmailOptions): Promise<boolean> => {
    try {
      const transporter = EmailService.createTransporter();

      if (!transporter) {
        return true;
      }

      const mailOptions = {
        from: `"HireAI Platform" <${process.env.GMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Send application confirmation to student with cover letter and resume
   */
  sendApplicationConfirmation: async (
    studentEmail: string,
    studentName: string,
    jobTitle: string,
    companyName: string,
    coverLetter: string,
    resumeUrl?: string | null
  ): Promise<boolean> => {
    try {
      // Convert markdown cover letter to HTML
      const coverLetterHtml = EmailService.convertMarkdownToHtml(coverLetter);

      // Fetch resume from Supabase if URL provided
      const attachments: EmailAttachment[] = [];

      if (resumeUrl) {
        const supabase = await createClient();

        // Extract storage path from public URL
        const storagePath = EmailService.extractStoragePath(resumeUrl);

        if (storagePath) {
          const { data: resumeBlob, error } = await supabase.storage
            .from("resumes")
            .download(storagePath);

          if (!error && resumeBlob) {
            const buffer = Buffer.from(await resumeBlob.arrayBuffer());
            attachments.push({
              filename: "resume.pdf",
              content: buffer,
              contentType: "application/pdf",
            });
          }
        }
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .cover-letter { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5; white-space: pre-wrap; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Application Submitted Successfully!</h1>
            </div>
            
            <div class="content">
              <p>Dear ${studentName || "Applicant"},</p>
              
              <p>Thank you for applying to <strong>${jobTitle}</strong> at <strong>${companyName}</strong> through HireAI!</p>
              
              <p>Your application has been successfully submitted and the recruiter will review it shortly.</p>
              
              <h3>Application Summary:</h3>
              <ul>
                <li><strong>Position:</strong> ${jobTitle}</li>
                <li><strong>Company:</strong> ${companyName}</li>
                <li><strong>Resume:</strong> ${
                  resumeUrl ? "Attached" : "Not provided"
                }</li>
                <li><strong>Submitted:</strong> ${new Date().toLocaleDateString()}</li>
              </ul>
              
              <a href="${
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
              }/student/applications" class="button">
                View Your Applications
              </a>
            </div>
            
            <div class="cover-letter">
              <h3>Your Cover Letter:</h3>
              ${coverLetterHtml}
            </div>
            
            <div class="footer">
              <p>This is an automated message from HireAI Platform</p>
              <p>© ${new Date().getFullYear()} HireAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await EmailService.sendEmail({
        to: studentEmail,
        subject: `Application Confirmation - ${jobTitle}`,
        html,
        attachments,
      });
    } catch (error) {
      return false;
    }
  },

  /**
   * Send new application notification to recruiter
   */
  sendRecruiterNotification: async (
    recruiterEmail: string,
    recruiterName: string,
    studentName: string,
    studentEmail: string,
    jobTitle: string,
    coverLetter: string,
    resumeUrl?: string | null
  ): Promise<boolean> => {
    try {
      // Convert markdown cover letter to HTML
      const coverLetterHtml = EmailService.convertMarkdownToHtml(coverLetter);

      // Fetch resume from Supabase if URL provided
      const attachments: EmailAttachment[] = [];

      if (resumeUrl) {
        const supabase = await createClient();

        // Extract storage path from public URL
        const storagePath = EmailService.extractStoragePath(resumeUrl);

        if (storagePath) {
          const { data: resumeBlob, error } = await supabase.storage
            .from("resumes")
            .download(storagePath);

          if (!error && resumeBlob) {
            const buffer = Buffer.from(await resumeBlob.arrayBuffer());
            attachments.push({
              filename: `${studentName.replace(/\s+/g, "_")}_resume.pdf`,
              content: buffer,
              contentType: "application/pdf",
            });
          }
        }
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .applicant-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #10B981; }
            .cover-letter { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981; white-space: pre-wrap; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📩 New Application Received!</h1>
            </div>
            
            <div class="content">
              <p>Dear ${recruiterName || "Recruiter"},</p>
              
              <p>You have received a new application for <strong>${jobTitle}</strong>.</p>
              
              <div class="applicant-info">
                <h3>Applicant Information:</h3>
                <ul>
                  <li><strong>Name:</strong> ${studentName}</li>
                  <li><strong>Email:</strong> ${studentEmail}</li>
                  <li><strong>Resume:</strong> ${
                    resumeUrl ? "Attached to this email" : "Not provided"
                  }</li>
                  <li><strong>Applied:</strong> ${new Date().toLocaleDateString()}</li>
                </ul>
              </div>
              
              <a href="${
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
              }/recruiter/applicants" class="button">
                Review Application
              </a>
            </div>
            
            <div class="cover-letter">
              <h3>Cover Letter:</h3>
              ${coverLetterHtml}
            </div>
            
            <div class="footer">
              <p>This is an automated message from HireAI Platform</p>
              <p>© ${new Date().getFullYear()} HireAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await EmailService.sendEmail({
        to: recruiterEmail,
        subject: `New Application: ${studentName} - ${jobTitle}`,
        html,
        attachments,
      });
    } catch (error) {
      return false;
    }
  },

  /**
   * Send rejection email to student
   */
  sendRejectionEmail: async (
    to: string,
    candidateName: string,
    jobTitle: string
  ): Promise<boolean> => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application Update</h1>
          </div>
          
          <div class="content">
            <p>Dear ${candidateName},</p>
            
            <p>Thank you for your interest in the <strong>${jobTitle}</strong> position.</p>
            
            <p>After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p>
            
            <p>We appreciate the time and effort you put into your application. We encourage you to apply for other positions that match your skills and experience.</p>
            
            <p>Best wishes in your job search!</p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from HireAI Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await EmailService.sendEmail({
      to,
      subject: `Application Update - ${jobTitle}`,
      html,
    });
  },

  /**
   * Send acceptance email to student
   */
  sendAcceptanceEmail: async (
    to: string,
    candidateName: string,
    jobTitle: string
  ): Promise<boolean> => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
          </div>
          
          <div class="content">
            <p>Dear ${candidateName},</p>
            
            <p>We are pleased to inform you that your application for the <strong>${jobTitle}</strong> position has been <strong>accepted</strong>!</p>
            
            <p>The recruiter will be in touch with you shortly regarding the next steps in the hiring process.</p>
            
            <p>Congratulations on this achievement!</p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from HireAI Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await EmailService.sendEmail({
      to,
      subject: `Congratulations! Application Accepted - ${jobTitle}`,
      html,
    });
  },

  /**
   * Send interview invitation with calendar event
   */
  sendInterviewInvitation: async (
    studentEmail: string,
    studentName: string,
    recruiterName: string,
    recruiterEmail: string,
    jobTitle: string,
    date: string,
    time: string
  ): Promise<boolean> => {
    try {
      // Parse date and time to create calendar event
      const [hours, minutes] = time.split(":");
      const interviewDate = new Date(date);
      interviewDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Calculate end time (30 minutes later)
      const endDate = new Date(interviewDate);
      endDate.setMinutes(endDate.getMinutes() + 30);

      // Format dates for iCalendar
      const formatICalDate = (d: Date): string => {
        return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };

      // Create iCalendar event
      const icalEvent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HireAI//Interview Scheduler//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${Date.now()}-${studentEmail}@hireai.com
DTSTAMP:${formatICalDate(new Date())}
DTSTART:${formatICalDate(interviewDate)}
DTEND:${formatICalDate(endDate)}
SUMMARY:Interview for ${jobTitle}
DESCRIPTION:Interview with ${recruiterName} for the ${jobTitle} position
LOCATION:Online (Link will be shared separately)
ORGANIZER;CN=${recruiterName}:mailto:${recruiterEmail}
ATTENDEE;CN=${studentName};RSVP=TRUE:mailto:${studentEmail}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .interview-details { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .highlight { background-color: #FEF3C7; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Interview Scheduled!</h1>
            </div>
            
            <div class="content">
              <p>Dear ${studentName},</p>
              
              <p>Great news! Your interview for the <strong>${jobTitle}</strong> position has been scheduled.</p>
              
              <div class="interview-details">
                <h3>Interview Details:</h3>
                <ul>
                  <li><strong>Position:</strong> ${jobTitle}</li>
                  <li><strong>Interviewer:</strong> ${recruiterName}</li>
                  <li><strong>Date:</strong> <span class="highlight">${new Date(
                    date
                  ).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}</span></li>
                  <li><strong>Time:</strong> <span class="highlight">${time}</span></li>
                  <li><strong>Duration:</strong> 30 minutes</li>
                  <li><strong>Location:</strong> Online (Link will be shared separately)</li>
                </ul>
              </div>
              
              <p>A calendar event has been attached to this email. Please add it to your calendar to ensure you don't miss the interview.</p>
              
              <p><strong>Preparation Tips:</strong></p>
              <ul>
                <li>Test your internet connection and audio/video setup beforehand</li>
                <li>Review the job description and company information</li>
                <li>Prepare questions you'd like to ask about the role</li>
                <li>Be ready 5-10 minutes early</li>
              </ul>
              
              <p>If you need to reschedule, please reply to this email at your earliest convenience.</p>
              
              <p>Good luck with your interview!</p>
            </div>
            
            <div class="footer">
              <p>This is an automated message from HireAI Platform</p>
              <p>For questions, contact: ${recruiterEmail}</p>
              <p>© ${new Date().getFullYear()} HireAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await EmailService.sendEmail({
        to: studentEmail,
        subject: `Interview Scheduled - ${jobTitle}`,
        html,
        attachments: [
          {
            filename: "interview.ics",
            content: Buffer.from(icalEvent),
            contentType: "text/calendar",
          },
        ],
      });
    } catch (error) {
      console.error("Error sending interview invitation:", error);
      return false;
    }
  },

  /**
   * Send interview slots email with confirmation link
   */
  sendInterviewSlotsEmail: async (
    studentEmail: string,
    studentName: string,
    recruiterName: string,
    recruiterEmail: string,
    jobTitle: string,
    slots: Array<{ date: string; time: string }>,
    confirmationToken: string,
    applicationId: string
  ): Promise<boolean> => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const confirmationLink = `${baseUrl}/student/confirm-interview/${confirmationToken}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .interview-details { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5; }
            .slot { background-color: #f3f4f6; padding: 12px; margin: 8px 0; border-radius: 5px; border-left: 3px solid #4F46E5; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            .button { display: inline-block; padding: 14px 28px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; font-weight: bold; }
            .highlight { background-color: #FEF3C7; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Interview Time Selection Required</h1>
            </div>
            
            <div class="content">
              <p>Dear ${studentName},</p>
              
              <p>Great news! <strong>${recruiterName}</strong> would like to schedule an interview with you for the <strong>${jobTitle}</strong> position.</p>
              
              <p>Please select your preferred interview time from the available slots below:</p>
              
              <div class="interview-details">
                <h3>Available Time Slots (${slots.length} options):</h3>
                ${slots
                  .map(
                    (slot, index) => `
                  <div class="slot">
                    <strong>Option ${index + 1}:</strong> 
                    ${new Date(slot.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })} 
                    at <span class="highlight">${slot.time}</span> (30 minutes)
                  </div>
                `
                  )
                  .join("")}
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationLink}" class="button">
                  🗓️ Select Your Preferred Time
                </a>
              </div>
              
              <p style="font-size: 13px; color: #666;">
                <strong>Note:</strong> This link will expire in 7 days. Please select your preferred time as soon as possible.
              </p>
              
              <p><strong>What to expect:</strong></p>
              <ul>
                <li>Click the button above to view all available times</li>
                <li>Select your preferred interview slot</li>
                <li>You'll receive a confirmation email with calendar invitation</li>
                <li>The recruiter will be notified of your selection</li>
              </ul>
              
              <p>If you have any questions or none of these times work for you, please reply to this email.</p>
              
              <p>We look forward to speaking with you!</p>
            </div>
            
            <div class="footer">
              <p>This is an automated message from HireAI Platform</p>
              <p>For questions, contact: ${recruiterEmail}</p>
              <p>© ${new Date().getFullYear()} HireAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await EmailService.sendEmail({
        to: studentEmail,
        subject: `Interview Time Selection - ${jobTitle}`,
        html,
      });
    } catch (error) {
      console.error("Error sending interview slots email:", error);
      return false;
    }
  },

  /**
   * Send interview confirmation to recruiter
   */
  sendInterviewConfirmationToRecruiter: async (
    recruiterEmail: string,
    recruiterName: string,
    studentName: string,
    studentEmail: string,
    jobTitle: string,
    confirmedSlot: { date: string; time: string }
  ): Promise<boolean> => {
    try {
      // Parse date and time to create calendar event
      const [hours, minutes] = confirmedSlot.time.split(":");
      const interviewDate = new Date(confirmedSlot.date);
      interviewDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Calculate end time (30 minutes later)
      const endDate = new Date(interviewDate);
      endDate.setMinutes(endDate.getMinutes() + 30);

      // Format dates for iCalendar
      const formatICalDate = (d: Date): string => {
        return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };

      // Create iCalendar event
      const icalEvent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HireAI//Interview Scheduler//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${Date.now()}-${recruiterEmail}@hireai.com
DTSTAMP:${formatICalDate(new Date())}
DTSTART:${formatICalDate(interviewDate)}
DTEND:${formatICalDate(endDate)}
SUMMARY:Interview with ${studentName} for ${jobTitle}
DESCRIPTION:Interview with ${studentName} (${studentEmail}) for the ${jobTitle} position
LOCATION:Online (Link will be shared separately)
ORGANIZER;CN=${recruiterName}:mailto:${recruiterEmail}
ATTENDEE;CN=${studentName};RSVP=TRUE:mailto:${studentEmail}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .interview-details { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            .highlight { background-color: #D1FAE5; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Interview Confirmed!</h1>
            </div>
            
            <div class="content">
              <p>Dear ${recruiterName},</p>
              
              <p><strong>${studentName}</strong> has confirmed their interview time for the <strong>${jobTitle}</strong> position.</p>
              
              <div class="interview-details">
                <h3>Confirmed Interview Details:</h3>
                <ul>
                  <li><strong>Candidate:</strong> ${studentName}</li>
                  <li><strong>Email:</strong> ${studentEmail}</li>
                  <li><strong>Position:</strong> ${jobTitle}</li>
                  <li><strong>Date:</strong> <span class="highlight">${new Date(
                    confirmedSlot.date
                  ).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}</span></li>
                  <li><strong>Time:</strong> <span class="highlight">${
                    confirmedSlot.time
                  }</span></li>
                  <li><strong>Duration:</strong> 30 minutes</li>
                </ul>
              </div>
              
              <p>A calendar event has been attached to this email. Please add it to your calendar.</p>
              
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Add the interview to your calendar</li>
                <li>Prepare interview questions</li>
                <li>Send the meeting link (Zoom, Teams, etc.) to ${studentEmail}</li>
                <li>Review the candidate's application materials</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>This is an automated message from HireAI Platform</p>
              <p>© ${new Date().getFullYear()} HireAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await EmailService.sendEmail({
        to: recruiterEmail,
        subject: `Interview Confirmed - ${studentName} - ${jobTitle}`,
        html,
        attachments: [
          {
            filename: "interview.ics",
            content: Buffer.from(icalEvent),
            contentType: "text/calendar",
          },
        ],
      });
    } catch (error) {
      console.error("Error sending recruiter confirmation:", error);
      return false;
    }
  },

  /**
   * Send coffee chat slot options to student
   */
  sendCoffeeChatSlotsEmail: async (
    studentEmail: string,
    studentName: string,
    recruiterName: string,
    recruiterEmail: string,
    slots: Array<{ date: string; time: string }>,
    confirmationToken: string,
    coffeeChatId: string
  ): Promise<boolean> => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const confirmationLink = `${baseUrl}/student/confirm-coffeechat/${confirmationToken}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .slot { background-color: #f3f4f6; padding: 12px; margin: 8px 0; border-radius: 5px; border-left: 3px solid #10B981; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            .button { display: inline-block; padding: 14px 28px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; font-weight: bold; }
            .highlight { background-color: #D1FAE5; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>☕ Coffee Chat Invitation</h1>
            </div>
            
            <div class="content">
              <p>Dear ${studentName},</p>
              
              <p><strong>${recruiterName}</strong> would like to schedule a coffee chat with you!</p>
              
              <p>This is a great opportunity to have an informal conversation and learn more about potential opportunities.</p>
              
              <p><strong>Available Time Slots:</strong></p>
              ${slots
                .map(
                  (slot) => `
                <div class="slot">
                  <strong>${new Date(slot.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}</strong><br>
                  ${slot.time} (30 minutes)
                </div>
              `
                )
                .join("")}
              
              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Click the button below to select your preferred time</li>
                <li>Choose the time slot that works best for you</li>
                <li>You'll receive a calendar invitation with all the details</li>
              </ol>
              
              <div style="text-align: center;">
                <a href="${confirmationLink}" class="button">Select Your Preferred Time →</a>
              </div>
              
              <p><small><em>This link will expire in 7 days. If you need assistance, please contact ${recruiterEmail}</em></small></p>
            </div>
            
            <div class="footer">
              <p>This is an automated message from HireAI Platform</p>
              <p>© ${new Date().getFullYear()} HireAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await EmailService.sendEmail({
        to: studentEmail,
        subject: `☕ Coffee Chat Invitation from ${recruiterName}`,
        html,
      });
    } catch (error) {
      console.error("Error sending coffee chat slots email:", error);
      return false;
    }
  },

  /**
   * Send coffee chat confirmation to student and recruiter
   */
  sendCoffeeChatConfirmation: async (
    studentEmail: string,
    studentName: string,
    recruiterEmail: string,
    recruiterName: string,
    confirmedSlot: { date: string; time: string; confirmed_at: string }
  ): Promise<boolean> => {
    try {
      // Generate calendar event
      const startDate = new Date(`${confirmedSlot.date}T${confirmedSlot.time}`);
      const endDate = new Date(startDate.getTime() + 30 * 60000); // 30 minutes

      const icalEvent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HireAI//Coffee Chat//EN
BEGIN:VEVENT
UID:${Date.now()}@hireai.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z
DTSTART:${startDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z
DTEND:${endDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z
SUMMARY:☕ Coffee Chat - ${recruiterName} & ${studentName}
DESCRIPTION:Informal coffee chat conversation
LOCATION:To be confirmed
ORGANIZER;CN=${recruiterName}:mailto:${recruiterEmail}
ATTENDEE;CN=${studentName}:mailto:${studentEmail}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

      // Send to student
      const studentHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .details { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Coffee Chat Confirmed!</h1>
            </div>
            
            <div class="content">
              <p>Dear ${studentName},</p>
              
              <p>Your coffee chat with <strong>${recruiterName}</strong> has been confirmed!</p>
              
              <div class="details">
                <h3>Coffee Chat Details:</h3>
                <ul>
                  <li><strong>With:</strong> ${recruiterName}</li>
                  <li><strong>Date:</strong> ${new Date(
                    confirmedSlot.date
                  ).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}</li>
                  <li><strong>Time:</strong> ${confirmedSlot.time}</li>
                  <li><strong>Duration:</strong> 30 minutes</li>
                </ul>
              </div>
              
              <p>A calendar event has been attached to this email. Please add it to your calendar.</p>
              
              <p><strong>Tips for the Coffee Chat:</strong></p>
              <ul>
                <li>Be yourself and relax - it's an informal conversation</li>
                <li>Prepare a few questions about the company or role</li>
                <li>Share your interests and career goals</li>
                <li>The recruiter will share more details about the meeting location closer to the date</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>This is an automated message from HireAI Platform</p>
              <p>© ${new Date().getFullYear()} HireAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send to recruiter
      const recruiterHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .details { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Coffee Chat Confirmed!</h1>
            </div>
            
            <div class="content">
              <p>Dear ${recruiterName},</p>
              
              <p><strong>${studentName}</strong> has confirmed the coffee chat!</p>
              
              <div class="details">
                <h3>Confirmed Coffee Chat Details:</h3>
                <ul>
                  <li><strong>Candidate:</strong> ${studentName}</li>
                  <li><strong>Email:</strong> ${studentEmail}</li>
                  <li><strong>Date:</strong> ${new Date(
                    confirmedSlot.date
                  ).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}</li>
                  <li><strong>Time:</strong> ${confirmedSlot.time}</li>
                  <li><strong>Duration:</strong> 30 minutes</li>
                </ul>
              </div>
              
              <p>A calendar event has been attached to this email.</p>
              
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Add the coffee chat to your calendar</li>
                <li>Decide on a location (coffee shop, video call, etc.)</li>
                <li>Send location details to ${studentEmail}</li>
                <li>Prepare conversation topics</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>This is an automated message from HireAI Platform</p>
              <p>© ${new Date().getFullYear()} HireAI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send both emails with calendar attachment
      const studentEmailSent = await EmailService.sendEmail({
        to: studentEmail,
        subject: `✅ Coffee Chat Confirmed with ${recruiterName}`,
        html: studentHtml,
        attachments: [
          {
            filename: "coffeechat.ics",
            content: Buffer.from(icalEvent),
            contentType: "text/calendar",
          },
        ],
      });

      const recruiterEmailSent = await EmailService.sendEmail({
        to: recruiterEmail,
        subject: `✅ Coffee Chat Confirmed - ${studentName}`,
        html: recruiterHtml,
        attachments: [
          {
            filename: "coffeechat.ics",
            content: Buffer.from(icalEvent),
            contentType: "text/calendar",
          },
        ],
      });

      return studentEmailSent && recruiterEmailSent;
    } catch (error) {
      console.error("Error sending coffee chat confirmation:", error);
      return false;
    }
  },
};
