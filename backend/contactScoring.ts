/**
 * Token-set scoring for contact candidates.
 *
 * Replaces the brittle enumerated-title-list approach with a transparent
 * scoring function. The bet: query Apollo broadly (recall), score precisely
 * client-side. Adding a new title variant ("Talent Concierge") no longer
 * requires patching a list — it'll either score well via its tokens, score
 * well via its Apollo department, or it won't, and we'll see why.
 */

import type { DeptId } from './departmentRouter';

// ─── Static keyword bags per department ───────────────────────────
// 'primary' = strong positive signal for the dept
// 'boost'   = related/adjacent terms; smaller positive
// Intentionally lowercase, contains-matched against the candidate's title.

interface DeptKeywords { primary: string[]; boost: string[]; }

const DEPT_KEYWORD_BAGS: Record<DeptId, DeptKeywords> = {
  product: {
    primary: ['product', 'pm ', ' pm', 'cpo', 'product manager', 'product management', 'product owner'],
    boost: ['platform', 'growth', 'strategy', 'roadmap', 'discovery', 'lifecycle'],
  },
  engineering: {
    primary: ['engineer', 'engineering', 'developer', 'software', 'sre', 'devops', 'cto', 'architect', 'tech lead'],
    boost: ['platform', 'infrastructure', 'backend', 'frontend', 'fullstack', 'mobile', 'systems'],
  },
  design: {
    primary: ['design', 'designer', 'ux', 'ui', 'product design', 'design systems'],
    boost: ['research', 'visual', 'brand', 'interaction', 'illustrator', 'prototyping'],
  },
  data: {
    primary: ['data', 'analytics', 'analyst', 'scientist', 'data science', 'machine learning', ' ml ', ' ai '],
    boost: ['insights', 'reporting', 'modeling', 'business intelligence'],
  },
  it: {
    primary: ['it ', 'information technology', 'security', 'infosec', 'ciso', 'sysadmin', 'cyber'],
    boost: ['operations', 'compliance', 'risk', 'cloud'],
  },
  marketing: {
    primary: ['marketing', 'growth', 'brand', 'demand gen', 'cmo', 'marketer'],
    boost: ['content', 'seo', 'paid', 'lifecycle', 'crm', 'communications', 'pr'],
  },
  sales: {
    primary: ['sales', 'revenue', 'account executive', ' ae ', 'cro', 'business development', ' bdr', ' sdr'],
    boost: ['enterprise', 'commercial', 'partnerships', 'accounts', 'channel'],
  },
  customer_success: {
    primary: ['customer success', 'customer experience', 'support', 'csm', ' cx '],
    boost: ['onboarding', 'retention', 'enablement', 'community', 'implementation'],
  },
  operations: {
    primary: ['operations', ' ops', 'business operations', 'bizops', 'coo'],
    boost: ['program', 'strategy', 'efficiency', 'process'],
  },
  people: {
    primary: ['people', 'human resources', ' hr ', ' hr,', 'talent', 'recruiter', 'recruiting', 'chro', 'sourcer'],
    boost: ['culture', 'engagement', 'learning', 'l&d', 'compensation'],
  },
  finance: {
    primary: ['finance', 'accounting', 'controller', 'cfo', 'fp&a', 'treasurer'],
    boost: ['treasury', 'audit', 'tax', 'planning'],
  },
  legal: {
    primary: ['legal', 'counsel', 'attorney', 'compliance', 'general counsel', 'paralegal'],
    boost: ['privacy', 'regulatory', 'contracts', 'litigation'],
  },
};

// Apollo's department field is freeform — match on stems, not exact strings.
const APOLLO_DEPT_MATCH_TOKENS: Record<DeptId, string[]> = {
  product: ['product'],
  engineering: ['engineer', 'engineering', 'technology', 'software', 'technical'],
  design: ['design', 'ux', 'user experience'],
  data: ['data', 'analytics', 'science', 'intelligence'],
  it: ['information technology', 'security', 'it '],
  marketing: ['marketing', 'growth', 'brand', 'communications'],
  sales: ['sales', 'revenue', 'business development'],
  customer_success: ['customer', 'support', 'success'],
  operations: ['operations', 'ops'],
  people: ['people', 'human resources', 'talent', 'recruit'],
  finance: ['finance', 'accounting'],
  legal: ['legal', 'compliance'],
};

