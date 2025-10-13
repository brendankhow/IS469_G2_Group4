// Mock email service - emails are logged to console instead of being sent
export const EmailService = {
  sendRejectionEmail: async (to: string, candidateName: string, jobTitle: string) => {
    console.log("[v0] Email disabled - Would have sent rejection email:")
    console.log(`  To: ${to}`)
    console.log(`  Subject: Application Update - ${jobTitle}`)
    console.log(`  Message: Dear ${candidateName}, thank you for your interest in ${jobTitle}. Unfortunately...`)
    return Promise.resolve()
  },

  sendAcceptanceEmail: async (to: string, candidateName: string, jobTitle: string) => {
    console.log("[v0] Email disabled - Would have sent acceptance email:")
    console.log(`  To: ${to}`)
    console.log(`  Subject: Congratulations! Application Accepted - ${jobTitle}`)
    console.log(
      `  Message: Dear ${candidateName}, we are pleased to inform you that your application for ${jobTitle} has been accepted...`,
    )
    return Promise.resolve()
  },
}
