# Recruiter Contact Finder

## Overview
Recruiter Contact Finder is a full-stack web application designed to help users identify recruiter contact information from job postings and generate personalized outreach messages. It leverages OpenAI's API for extracting recruiter details, enriches this data through third-party services like Apollo.io and NeverBounce, and stores it for user management. The project aims to streamline the job application process by providing direct access to hiring contacts, enhancing outreach effectiveness, and maintaining a robust contact management system.

## Recent Changes (November 20, 2025)
*   **Supabase Migration (COMPLETE - 100%)**: Successfully completed full migration from Drizzle/Neon to Supabase PostgreSQL:
    *   **All Routes Migrated**: All 20+ backend routes now use Supabase exclusively
    *   **Job Submission Routes**: POST, GET, GET/:id, PATCH, /job-data, /email-patterns, /supplemental-emails
    *   **Contact Routes**: GET /api/contacts/all, PATCH /api/contacts/:id, POST /api/contacts/:id/generate-message
    *   **Message Template Routes**: POST/GET /api/recruiters/:recruiterId/messages, PATCH /api/messages/:id, POST /api/recruiters/:recruiterId/generate-messages
    *   **User Auth Routes**: GET /api/auth/user with Supabase user upsert in replitAuth.ts
    *   **Supplemental Email Service**: Complete migration to Supabase for pattern-inferred email generation (supplementalEmailService.ts)
    *   **Field Mapping**: Complete camelCase→snake_case mapping for all 30+ fields across job_submissions, recruiter_contacts, message_templates, email_pattern_analysis, contact_emails_supplemental, and company_email_patterns tables
    *   **Business Logic Preserved**: OpenAI GPT-4o extraction, Apollo.io enrichment, NeverBounce verification, geographic filtering, email pattern inference, and personalized message generation all function identically
    *   **Files Modified**: backend/routes.ts, backend/routes/contacts.ts, backend/replitAuth.ts, backend/supplementalEmailService.ts
    *   **Cleanup**: Removed all Drizzle DB access (backed up db.ts and storage.ts), removed Drizzle imports from all active code
    *   **No Mixed Storage**: Zero Drizzle usage remaining - 100% Supabase with proper join queries for ownership verification
    *   **Documentation**: Comprehensive migration details in backend/SUPABASE_MIGRATION_LOG.md

## Recent Changes (November 19, 2025)
*   **Frontend Migration Complete**: Successfully integrated Figma-exported UI components as the new frontend, replacing the previous React implementation.
*   **Directory Restructure**: Reorganized project with `/backend` and `/frontend` directories; maintained compatibility symlinks (`server→backend`, `client→frontend`) due to immutable vite.config.ts.
*   **API Integration**: Fully wired all 6 Figma components to existing backend APIs using React Query:
    *   SearchPage: POST /api/submissions for job searches, navigates to JobDetails with new submission ID
    *   JobHistory: GET /api/submissions for submission history with status management
    *   JobDetails: GET /api/submissions/:id for detailed view, PATCH /api/submissions/:id/status for status updates
    *   AllContacts: GET /api/contacts/all for contact listing
    *   ContactDetail: GET /api/contacts/:id, PATCH /api/contacts/:id for updates, POST /api/contacts/:id/generate-message for message generation
    *   Dashboard: Real-time metrics from submissions and contacts endpoints
*   **Navigation System**: Centralized navigation state in App.tsx passing params (submissionId, contactId) between components for proper data-dependent routing.
*   **Build System**: Frontend builds successfully with Vite, zero TypeScript errors, production-ready output (323KB bundle).
*   **Type Safety**: All components properly typed with interfaces matching backend schema; handled null vs undefined type differences.
*   **Loading States**: Implemented loading spinners and disabled states for all async operations (queries and mutations).
*   **Cache Management**: Proper cache invalidation after mutations to keep UI in sync with backend state.
*   **Architect Approved**: Final review confirmed all API integrations work correctly and navigation flows are complete.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application adopts a monorepo structure, comprising a React frontend, an Express.js backend, and a PostgreSQL database. Authentication is handled via Replit's OpenID Connect.

