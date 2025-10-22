import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase/server'
import { marked } from 'marked'

interface EmailAttachment {
  filename: string
  path?: string
  content?: Buffer
  contentType?: string
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  attachments?: EmailAttachment[]
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
      })
      
      return marked.parse(markdown) as string
    } catch (error) {
      // Return formatted plain text as fallback
      return markdown.replace(/\n/g, '<br>')
    }
  },

  /**
   * Extract storage path from Supabase public URL
   * Converts: https://.../storage/v1/object/public/resumes/path.pdf
   * To: path.pdf
   */
  extractStoragePath: (publicUrl: string): string | null => {
    try {
      const match = publicUrl.match(/\/resumes\/(.+)$/)
      return match ? match[1] : publicUrl // Return path or full URL as fallback
    } catch (error) {
      return publicUrl // Return original URL as fallback
    }
  },
  /**
   * Create Gmail transporter - supports both OAuth2 and App Password
   */
  createTransporter: () => {
    // Check if OAuth2 credentials are configured (preferred method)
    if (process.env.GMAIL_USER && process.env.GMAIL_CLIENT_ID &&
        process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {

      return nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        },
      })
    }

    // Fallback to App Password method (if OAuth2 not configured)
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      return nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      })
    }

    // No credentials configured - mock mode
    return null
  },

  /**
   * Send generic email with optional attachments
   */
  sendEmail: async (options: SendEmailOptions): Promise<boolean> => {
    try {
      const transporter = EmailService.createTransporter()
      
      if (!transporter) {
        return true
      }

      const mailOptions = {
        from: `"HireAI Platform" <${process.env.GMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      }

      await transporter.sendMail(mailOptions)
      return true
    } catch (error) {
      return false
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
      const coverLetterHtml = EmailService.convertMarkdownToHtml(coverLetter)
      
      // Fetch resume from Supabase if URL provided
      const attachments: EmailAttachment[] = []
      
      if (resumeUrl) {
        const supabase = await createClient()
        
        // Extract storage path from public URL
        const storagePath = EmailService.extractStoragePath(resumeUrl)
        
        if (storagePath) {
          const { data: resumeBlob, error } = await supabase.storage
            .from('resumes')
            .download(storagePath)

          if (!error && resumeBlob) {
            const buffer = Buffer.from(await resumeBlob.arrayBuffer())
            attachments.push({
              filename: 'resume.pdf',
              content: buffer,
              contentType: 'application/pdf',
            })
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
              <p>Dear ${studentName || 'Applicant'},</p>
              
              <p>Thank you for applying to <strong>${jobTitle}</strong> at <strong>${companyName}</strong> through HireAI!</p>
              
              <p>Your application has been successfully submitted and the recruiter will review it shortly.</p>
              
              <h3>Application Summary:</h3>
              <ul>
                <li><strong>Position:</strong> ${jobTitle}</li>
                <li><strong>Company:</strong> ${companyName}</li>
                <li><strong>Resume:</strong> ${resumeUrl ? 'Attached' : 'Not provided'}</li>
                <li><strong>Submitted:</strong> ${new Date().toLocaleDateString()}</li>
              </ul>
              
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/student/applications" class="button">
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
      `

      return await EmailService.sendEmail({
        to: studentEmail,
        subject: `Application Confirmation - ${jobTitle}`,
        html,
        attachments,
      })
    } catch (error) {
      return false
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
      const coverLetterHtml = EmailService.convertMarkdownToHtml(coverLetter)
      
      // Fetch resume from Supabase if URL provided
      const attachments: EmailAttachment[] = []
      
      if (resumeUrl) {
        const supabase = await createClient()
        
        // Extract storage path from public URL
        const storagePath = EmailService.extractStoragePath(resumeUrl)
        
        if (storagePath) {
          const { data: resumeBlob, error } = await supabase.storage
            .from('resumes')
            .download(storagePath)

          if (!error && resumeBlob) {
            const buffer = Buffer.from(await resumeBlob.arrayBuffer())
            attachments.push({
              filename: `${studentName.replace(/\s+/g, '_')}_resume.pdf`,
              content: buffer,
              contentType: 'application/pdf',
            })
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
              <p>Dear ${recruiterName || 'Recruiter'},</p>
              
              <p>You have received a new application for <strong>${jobTitle}</strong>.</p>
              
              <div class="applicant-info">
                <h3>Applicant Information:</h3>
                <ul>
                  <li><strong>Name:</strong> ${studentName}</li>
                  <li><strong>Email:</strong> ${studentEmail}</li>
                  <li><strong>Resume:</strong> ${resumeUrl ? 'Attached to this email' : 'Not provided'}</li>
                  <li><strong>Applied:</strong> ${new Date().toLocaleDateString()}</li>
                </ul>
              </div>
              
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/recruiter/applicants" class="button">
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
      `

      return await EmailService.sendEmail({
        to: recruiterEmail,
        subject: `New Application: ${studentName} - ${jobTitle}`,
        html,
        attachments,
      })
    } catch (error) {
      return false
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
    `

    return await EmailService.sendEmail({
      to,
      subject: `Application Update - ${jobTitle}`,
      html,
    })
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
    `

    return await EmailService.sendEmail({
      to,
      subject: `Congratulations! Application Accepted - ${jobTitle}`,
      html,
    })
  },
}
