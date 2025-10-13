# HireAI Platform

A full-stack AI-powered job application platform built with Next.js## 📁 Project Structureand Supabase, featuring automated cover letter generation, intelligent candidate matching, and streamlined recruitment workflows.

## 📋 Prerequisites

- **Node.js**: Version 20.0.0 or higher (required for @supabase/supabase-js)
- **npm**: Version 10.0.0 or higher

> ⚠️ **Important**: Node.js 18 and below are deprecated for Supabase. Please upgrade to Node.js 20 or later.

## 🌟 Features

### For Students
- Browse available job postings
- Select up to 5 jobs for batch application
- AI-powered cover letter generation
- Interactive AI chatbot for cover letter refinement
- Upload PDF resumes with secure storage
- Application tracking dashboard
- Profile management

### For Recruiters
- Post and manage job listings
- View and manage applicants
- Download applicant resumes (PDF)
- Accept/reject applications with automated notifications
- Bulk rejection with one click
- AI-powered candidate matching
- Individual candidate analysis chatbot

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth (JWT-based)
- **File Storage**: Supabase Storage (PDF resumes)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **AI**: Mock implementations (ready for OpenAI integration)
- **Type Safety**: TypeScript with strict mode

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (Node.js 20+ recommended)
- npm package manager
- Supabase project (already configured)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   
   # Application URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
   
   > **Note**: Change `NEXT_PUBLIC_APP_URL` to your production URL when deploying

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   
   Visit [http://localhost:3000](http://localhost:3000)

## � Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── ai/                 # AI-powered features
│   │   ├── applications/       # Application management
│   │   ├── auth/               # Authentication endpoints
│   │   ├── jobs/               # Job management
│   │   ├── recruiter/          # Recruiter-specific endpoints
│   │   └── simple-login/       # Simple login endpoint
│   ├── login/                  # Login page
│   ├── recruiter/              # Recruiter dashboard pages
│   │   ├── applicants/         # All applicants view
│   │   ├── dashboard/          # Recruiter dashboard
│   │   ├── jobs/               # Job-specific pages
│   │   ├── login/              # Recruiter login
│   │   ├── post-job/           # Job posting page
│   │   └── profile/            # Recruiter profile
│   ├── signup/                 # Signup page
│   └── student/                # Student dashboard pages
│       ├── applications/       # Application tracking
│       ├── cover-letters/      # Cover letter generation
│       ├── dashboard/          # Student dashboard
│       ├── login/              # Student login
│       └── profile/            # Student profile
├── components/                 # React components
│   ├── recruiter-sidebar.tsx   # Recruiter navigation
│   ├── student-sidebar.tsx     # Student navigation
│   ├── theme-provider.tsx      # Theme provider
│   └── ui/                     # shadcn/ui components
├── data/                       # Static data files
│   ├── applications.json
│   ├── jobs.json
│   └── users.json
├── hooks/                      # Custom React hooks
│   ├── use-mobile.ts
│   └── use-toast.ts
├── lib/                        # Business logic and utilities
│   ├── ai-service.ts           # AI mock implementations
│   ├── auth.ts                 # Authentication utilities
│   ├── config.ts               # App configuration
│   ├── db.ts                   # Database utilities
│   ├── email-service.ts        # Email service
│   ├── models/                 # Data models
│   ├── services/               # Business logic services
│   │   ├── applications.service.ts
│   │   ├── auth.service.ts
│   │   ├── jobs.service.ts
│   │   └── storage.service.ts
│   ├── supabase/               # Supabase client utilities
│   ├── types/                  # TypeScript definitions
│   └── utils.ts                # Utility functions
├── public/                     # Static assets
│   ├── mock-cover-letters/     # Mock cover letter templates
│   └── placeholder-*.png/svg   # Placeholder images
└── styles/
    └── globals.css             # Global styles
```

## 🔐 Configuration

### Environment Variables

All configuration is centralized in `lib/config.ts`. To switch between development and production:

1. **Development**: Uses `http://localhost:3000`
2. **Production**: Update `NEXT_PUBLIC_APP_URL` in `.env.local`

The config file automatically handles:
- Supabase connection
- API endpoints
- Storage settings
- Authentication redirects

### Changing URLs

Update `NEXT_PUBLIC_APP_URL` in your `.env.local`:
```env
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

All URLs throughout the app will automatically use the configured value.

## 🧪 Testing

### Create Test Accounts

1. **Student Account**
   - Go to `/signup`
   - Email: `student@test.com`
   - Password: `password123`
   - Role: Student
   - Add skills (e.g., "React, TypeScript, Node.js")

2. **Recruiter Account**
   - Go to `/signup`
   - Email: `recruiter@test.com`
   - Password: `password123`
   - Role: Recruiter

### Test Workflows

**Student Flow:**
1. Login as student
2. Browse jobs on dashboard
3. Apply to a job with PDF resume
4. Write/generate cover letter
5. Track application status

**Recruiter Flow:**
1. Login as recruiter
2. Post a new job
3. View applicants
4. Download resumes
5. Accept/reject applications

## 🔒 Security Features

- **Row Level Security (RLS)**: Database-level access control
- **JWT Authentication**: Secure session management
- **Private File Storage**: Resumes accessible only to authorized users
- **CSRF Protection**: Built into Next.js
- **Environment Variables**: Sensitive keys never exposed to client

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (your production URL)
4. Deploy

### Other Platforms

The app works on any platform supporting Next.js:
- Netlify
- AWS Amplify
- Railway
- Render

## 🤖 AI Integration (Future)

Currently using mock implementations. To integrate real AI:

1. Install OpenAI SDK:
   ```bash
   npm install openai
   ```

2. Add API key to `.env.local`:
   ```env
   OPENAI_API_KEY=your-api-key
   ```

3. Update `lib/ai-service.ts`:
   - Cover letter generation: GPT-4
   - Chatbot: GPT-4 with conversation history
   - Candidate matching: Embeddings + vector similarity

## 🐛 Troubleshooting

### Build Errors

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Authentication Issues

- Clear browser cookies
- Check environment variables
- Verify Supabase project is active

### File Upload Fails

- Ensure file is PDF and under 5MB
- Check storage bucket exists
- Verify storage policies are applied

##  License

MIT

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines before submitting PRs.

## 📞 Support

For issues or questions:
- Check Supabase dashboard logs
- Check browser console for client errors

---

Built with ❤️ using Next.js and Supabase
