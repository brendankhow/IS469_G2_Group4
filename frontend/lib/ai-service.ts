/**
 * Mock AI Service
 * In production, this would integrate with OpenAI API for:
 * - Cover letter generation
 * - Chatbot responses
 * - Candidate matching using embeddings and cosine similarity
 */

interface CoverLetterParams {
  jobTitle: string
  jobDescription: string
  requirements?: string
  studentSkills?: string
  studentHobbies?: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export class AIService {
  /**
   * Generate a cover letter based on job details and student profile
   * Mock implementation - would use OpenAI GPT-4 in production
   */
  static async generateCoverLetter(params: CoverLetterParams): Promise<string> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const { jobTitle, jobDescription, requirements, studentSkills, studentHobbies } = params

    return `Dear Hiring Manager,

I am writing to express my strong interest in the ${jobTitle} position at your company. ${jobDescription ? `I was particularly drawn to this role because ${jobDescription.slice(0, 100)}...` : ""}

${requirements ? `I have experience with ${requirements}, which aligns perfectly with your requirements. ` : ""}${studentSkills ? `My technical skills include ${studentSkills}, which I believe would be valuable for this position. ` : ""}

${studentHobbies ? `In my free time, I enjoy ${studentHobbies}, which has helped me develop strong problem-solving and creative thinking skills. ` : ""}I am excited about the opportunity to bring my skills and enthusiasm to your team and contribute to your organization's success.

Thank you for considering my application. I look forward to discussing how I can contribute to your organization.

Best regards,
[Your Name]`
  }

  /**
   * Chatbot for refining cover letters
   * Mock implementation - would use OpenAI Chat API in production
   */
  static async chatWithAssistant(messages: ChatMessage[], context?: string): Promise<string> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || ""

    // Mock responses based on keywords
    if (lastMessage.includes("shorter") || lastMessage.includes("concise")) {
      return "I'll help you make it more concise. Consider removing redundant phrases and focusing on your key achievements. Would you like me to suggest specific edits?"
    }

    if (lastMessage.includes("professional") || lastMessage.includes("formal")) {
      return "To make it more professional, I recommend using stronger action verbs and quantifying your achievements. For example, instead of 'worked on projects', say 'led 3 cross-functional projects resulting in 20% efficiency improvement'."
    }

    if (lastMessage.includes("skills") || lastMessage.includes("experience")) {
      return "Great question! I suggest highlighting your most relevant technical skills and providing specific examples of how you've applied them. Would you like me to help you restructure that section?"
    }

    return "I can help you refine your cover letter. You can ask me to make it shorter, more professional, emphasize specific skills, or adjust the tone. What would you like to improve?"
  }

  /**
   * Community chatbot for finding top K candidates
   * Mock implementation - would use OpenAI embeddings + vector similarity in production
   */
  static async findTopCandidates(query: string, candidates: any[], k = 3): Promise<any[]> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock implementation - in production, this would:
    // 1. Generate embeddings for the query using OpenAI
    // 2. Compare with stored candidate embeddings using cosine similarity
    // 3. Return top K matches with similarity scores

    // For now, return mock results
    return candidates.slice(0, k).map((candidate, index) => ({
      ...candidate,
      matchScore: 95 - index * 7,
      matchReason: `Strong match based on ${query}`,
    }))
  }

  /**
   * Individual candidate chatbot
   * Mock implementation - would use OpenAI with candidate context in production
   */
  static async chatAboutCandidate(candidateData: any, question: string): Promise<string> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const lowerQuestion = question.toLowerCase()

    if (lowerQuestion.includes("experience") || lowerQuestion.includes("background")) {
      return `Based on their profile, this candidate has ${candidateData.student_skills || "relevant technical skills"}. Their cover letter demonstrates strong communication skills and genuine interest in the role.`
    }

    if (lowerQuestion.includes("fit") || lowerQuestion.includes("suitable")) {
      return `This candidate appears to be a good fit because they have the required technical skills and their cover letter shows they understand the role requirements. I'd recommend scheduling an interview to assess cultural fit.`
    }

    if (lowerQuestion.includes("strengths") || lowerQuestion.includes("strong")) {
      return `Key strengths include: technical proficiency, clear communication in their cover letter, and demonstrated interest in the position. They applied promptly, which shows enthusiasm.`
    }

    return `I can help you evaluate this candidate. You can ask about their experience, fit for the role, strengths, or any specific aspect of their application.`
  }
}
