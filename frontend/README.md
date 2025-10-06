# HireAI Platform

A full-stack AI-powered job application platform built with Next.js, featuring automated cover letter generation, intelligent candidate matching, and streamlined recruitment workflows.

## Features

### For Students
- Browse available job postings
- Select up to 5 jobs for batch application
- AI-powered cover letter generation
- Interactive AI chatbot for cover letter refinement
- Application tracking dashboard
- Profile management with resume upload

### For Recruiters
- Post and manage job listings
- View and manage applicants
- Accept/reject applications with automated notifications
- Bulk rejection with one click
- AI-powered candidate matching (community chatbot)
- Individual candidate analysis chatbot
- Interview scheduling

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: JSON file storage (development/simulation)
- **Authentication**: JWT with auto-generated secret
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **AI**: Mock implementations (ready for OpenAI integration)
- **Email**: Disabled (console logging only)

## Getting Started

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Open [http://localhost:3000](http://localhost:3000)

### Database Setup

The JSON file storage is automatically initialized on first run. Sample data is pre-seeded for testing:

**Test Accounts:**
- Student: `student@test.com` / `password123`
- Recruiter: `recruiter@test.com` / `password123`

All data is stored in the `/data` directory as JSON files:
- `users.json` - User accounts
- `jobs.json` - Job postings
- `applications.json` - Job applications

### AI Integration (Future)

Currently using mock implementations. To integrate real AI:

1. Add OpenAI API key to environment variables
2. Update `lib/ai-service.ts` to use OpenAI SDK:
   - Cover letter generation: GPT-4
   - Chatbot: GPT-4 with conversation history
   - Candidate matching: Embeddings + vector similarity

## Project Structure

\`\`\`
├── app/
│   ├── api/              # API routes
│   ├── student/          # Student dashboard pages
│   ├── recruiter/        # Recruiter dashboard pages
│   └── (auth)/           # Authentication pages
├── components/           # React components
├── data/                 # JSON data storage
│   ├── users.json
│   ├── jobs.json
│   └── applications.json
├── lib/
│   ├── models/          # Data models
│   ├── ai-service.ts    # AI mock implementations
│   ├── email-service.ts # Email service (disabled)
│   └── auth.ts          # Authentication utilities
└── scripts/             # Utility scripts
\`\`\`

## Features in Detail

### AI-Powered Cover Letters
Students can select multiple jobs and generate personalized cover letters using AI. The system considers:
- Job title and description
- Job requirements
- Student skills and hobbies
- Professional tone and structure

### Intelligent Candidate Matching
Recruiters can use the community chatbot to find top candidates based on:
- Semantic similarity (embeddings)
- Skills matching
- Experience relevance

### Automated Notifications
Email notifications are currently disabled and logged to console. When applications are accepted or rejected, you'll see the notification content in the server logs.

## Development

### Adding New Features

1. **Data Models**: Update models in `lib/models/`
2. **API Routes**: Add routes in `app/api/`
3. **UI Components**: Create components in `components/`
4. **Pages**: Add pages in `app/student/` or `app/recruiter/`

### Testing

Test accounts are automatically available:
- Navigate to `/login`
- Use test credentials above
- Explore both student and recruiter workflows

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Deploy

**Note**: JSON file storage is for development only. For production, integrate a real database like PostgreSQL (Neon, Supabase), MongoDB, or MySQL.

## Migration to Production Database

When ready for production, replace the JSON storage with a real database:

1. Choose a database (PostgreSQL, MongoDB, etc.)
2. Update `lib/db.ts` with database connection
3. Update models in `lib/models/` to use database queries
4. Migrate data from JSON files to database
5. Update API routes if needed

## License

MIT
\`\`\`

```typescriptreact file="lib/init-db.ts" isDeleted="true"
...deleted...
