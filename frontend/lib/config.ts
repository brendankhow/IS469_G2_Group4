/**
 * Centralized Configuration
 * Change these values to switch between development and production
 */

// Environment variables
export const config = {
  // Supabase Configuration
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  // Application URLs
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    
    // Use this to easily switch between environments
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },

  // API Configuration
  api: {
    // Add any API-specific configs here
    timeout: 30000, // 30 seconds
  },

  // Storage Configuration
  storage: {
    resumeBucket: 'resumes',
    maxFileSize: 5 * 1024 * 1024, // 5MB in bytes
    allowedMimeTypes: ['application/pdf'],
  },

  // Authentication
  auth: {
    redirects: {
      afterLogin: {
        student: '/student/dashboard',
        recruiter: '/recruiter/dashboard',
      },
      afterLogout: '/login',
    },
  },
} as const

// Helper functions
export const getAppUrl = () => config.app.url
export const getSupabaseConfig = () => config.supabase
export const isDevelopment = () => config.app.isDevelopment
export const isProduction = () => config.app.isProduction

// URL helpers
export const urls = {
  home: '/',
  login: '/login',
  signup: '/signup',
  student: {
    dashboard: '/student/dashboard',
    applications: '/student/applications',
    profile: '/student/profile',
    coverLetters: '/student/cover-letters',
  },
  recruiter: {
    dashboard: '/recruiter/dashboard',
    jobs: '/recruiter/jobs',
    postJob: '/recruiter/post-job',
    applicants: '/recruiter/applicants',
  },
  api: {
    auth: {
      login: '/api/auth/login',
      signup: '/api/auth/signup',
      logout: '/api/auth/logout',
      me: '/api/auth/me',
    },
    jobs: '/api/jobs',
    applications: '/api/applications',
  },
} as const

export default config