// Penalty tokens — when a candidate's title contains these AND the search isn't
// for an entry-level role, deprioritize hard.
const PENALTY_TOKENS_NON_ENTRY = [
  'intern', 'internship', 'apprentice', 'trainee', 'student', 'volunteer', 'fellow',
];

// Tokens that look like role-area modifiers ("Originations", "Growth", "Platform"
// in "Senior Product Manager, Originations Platform"). We strip out the common
// title scaffolding and keep distinctive modifier nouns to boost candidates who
// share the same area.
const COMMON_TITLE_SCAFFOLD = new Set([
  'senior', 'sr', 'snr', 'junior', 'jr', 'lead', 'principal', 'staff', 'manager',
  'director', 'vp', 'vice', 'president', 'svp', 'evp', 'head', 'chief', 'officer',
  'product', 'engineering', 'engineer', 'design', 'designer', 'data', 'marketing',
  'sales', 'operations', 'finance', 'legal', 'people', 'hr', 'recruiter', 'recruiting',
  'talent', 'and', 'or', 'of', 'the', 'a', 'an', 'i', 'ii', 'iii', 'iv', 'v',
  'remote', 'analyst', 'specialist', 'coordinator', 'support', 'customer', 'success',
  'cto', 'cfo', 'cmo', 'cpo', 'cro', 'coo', 'ceo', 'pm', 'associate', 'entry',
  'tester', 'qa', 'platform', 'team', 'group',
]);

export interface RoleKeywordBag {
  primary: string[];
  boost: string[];
  penalty: string[];
  topDept: DeptId;
  isEntryLevel: boolean;
  jobTitle: string;
}

export function buildRoleKeywordBag(opts: {
  jobTitle: string;
  topDept: DeptId;
}): RoleKeywordBag {
  const bag = DEPT_KEYWORD_BAGS[opts.topDept];
  const titleLower = (opts.jobTitle || '').toLowerCase();
  const isEntryLevel = /\b(intern|internship|junior|jr\.?|associate|entry.level|new.grad|graduate program)\b/.test(titleLower);

  const modifierTokens = extractTitleModifiers(opts.jobTitle);

  return {
    primary: bag.primary.slice(),
    // dedup boost + modifier tokens
    boost: Array.from(new Set([...bag.boost, ...modifierTokens])),
    penalty: isEntryLevel ? [] : PENALTY_TOKENS_NON_ENTRY.slice(),
    topDept: opts.topDept,
    isEntryLevel,
    jobTitle: opts.jobTitle,
  };
}

function extractTitleModifiers(title: string): string[] {
  if (!title) return [];
  return title
    .toLowerCase()
    .split(/[\s,/&()\-:;.]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 4 && !COMMON_TITLE_SCAFFOLD.has(t));
}

// ─── Scoring ──────────────────────────────────────────────────────

export interface ScoreBreakdown {
  total: number;
  primaryMatches: string[];
  boostMatches: string[];
  penaltyMatches: string[];
  deptMatch: boolean;
  seniorityFit: 'top' | 'good' | 'reach' | 'overshoot' | 'below';
  reasons: string[];
}

