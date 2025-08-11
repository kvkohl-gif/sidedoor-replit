# Recruiter Contact Finder

## Overview
Recruiter Contact Finder is a full-stack web application designed to help users identify recruiter contact information from job postings and generate personalized outreach messages. It leverages OpenAI's API for extracting recruiter details, enriches this data through third-party services like Apollo.io and NeverBounce, and stores it for user management. The project aims to streamline the job application process by providing direct access to hiring contacts, enhancing outreach effectiveness, and maintaining a robust contact management system.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application adopts a monorepo structure, comprising a React frontend, an Express.js backend, and a PostgreSQL database. Authentication is handled via Replit's OpenID Connect.

### Key Architectural Decisions:
*   **Monorepo Structure**: Facilitates co-development and shared type management between frontend and backend.
*   **Type Safety**: Utilizes TypeScript across the stack for improved code quality and maintainability.
*   **Database**: PostgreSQL with Drizzle ORM for type-safe and efficient data management, hosted on Neon for serverless capabilities.
*   **Authentication**: Integrated with Replit's OpenID Connect for secure user authentication and session management.
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
*   **Backend**: Express.js, Drizzle ORM, Passport.js (OpenID Connect strategy), Express sessions, OpenAI API.
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
*   **@neondatabase/serverless**: PostgreSQL database connection
*   **drizzle-orm**: Type-safe database ORM
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
*   **drizzle-kit**: Database migration tool
```