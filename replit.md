# Recruiter Contact Finder

## Overview
Recruiter Contact Finder is a full-stack web application designed to help users identify recruiter contact information from job postings and generate personalized outreach messages. It aims to streamline the job application process by providing direct access to hiring contacts, enhancing outreach effectiveness, and maintaining a robust contact management system. The project leverages OpenAI's API for extracting recruiter details, enriches this data through third-party services, and stores it for user management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application adopts a monorepo structure, comprising a React frontend, an Express.js backend, and a PostgreSQL database.

### Key Architectural Decisions:
*   **Monorepo Structure**: Facilitates co-development and shared type management between frontend and backend.
*   **Type Safety**: Utilizes TypeScript across the stack for improved code quality and maintainability.
*   **Database**: Fully migrated to Supabase PostgreSQL for serverless capabilities and built-in features, with all backend routes using Supabase exclusively.
*   **Authentication**: Custom server-side session-based authentication using Express backend and a Supabase sessions table. This involves bcrypt password hashing, HttpOnly, Secure, and SameSite=strict cookies for session management, and global middleware for session validation and authorization.
*   **UI/UX**: Employs Shadcn/ui and Radix UI with Tailwind CSS for a modern, consistent, and accessible user interface, featuring consistent header structures, card layouts, and a collapsible sidebar.
*   **AI Integration**: OpenAI GPT-4o is central to extracting initial recruiter data, generating outreach parameters, and classifying job roles using a pre-configured taxonomy system for improved accuracy.
*   **Contact Enrichment**: A multi-stage process involving initial extraction via OpenAI, professional contact and email discovery using Apollo.io with advanced title and geographic filtering, and email verification via NeverBounce. The system also infers email patterns when direct verification is not possible and prioritizes recruiter names extracted from job descriptions.
*   **Web Scraping**: Utilizes Puppeteer with stealth technology for robust job board data extraction, supporting various common job board frameworks.
*   **Data Flow**: User authentication, job submission through the frontend, AI processing and contact enrichment on the backend, data storage in PostgreSQL, and display of verified results on the frontend. Input fields are locked during analysis to prevent data inconsistencies.

### Technical Implementations:
*   **Frontend**: React 18, Vite, Shadcn/ui, Radix UI, Tailwind CSS, TanStack Query for server state, Wouter for routing, React Hook Form with Zod for form validation.
*   **Backend**: Express.js, Supabase PostgreSQL, custom session-based authentication with bcrypt, cookie-parser, OpenAI API.
*   **Database Schema**: Includes `users`, `sessions`, `job_submissions`, and `recruiter_contacts` tables, tracking contact verification status, source, and Apollo ID.
*   **Deployment**: Optimized for Replit environment, using Vite for frontend builds and esbuild for backend bundling.

### Feature Specifications:
*   **Recruiter Contact Extraction**: Extracts recruiter details from job descriptions/URLs.
*   **Personalized Outreach**: Generates tailored outreach messages based on extracted data.
*   **Email Verification**: Provides real-time email verification status.
*   **Geographic Filtering**: Prioritizes recruiters based on job location and company headquarters.
*   **Structured Job Data Extraction**: Standardized extraction of job title, company, URL, description, and key responsibilities.
*   **UI Consistency**: Consistent header, navigation, and card layouts across the application.
*   **Collapsible Sidebar**: Dynamic, responsive sidebar with state persistence.

## External Dependencies

*   **@supabase/supabase-js**: Supabase PostgreSQL client
*   **openai**: OpenAI API client for GPT-4o
*   **bcryptjs**: Password hashing
*   **cookie-parser**: HTTP cookie parsing
*   **puppeteer-extra**: Advanced web scraping
*   **apollo-client**: Integration for Apollo.io API
*   **neverbounce-js**: Integration for NeverBounce email verification
*   **@radix-ui/***: Headless UI components
*   **@tanstack/react-query**: Server state management
*   **tailwindcss**: Utility-first CSS framework
*   **wouter**: Lightweight React router
*   **shadcn/ui**: UI component library