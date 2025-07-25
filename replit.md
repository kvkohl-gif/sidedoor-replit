# Recruiter Contact Finder

## Overview

This is a full-stack web application that helps users find recruiter contact information from job postings. Users can paste job descriptions or URLs, and the app uses OpenAI's API to extract recruiter details and generate personalized outreach messages. Built with React frontend, Express backend, PostgreSQL database, and OpenAI integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a monorepo structure with three main components:
- **Frontend**: React SPA with TypeScript, using Vite for development
- **Backend**: Express.js REST API with TypeScript 
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit's OpenID Connect integration

### Directory Structure
```
├── client/          # React frontend
├── server/          # Express backend  
├── shared/          # Shared types and schemas
├── migrations/      # Database migrations
└── attached_assets/ # Requirements document
```

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: Drizzle ORM with PostgreSQL (Neon serverless)
- **Authentication**: Passport.js with OpenID Connect strategy
- **Session Management**: Express sessions with PostgreSQL store
- **API Integration**: OpenAI GPT-4o for recruiter extraction

### Data Storage
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle with type-safe schema definitions
- **Session Storage**: PostgreSQL table for user sessions
- **Migration System**: Drizzle Kit for schema management

## Data Flow

1. **User Authentication**: Replit OAuth flow with session persistence
2. **Job Submission**: User submits job description/URL through React form
3. **AI Processing**: Backend calls OpenAI API to extract recruiter information
4. **Contact Enrichment**: Enhanced recruiter contact verification and email validation
5. **Data Storage**: Results stored in PostgreSQL with user association and verification status
6. **Result Display**: Frontend fetches and displays extracted data with verification badges

### Database Schema
- `users`: User profiles from Replit OAuth
- `sessions`: Session management for authentication
- `job_submissions`: Job posts with AI-extracted data
- `recruiter_contacts`: Individual recruiter contact details with verification status

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database ORM
- **openai**: OpenAI API client for GPT-4o
- **passport**: Authentication middleware
- **express-session**: Session management

### UI Dependencies
- **@radix-ui/***: Headless UI components
- **@tanstack/react-query**: Server state management
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight React router

### Development Tools
- **vite**: Frontend build tool and dev server
- **typescript**: Type safety across the stack
- **drizzle-kit**: Database migration tool

## Authentication and Authorization

The app uses Replit's built-in authentication system:
- **Provider**: OpenID Connect through Replit
- **Session Management**: PostgreSQL-backed sessions
- **Authorization**: Route-level protection requiring authentication
- **User Data**: Stored in users table with Replit user ID as primary key

## Deployment Strategy

- **Environment**: Designed for Replit deployment
- **Build Process**: Vite builds frontend, esbuild bundles backend
- **Database**: Neon PostgreSQL with connection pooling
- **Environment Variables**: DATABASE_URL, OPENAI_API_KEY, SESSION_SECRET
- **Development**: Hot reloading with Vite dev server proxy

The application expects to run in Replit's environment with their authentication system and uses environment variables for external service configuration.

## Enhanced Email Verification Features

The application now includes post-OpenAI contact enrichment and email verification capabilities:

### Contact Enrichment Process
1. **OpenAI Extraction**: Initial recruiter contact extraction from job descriptions
2. **Email Discovery**: Attempts to find verified emails using third-party services:
   - Apollo.io API integration (placeholder)
   - Hunter.io API integration (placeholder)
   - Clay platform support (placeholder)
3. **Email Verification**: Validates discovered emails using:
   - ZeroBounce API integration (placeholder)
   - Mailboxlayer verification (placeholder)
   - Basic format validation as fallback
4. **Contact Filtering**: Only saves contacts with verified email or LinkedIn URL

### Database Enhancements
- `emailVerified`: Boolean flag for email verification status
- `verificationStatus`: Email status (valid, risky, invalid, unknown)
- `sourcePlatform`: Contact source (openai, apollo, zoominfo, clay, hunter)

### UI Features
- Verification status badges on contact cards
- Email verification indicators (Verified, Risky, Invalid, Unverified)
- LinkedIn fallback message when no verified email found
- Copy-to-clipboard functionality for contact details

### API Integration Ready
The enrichment service is structured to easily integrate with:
- Apollo.io for professional contact discovery
- Hunter.io for email finding and verification
- ZeroBounce/Mailboxlayer for email validation
- Clay for LinkedIn-based enrichment

### Current Implementation
- Apollo.io API integration for professional contact search with optimized search parameters
- **NEW: Advanced title filtering with predefined recruiter titles** - Uses Apollo's `person_titles` parameter with 21 specific recruiter roles
- NeverBounce email verification with status badges (✅ Valid, ⚠️ Risky, ❌ Invalid)
- Modular apolloService.ts and verifierService.ts architecture
- Enhanced OpenAI prompt for extracting accurate Apollo search parameters
- **CRITICAL FIX (Jan 2025)**: Removed fake recruiter generation from OpenAI - Apollo is now sole source of contact data
- Workflow: OpenAI parameter extraction → Apollo recruiter search (with title filters) → NeverBounce verification → Database storage
- **Enhanced confidence scoring**: Exact title matches (100% for "recruiter") + partial keyword matching (85-90% for "talent acquisition")
- Three-tier search strategy: 1) Title-filtered search 2) Non-filtered search with client-side filtering 3) Broader fallback
- Full UI support for verification status display with icons and detailed tooltips
- Database schema with Apollo ID tracking and verification data storage
- Message editing with AI-powered tone improvement (Confident, Concise, Friendly, Professional, Personalized)
- **NEW: Geographic filtering system (Jan 2025)**: Apollo search now prioritizes recruiters by location hierarchy:
  1. Job country (highest priority)
  2. Job region/state if available  
  3. Remote hiring countries (for remote jobs)
  4. Company HQ country
  5. English-speaking regions fallback (US, Canada, UK, Australia)
- **NEW: Enhanced recruiter name extraction**: Extracts specific recruiter names from job descriptions and prioritizes them in Apollo search
- **NEW: Email pattern inference**: When Apollo doesn't have verified emails, system analyzes company email patterns and generates likely email addresses with verification
- **NEW: Standardized job information extraction (Jan 2025)**: Implements structured job data format with required fields:
  * Job Title, Company, Job URL, Company Website, Location
  * Job Description (3-5 sentence summary)
  * Key Responsibilities and Requirements (bullet points)
  * Likely Departments (from predefined list)
  * All fields default to "Not specified" if missing
  * Enhanced UI with JobDetailCard component for consistent display