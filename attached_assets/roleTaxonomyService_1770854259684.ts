// ============================================================
// roleTaxonomyService.ts
// ============================================================
// Fast-lookup service for job title → department/seniority mapping.
// Use this BEFORE calling OpenAI for department inference.
// If a match is found, you can skip the AI call or use it to validate.
//
// INSTALLATION:
//   1. Place roleTaxonomy.json in backend/data/
//   2. Place this file in backend/
//   3. Import in departmentRouter.ts and enhancedEnrichmentService.ts
//
// USAGE:
//   import { lookupRole, detectSeniority, getHiringManagerTargets } from './roleTaxonomyService';
//   
//   const match = lookupRole("Senior Product Manager");
//   // → { department: "product", confidence: 0.95, seniority: "senior", ... }
//
//   const targets = getHiringManagerTargets("product", "senior");
//   // → { titles: ["VP of Product", "Head of Product", "CPO"], seniority: ["vp", "c_suite"] }
// ============================================================

import taxonomy from './data/roleTaxonomy.json';

// ---------- Types ----------

export interface RoleLookupResult {
  department: string;
  departmentLabel: string;
  confidence: number;             // 0-1, how well the title matched
  seniority: string;              // e.g., "senior", "manager", "director"
  seniorityLevel: number;         // numeric 0-9
  apolloSeniority: string;        // Apollo API seniority value
  apolloSearchDepartments: string[];
  isCrossFunctional: boolean;
  secondaryDepartment?: string;
  searchBothDepartments?: boolean;
  hiringManagerTitles: string[];
  hiringManagerSeniority: string[];
}

export interface SeniorityResult {
  seniority: string;
  level: number;
  apolloSeniority: string;
  confidence: number;
}

// ---------- Core Functions ----------

/**
 * Look up a job title against the taxonomy.
 * Returns null if no confident match found (fall back to AI).
 */
export function lookupRole(jobTitle: string): RoleLookupResult | null {
  const normalizedTitle = jobTitle.toLowerCase().trim();

  // 1. Check cross-functional roles first (they're more specific)
  const crossMatch = matchCrossFunctional(normalizedTitle);
  if (crossMatch) return crossMatch;

  // 2. Check standard departments
  const deptMatch = matchDepartment(normalizedTitle);
  if (deptMatch) return deptMatch;

  return null; // No match — fall back to OpenAI inference
}

/**
 * Detect seniority from a job title string.
 * Can be used independently of department matching.
 */
export function detectSeniority(jobTitle: string): SeniorityResult {
  const normalizedTitle = jobTitle.toLowerCase().trim();
  const levels = taxonomy.seniorityLevels;

  // Check from highest to lowest (C-suite first) to catch "Chief" before "Manager"
  const orderedKeys = Object.keys(levels).sort(
    (a, b) => (levels as any)[b].level - (levels as any)[a].level
  );

  for (const key of orderedKeys) {
    const level = (levels as any)[key];
    for (const pattern of level.patterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(normalizedTitle)) {
        return {
          seniority: key,
          level: level.level,
          apolloSeniority: level.apolloSeniority,
          confidence: 0.85
        };
      }
    }
  }

  // Default: assume mid-level if no seniority signals
  return {
    seniority: 'mid',
    level: 2,
    apolloSeniority: 'senior',
    confidence: 0.4
  };
}

/**
 * Given a department and seniority, return the ideal hiring manager targets.
 */
export function getHiringManagerTargets(
  departmentId: string,
  seniority: string
): { titles: string[]; seniority: string[] } | null {
  const dept = (taxonomy.departments as any)[departmentId];
  if (!dept) return null;

  const seniorityLevel = (taxonomy.seniorityLevels as any)[seniority]?.level ?? 2;
  const targets = dept.hiringManagerTargets;

  // Determine which target group to use based on seniority
  if (seniorityLevel <= 2) {
    // Junior/Mid IC
    return targets.ic_junior
      ? { titles: targets.ic_junior.targetTitles, seniority: targets.ic_junior.targetSeniority }
      : null;
  } else if (seniorityLevel <= 4) {
    // Senior/Staff IC
    return targets.ic_senior
      ? { titles: targets.ic_senior.targetTitles, seniority: targets.ic_senior.targetSeniority }
      : null;
  } else {
    // Manager and above
    return targets.manager
      ? { titles: targets.manager.targetTitles, seniority: targets.manager.targetSeniority }
      : null;
  }
}

/**
 * Get the full list of recruiter title variations for Apollo search.
 */
export function getRecruiterTitleVariations(): string[] {
  return taxonomy.recruiterTitleVariations;
}

/**
 * Detect if the company is in a specific industry based on keywords.
 * Returns industry key or null.
 */