export function scoreContact(opts: {
  title: string;
  apolloDepartment?: string | string[] | null;
  bag: RoleKeywordBag;
  jobSeniorityRank: number;
  contactSeniorityRank: number;
}): ScoreBreakdown {
  // Pad title with spaces so " pm " / " ae " style boundary-tokens match cleanly.
  const title = ` ${(opts.title || '').toLowerCase()} `;

  const primaryMatches: string[] = [];
  const boostMatches: string[] = [];
  const penaltyMatches: string[] = [];

  for (const t of opts.bag.primary) {
    if (title.includes(t)) primaryMatches.push(t.trim());
  }
  for (const t of opts.bag.boost) {
    if (title.includes(t)) boostMatches.push(t.trim());
  }
  for (const t of opts.bag.penalty) {
    if (title.includes(t)) penaltyMatches.push(t.trim());
  }

  // Department signal
  const deptStr = Array.isArray(opts.apolloDepartment)
    ? opts.apolloDepartment.join(' ').toLowerCase()
    : ((opts.apolloDepartment ?? '') as string).toString().toLowerCase();
  const deptMatch = APOLLO_DEPT_MATCH_TOKENS[opts.bag.topDept].some(k => deptStr.includes(k));

  // Seniority fit (gap = contact - job; positive = contact is more senior)
  const gap = opts.contactSeniorityRank - opts.jobSeniorityRank;
  let seniorityFit: ScoreBreakdown['seniorityFit'];
  let senScore = 0;
  if (gap >= 1 && gap <= 2) { seniorityFit = 'top'; senScore = 2; }
  else if (gap === 0) { seniorityFit = 'good'; senScore = 1.5; }
  else if (gap === 3) { seniorityFit = 'reach'; senScore = 0.5; }
  else if (gap > 3) { seniorityFit = 'overshoot'; senScore = -0.5; }
  else { seniorityFit = 'below'; senScore = -0.5; }

  let total = 0;
  total += Math.min(primaryMatches.length * 2, 4);
  total += Math.min(boostMatches.length * 0.5, 2);
  total += penaltyMatches.length * -3;
  total += deptMatch ? 1.5 : 0;
  total += senScore;

  const reasons: string[] = [];
  if (primaryMatches.length) reasons.push(`primary:${primaryMatches.join('|')}`);
  if (boostMatches.length) reasons.push(`boost:${boostMatches.join('|')}`);
  if (penaltyMatches.length) reasons.push(`penalty:${penaltyMatches.join('|')}`);
  if (deptMatch) reasons.push('dept-aligned');
  reasons.push(`seniority:${seniorityFit}(gap=${gap})`);

  return {
    total: Math.round(total * 100) / 100,
    primaryMatches,
    boostMatches,
    penaltyMatches,
    deptMatch,
    seniorityFit,
    reasons,
  };
}

// Min score for a candidate to be considered a real hiring-manager match.
// Tuned: a contact needs at minimum one primary token hit OR a dept match plus
// a non-disastrous seniority gap.
export const HM_SCORE_THRESHOLD = 1.5;

export interface RankedCandidate<T> {
  contact: T;
  score: ScoreBreakdown;
}

export function rankCandidates<T extends { title?: string; full_name?: string }>(
  candidates: Array<{
    contact: T;
    apolloDept?: string | string[] | null;
    contactSeniorityRank: number;
  }>,
  bag: RoleKeywordBag,
  jobSeniorityRank: number,
  threshold: number = HM_SCORE_THRESHOLD,
): Array<RankedCandidate<T>> {
  const scored = candidates.map(c => ({
    contact: c.contact,
    score: scoreContact({
      title: c.contact.title || '',
      apolloDepartment: c.apolloDept,
      bag,
      jobSeniorityRank,
      contactSeniorityRank: c.contactSeniorityRank,
    }),
  }));

  return scored
    .filter(s => s.score.total >= threshold)
    .sort((a, b) => b.score.total - a.score.total);
}

// ─── Seniority ranking (mirrors frontend/src/components/JobDetails.tsx) ───

const CONTACT_SENIORITY_RANK: Record<string, number> = {
  entry: 1, junior: 1, associate: 2, mid: 3,
  senior: 4, lead: 5, staff: 5, principal: 6, manager: 6,
  director: 7, head: 7, vp: 8, c_suite: 9, chief: 9, owner: 9, founder: 9,
};

export function getJobSeniorityRank(jobTitle: string | null | undefined): number {
  if (!jobTitle) return 4;
  const t = jobTitle.toLowerCase();
  if (/\b(intern|internship)\b/.test(t)) return 0;
  if (/\b(entry.level|new.grad|graduate)\b/.test(t)) return 1;
  if (/\b(junior|jr\.?)\b/.test(t)) return 1;
  if (/\b(associate)\b/.test(t)) return 2;
  if (/\bchief\b|\bcoo\b|\bceo\b|\bcto\b|\bcfo\b|\bcmo\b|\bcpo\b/.test(t)) return 9;
  if (/\bvp\b|vice president/.test(t)) return 8;
  if (/\bdirector\b|\bhead of\b/.test(t)) return 7;
  if (/\b(principal|staff)\b/.test(t)) return 6;
  if (/\bmanager\b/.test(t)) return 6;
  if (/\b(senior|sr\.?|lead)\b/.test(t)) return 4;
  return 3;
}

export function getContactSeniorityRank(apolloSeniority: string | null | undefined): number {
  if (!apolloSeniority) return 3;
  return CONTACT_SENIORITY_RANK[apolloSeniority.toLowerCase()] ?? 3;
}