### Key Architectural Decisions:
*   **Monorepo Structure**: Facilitates co-development and shared type management between frontend and backend.
*   **Type Safety**: Utilizes TypeScript across the stack for improved code quality and maintainability.
*   **Database**: Fully migrated to Supabase PostgreSQL for serverless capabilities and built-in features. 
    *   **Migration Status**: COMPLETE - All routes migrated to Supabase (20+ routes covering all functionality)
    *   **Data Layer**: Supabase client configured with both regular and admin access for service-level operations
    *   **Legacy Code**: Drizzle ORM code removed from active use (backed up as .backup files)
*   **Authentication**: Integrated with Replit's OpenID Connect for secure user authentication and session management (not using Supabase auth).
*   **UI/UX**: Employs Shadcn/ui and Radix UI with Tailwind CSS for a modern, consistent, and accessible user interface. Components are designed for compactness and clarity, including consistent header structures and a collapsible sidebar.
*   **AI Integration**: OpenAI GPT-4o is central to extracting initial recruiter data and generating outreach parameters.
*   **Contact Enrichment**: A multi-stage process involving:
    *   Initial extraction via OpenAI.
    *   Professional contact and email discovery using Apollo.io, including advanced title and geographic filtering.
    *   Email verification via NeverBounce, with status badges in the UI.
    *   Prioritization of specific recruiter names extracted from job descriptions.
    *   Inference of email patterns when direct verification is not possible.
*   **Web Scraping**: Utilizes Puppeteer with stealth technology for robust and resilient job board data extraction, supporting various common job board frameworks and employing smart request interception.
*   **Data Flow**: User authentication via Replit OAuth, job submission through the frontend, AI processing and contact enrichment on the backend, data storage in PostgreSQL, and display of verified results on the frontend. Input fields are locked during analysis to prevent data inconsistencies.

### Technical Implementations:
*   **Frontend**: React 18, Vite, Shadcn/ui, Radix UI, Tailwind CSS, TanStack Query for server state, Wouter for routing, React Hook Form with Zod for form validation.
*   **Backend**: Express.js, Supabase PostgreSQL, Passport.js (OpenID Connect strategy), Express sessions, OpenAI API.
*   **Database Schema**: Includes `users`, `sessions`, `job_submissions`, and `recruiter_contacts` tables, with detailed fields for contact verification status, source, and Apollo ID tracking.
*   **Deployment**: Optimized for Replit environment, using Vite for frontend builds and esbuild for backend bundling, with environment variables for external service configuration.

### Feature Specifications:
*   **Recruiter Contact Extraction**: Extracts recruiter details from job descriptions/URLs.
*   **Personalized Outreach**: Generates tailored outreach messages based on extracted data.
*   **Email Verification**: Provides real-time email verification status (valid, risky, invalid) for discovered contacts.
*   **Geographic Filtering**: Prioritizes recruiters based on job location and company headquarters.
*   **Structured Job Data Extraction**: Standardized extraction of job title, company, URL, description, and key responsibilities.
*   **UI Consistency**: Consistent header, navigation, and card layouts across the application for a unified user experience.
*   **Collapsible Sidebar**: Dynamic, responsive sidebar with state persistence for improved navigation.

## External Dependencies

### Core Dependencies
*   **@supabase/supabase-js**: Supabase PostgreSQL client (primary database - all routes)
*   **@neondatabase/serverless**: PostgreSQL database connection (legacy, no longer used)
*   **drizzle-orm**: Type-safe database ORM (legacy, no longer used in active code)
*   **openai**: OpenAI API client for GPT-4o
*   **passport**: Authentication middleware
*   **express-session**: Session management
*   **puppeteer-extra**: Advanced web scraping with stealth capabilities
*   **apollo-client**: Integration for Apollo.io API
*   **neverbounce-js**: Integration for NeverBounce email verification

### UI Dependencies
*   **@radix-ui/***: Headless UI components
*   **@tanstack/react-query**: Server state management
*   **tailwindcss**: Utility-first CSS framework
*   **wouter**: Lightweight React router
*   **shadcn/ui**: UI component library

### Development Tools
*   **vite**: Frontend build tool and dev server
*   **typescript**: Type safety across the stack
*   **drizzle-kit**: Database migration tool (legacy, no longer used)
```