export function detectIndustry(
  companyDescription: string,
  jobDescription: string
): string | null {
  const combined = `${companyDescription} ${jobDescription}`.toLowerCase();
  const industries = taxonomy.industrySpecificDepartments;

  for (const [key, industry] of Object.entries(industries)) {
    for (const keyword of (industry as any).keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        return key;
      }
    }
  }

  return null;
}

// ---------- Internal Helpers ----------

function matchCrossFunctional(normalizedTitle: string): RoleLookupResult | null {
  const crossRoles = taxonomy.crossFunctionalRoles;

  for (const [_key, role] of Object.entries(crossRoles)) {
    const r = role as any;
    for (const pattern of r.titlePatterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(normalizedTitle)) {
        const seniority = detectSeniority(normalizedTitle);
        const primaryDept = (taxonomy.departments as any)[r.primaryDepartment];
        const secondaryDept = (taxonomy.departments as any)[r.secondaryDepartment];

        // Merge Apollo search departments from both
        const apolloDepts = [
          ...(primaryDept?.apolloSearchDepartments || []),
          ...(r.searchBoth && secondaryDept ? secondaryDept.apolloSearchDepartments : [])
        ];

        return {
          department: r.primaryDepartment,
          departmentLabel: primaryDept?.label || r.primaryDepartment,
          confidence: 0.92,
          seniority: seniority.seniority,
          seniorityLevel: seniority.level,
          apolloSeniority: seniority.apolloSeniority,
          apolloSearchDepartments: [...new Set(apolloDepts)],
          isCrossFunctional: true,
          secondaryDepartment: r.secondaryDepartment,
          searchBothDepartments: r.searchBoth,
          hiringManagerTitles: r.hiringManagerTitles,
          hiringManagerSeniority: [] // Cross-functional uses explicit titles
        };
      }
    }
  }

  return null;
}

function matchDepartment(normalizedTitle: string): RoleLookupResult | null {
  const departments = taxonomy.departments;
  let bestMatch: RoleLookupResult | null = null;
  let bestConfidence = 0;

  for (const [deptId, dept] of Object.entries(departments)) {
    const d = dept as any;
    for (const pattern of d.titlePatterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(normalizedTitle)) {
        // Longer pattern matches = higher confidence
        const confidence = Math.min(0.95, 0.7 + (pattern.length / 60));

        if (confidence > bestConfidence) {
          const seniority = detectSeniority(normalizedTitle);
          const targets = getHiringManagerTargets(deptId, seniority.seniority);

          bestMatch = {
            department: deptId,
            departmentLabel: d.label,
            confidence,
            seniority: seniority.seniority,
            seniorityLevel: seniority.level,
            apolloSeniority: seniority.apolloSeniority,
            apolloSearchDepartments: d.apolloSearchDepartments,
            isCrossFunctional: false,
            hiringManagerTitles: targets?.titles || [],
            hiringManagerSeniority: targets?.seniority || []
          };
          bestConfidence = confidence;
        }
      }
    }
  }

  return bestMatch;
}

// ---------- Integration Helper ----------

/**
 * Main entry point for the pipeline.
 * Call this in enhancedEnrichmentService.ts before or alongside AI inference.
 * 
 * Returns taxonomy match if confident enough, otherwise null (use AI).
 * When AI is used, pass the result back through validateWithTaxonomy()
 * to catch obvious misclassifications.
 */
export function classifyJobRole(jobTitle: string, jobDescription?: string): {
  taxonomyMatch: RoleLookupResult | null;
  shouldUseAI: boolean;
  taxonomyContext: string; // Always pass this to AI even if taxonomy matched
} {
  const match = lookupRole(jobTitle);

  // If we got a high-confidence match, we can skip AI for department
  // but still pass taxonomy context for better search params
  if (match && match.confidence >= 0.85) {
    return {
      taxonomyMatch: match,
      shouldUseAI: false,
      taxonomyContext: buildTaxonomyContextForAI(match)
    };
  }

  // Low confidence or no match — let AI decide, but give it the taxonomy
  return {
    taxonomyMatch: match, // might be null or low-confidence
    shouldUseAI: true,
    taxonomyContext: buildTaxonomyContextForAI(match)
  };
}

function buildTaxonomyContextForAI(match: RoleLookupResult | null): string {
  if (!match) {
    return 'No taxonomy match found. Use your best judgment based on the job description.';
  }

  return `Taxonomy pre-classification (confidence: ${match.confidence.toFixed(2)}):
- Department: ${match.departmentLabel}
- Seniority: ${match.seniority} (level ${match.seniorityLevel})
- Cross-functional: ${match.isCrossFunctional ? `Yes — also relates to ${match.secondaryDepartment}` : 'No'}
- Suggested hiring manager titles: ${match.hiringManagerTitles.join(', ')}
- Apollo departments: ${match.apolloSearchDepartments.join(', ')}
${match.isCrossFunctional && match.searchBothDepartments ? '- SEARCH BOTH departments for contacts' : ''}

Use this as a starting point but override if the job description clearly indicates a different classification.`;
}
