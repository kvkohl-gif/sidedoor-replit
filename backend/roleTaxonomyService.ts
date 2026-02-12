import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const taxonomyPath = path.join(__dirname, 'data', 'roleTaxonomy.json');
const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));

export interface RoleLookupResult {
  department: string;
  departmentLabel: string;
  confidence: number;
  seniority: string;
  seniorityLevel: number;
  apolloSeniority: string;
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

export function lookupRole(jobTitle: string): RoleLookupResult | null {
  const normalizedTitle = jobTitle.toLowerCase().trim();

  const crossMatch = matchCrossFunctional(normalizedTitle);
  if (crossMatch) return crossMatch;

  const deptMatch = matchDepartment(normalizedTitle);
  if (deptMatch) return deptMatch;

  return null;
}

export function detectSeniority(jobTitle: string): SeniorityResult {
  const normalizedTitle = jobTitle.toLowerCase().trim();

  const seniorityExceptions: Record<string, SeniorityResult> = {
    'chief of staff': { seniority: 'senior_manager', level: 6, apolloSeniority: 'director', confidence: 0.9 },
  };

  for (const [exceptionPattern, exceptionResult] of Object.entries(seniorityExceptions)) {
    if (normalizedTitle.includes(exceptionPattern)) {
      return exceptionResult;
    }
  }

  const levels = taxonomy.seniorityLevels;

  const orderedKeys = Object.keys(levels).sort(
    (a: string, b: string) => (levels as any)[b].level - (levels as any)[a].level
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

  return {
    seniority: 'mid',
    level: 2,
    apolloSeniority: 'senior',
    confidence: 0.4
  };
}

export function getHiringManagerTargets(
  departmentId: string,
  seniority: string
): { titles: string[]; seniority: string[] } | null {
  const dept = (taxonomy.departments as any)[departmentId];
  if (!dept) return null;

  const seniorityLevel = (taxonomy.seniorityLevels as any)[seniority]?.level ?? 2;
  const targets = dept.hiringManagerTargets;

  if (seniorityLevel <= 2) {
    return targets.ic_junior
      ? { titles: targets.ic_junior.targetTitles, seniority: targets.ic_junior.targetSeniority }
      : null;
  } else if (seniorityLevel <= 4) {
    return targets.ic_senior
      ? { titles: targets.ic_senior.targetTitles, seniority: targets.ic_senior.targetSeniority }
      : null;
  } else {
    return targets.manager
      ? { titles: targets.manager.targetTitles, seniority: targets.manager.targetSeniority }
      : null;
  }
}

export function getRecruiterTitleVariations(): string[] {
  return taxonomy.recruiterTitleVariations || [];
}

export function detectIndustry(
  companyDescription: string,
  jobDescription: string
): string | null {
  const combined = `${companyDescription} ${jobDescription}`.toLowerCase();
  const industries = taxonomy.industrySpecificDepartments;

  if (!industries) return null;

  for (const [key, industry] of Object.entries(industries)) {
    for (const keyword of (industry as any).keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        return key;
      }
    }
  }

  return null;
}

function matchCrossFunctional(normalizedTitle: string): RoleLookupResult | null {
  const crossRoles = taxonomy.crossFunctionalRoles;
  if (!crossRoles) return null;

  for (const [_key, role] of Object.entries(crossRoles)) {
    const r = role as any;
    for (const pattern of r.titlePatterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(normalizedTitle)) {
        const seniority = detectSeniority(normalizedTitle);
        const primaryDept = (taxonomy.departments as any)[r.primaryDepartment];
        const secondaryDept = (taxonomy.departments as any)[r.secondaryDepartment];

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
          hiringManagerSeniority: []
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

export function classifyJobRole(jobTitle: string, jobDescription?: string): {
  taxonomyMatch: RoleLookupResult | null;
  shouldUseAI: boolean;
  taxonomyContext: string;
} {
  const match = lookupRole(jobTitle);

  if (match && match.confidence >= 0.85) {
    return {
      taxonomyMatch: match,
      shouldUseAI: false,
      taxonomyContext: buildTaxonomyContextForAI(match)
    };
  }

  return {
    taxonomyMatch: match,
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
