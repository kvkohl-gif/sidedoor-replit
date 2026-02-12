// ============================================================
// SIDE DOOR — AI SYSTEM PROMPT TAXONOMY INJECTION
// ============================================================
// 
// PURPOSE: Inject this into system prompts for:
//   1. departmentRouter.ts (department inference)
//   2. openai.ts → extractApolloSearchParams() 
//   3. openai.ts → extractJobData()
//   4. personalizedMessaging.ts (to understand role context)
//
// HOW TO USE:
//   Import this as a string constant and append to your system prompts.
//   Example:
//     const systemPrompt = `${basePrompt}\n\n${ROLE_TAXONOMY_CONTEXT}`;
//
// This gives the LLM structured knowledge about how job titles map to
// departments, seniority levels, and who the likely hiring managers are.
// ============================================================

export const ROLE_TAXONOMY_CONTEXT = `
## ROLE & DEPARTMENT TAXONOMY — USE THIS FOR ALL CLASSIFICATION DECISIONS

### Department Mapping Rules
When classifying a job into a department, use these canonical departments and their associated title patterns. Match the job title against these patterns (case-insensitive). If multiple departments match, use the CROSS-FUNCTIONAL ROLES section below.

**CANONICAL DEPARTMENTS (12):**

1. **Engineering** — Software Engineer, Frontend/Backend/Full-Stack Developer, SRE, DevOps, Platform Engineer, Infrastructure, Mobile, QA, SDET, Security Engineer, ML Engineer, AI Engineer, Data Engineer, Solutions Architect, Tech Lead, Engineering Manager, CTO
2. **Product** — Product Manager, Product Owner, Technical PM, Group PM, Director/VP/Head of Product, CPO
3. **Design** — Product Designer, UX/UI Designer, Interaction Designer, Visual Designer, Brand Designer, UX Researcher, Creative Director, Design Technologist
4. **Data Science & Analytics** — Data Scientist, Data Analyst, Business Analyst, BI Analyst/Engineer, Analytics Engineer, Quantitative Analyst, Research Scientist, Applied Scientist, Decision Scientist
5. **Marketing** — Marketing Manager, Digital/Growth/Performance Marketing, Demand Gen, Content Marketing/Strategist, Brand, Communications, PR, Social Media, Product Marketing (PMM), SEO/SEM, Paid Media, Field/Event Marketing, CMO
6. **Sales** — Account Executive, SDR, BDR, Account Manager, Enterprise Sales, Inside/Outside/Field Sales, Sales Manager/Director, CRO, Business Development, Partnerships, Channel Sales, Sales Operations, Sales Enablement, RevOps, Presales
7. **Customer Success & Support** — CSM, Customer Experience, Support Engineer, Technical Support, Implementation Manager, Onboarding, Solutions Consultant, Professional Services, Client Partner
8. **Operations** — Operations Manager/Analyst, BizOps, Strategy & Ops, Program Manager, Project Manager, Chief of Staff, Supply Chain, Logistics, Procurement, COO
9. **Finance & Accounting** — Financial Analyst, FP&A, Accountant, Controller, Tax, Audit, Treasury, Billing, Payroll, CFO
10. **Human Resources & People** — HR Manager/Generalist/BP, People Ops, Talent Management, L&D, Compensation & Benefits, DEI, Employee Relations, CHRO
11. **Legal & Compliance** — General Counsel, Corporate Counsel, Paralegal, Compliance Manager/Officer, Privacy, Contracts, Regulatory Affairs
12. **Construction & Real Estate** — Construction/Site Manager, Superintendent, Estimator, Project Engineer, Safety/HSE, Property Manager, Asset Manager, Development Manager, Real Estate Analyst, Broker

### Cross-Functional Role Resolution
These roles span two departments. Search BOTH departments for hiring managers:

| Role Pattern | Primary Dept | Secondary Dept | Search Both? |
|---|---|---|---|
| Sales Engineer / Solutions Engineer | Sales | Engineering | YES |
| Technical Product Manager | Product | Engineering | YES |
| Product Marketing Manager (PMM) | Marketing | Product | YES |
| Data Engineer / Analytics Engineer | Engineering | Data Science | YES |
| DevOps / SRE / Platform Engineer | Engineering | Operations | NO (Engineering only) |
| UX Researcher | Design | Product | NO (Design only) |
| Revenue Operations / RevOps | Operations | Sales | YES |
| Implementation / Professional Services | Customer Success | Operations | NO (CS only) |

### Seniority Detection
Extract seniority from the job title using these patterns (ordered from lowest to highest):

| Level | Title Signals | Apollo Seniority |
|---|---|---|
| Intern (0) | intern, co-op, apprentice, trainee | entry |
| Junior (1) | junior, entry-level, associate, I, L1 | entry |
| Mid (2) | mid-level, intermediate, II, L2 | senior |
| Senior (3) | senior, sr., III, L3, lead | senior |
| Staff (4) | staff, principal, IV, L4, distinguished | manager |
| Manager (5) | manager, team lead, supervisor | manager |
| Senior Manager (6) | senior manager, head of, group manager | director |
| Director (7) | director, senior director, executive director | director |
| VP (8) | vp, vice president, svp, evp | vp |
| C-Suite (9) | chief, CTO, CFO, CMO, COO, CEO, founder | c_suite |

### Hiring Manager Target Rules
Given the role's department and seniority, find contacts at the NEXT level up:

- **IC Junior/Mid** → Search for Managers and Senior Managers in that department
- **IC Senior/Staff** → Search for Directors and VPs in that department
- **Manager level** → Search for Directors and VPs
- **Director level** → Search for VPs and C-Suite
- **VP level** → Search for C-Suite

NEVER target people at the SAME level as the role being searched — they are peers, not hiring managers.

### Industry Context Adjustments
If the company operates in a specific industry, adjust title expectations:
- **Healthcare/Biotech**: "Project Manager" → likely "Clinical Project Manager"; "Data Analyst" → could be "Biostatistician"
- **Fintech/Banking**: Additional departments like Risk, Underwriting; "Data Analyst" → could be "Risk Analyst"
- **E-commerce/Retail**: Marketing roles skew toward "Growth Marketing"; additional departments like Merchandising, Fulfillment
- **SaaS/B2B**: Sales roles often specified as "Enterprise"; Support roles often "Technical Support Engineer"

### Key Classification Rules
1. When the job title exactly matches a pattern, use that department with HIGH confidence
2. When the job description mentions responsibilities from multiple departments, classify by the PRIMARY function (what will this person spend >50% of their time doing?)
3. "Manager" in a title doesn't always mean people management — "Product Manager" is IC, "Engineering Manager" manages people. Use context.
4. If the role is at a startup (<200 employees based on company context), the hiring manager is likely 1-2 levels above. At large companies (1000+), expect 1 level above.
5. Remote roles: include geographic targeting for the company HQ country + common remote-hiring countries (US, Canada, UK, EU)
`;

// ============================================================
// USAGE EXAMPLES
// ============================================================
//
// In departmentRouter.ts:
// -----------------------
// const systemPrompt = `You are a job classification expert. 
// Given a job description, determine the primary department, 
// seniority level, and ideal hiring manager titles to search for.
// 
// ${ROLE_TAXONOMY_CONTEXT}
// 
// Return JSON with: primaryDepartment, secondaryDepartment (if cross-functional),
// seniorityLevel, targetHiringManagerTitles[], apolloSearchDepartments[]`;
//
//
// In openai.ts → extractApolloSearchParams():
// --------------------------------------------
// Append ROLE_TAXONOMY_CONTEXT to the existing system prompt so the model
// knows exactly which department codes to return and which seniority
// levels map to which Apollo API parameters.
//
//
// In openai.ts → extractJobData():
// ---------------------------------
// Append a condensed version to help the model identify the correct
// department and likely reporting structure from the raw job description.
//
// ============================================================
