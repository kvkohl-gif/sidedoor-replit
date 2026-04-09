import { z } from "zod";
import { DomainRules, emailDomain, isCompanyDomain, buildDomainRules } from "./domainRules";
import { EmailValidationGuardrails, ValidatedEmail, safeExtractApolloEmail } from "./emailValidationGuardrails";

// Apollo API response types
export interface ApolloContact {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  current_title?: string;
  email?: string;
  work_email?: string;
  primary_email?: string;
  email_status?: string;
  linkedin_url?: string;
  organization_name?: string;
  employment_history?: Array<{
    title: string;
    organization_name: string;
  }>;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url?: string;
  primary_domain?: string;
  logo_url?: string;
  description?: string;
  industry?: string;
  employees?: number;
}

export interface OrganizationSearchResponse {
  organizations: ApolloOrganization[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
  };
}

export interface ApolloSearchResponse {
  contacts: ApolloContact[];
  people: ApolloContact[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
  };
}

export interface RecruiterSearchParams {
  company_name: string;
  job_title?: string;
  location?: string;
  departments?: string[];
  specific_recruiter_name?: string; // New: for searching specific recruiters found in job descriptions
  job_country?: string; // New: country where job is located
  job_region?: string; // New: state/region where job is located  
  company_hq_country?: string; // New: company headquarters country
  remote_hiring_countries?: string[]; // New: countries where company hires remotely
}

export interface DepartmentLeadSearchParams {
  company_name: string;
  department: string;
  titles: string[];
  seniorities: string[];
  job_country?: string;
  job_region?: string;
  company_hq_country?: string;
  remote_hiring_countries?: string[];
}

export interface ProcessedContact {
  id?: string;
  full_name: string;
  title: string;
  email?: string;
  email_status?: string;
  linkedin_url?: string;
  company_name: string;
  is_recruiter_likely: boolean;
  recruiter_confidence: number;
  apolloId?: string;
  apolloContact?: ApolloContact; // Optional for enrichment compatibility
}

// Predefined recruiter titles for Apollo filtering
const RECRUITER_TITLES = [
  "recruiter",
  "technical recruiter",
  "senior recruiter",
  "lead recruiter",
  "recruiting coordinator",
  "recruiting manager",
  "recruiting lead",
  "talent acquisition",
  "talent acquisition specialist",
  "talent acquisition partner",
  "talent acquisition coordinator",
  "talent acquisition manager",
  "talent acquisition executive",
  "talent acquisition recruiter",
  "talent development manager",
  "talent manager",
  "acquisition manager",
  "acquisition specialist",
  "people operations manager",
  "people operations",
  "people operations specialist",
  "people operations coordinator",
  "people operations lead",
  "people operations director",
  "people partner",
  "people experience lead",
  "people experience manager",
  "hr business partner",
  "human resources business partner",
  "talent partner",
  "talent sourcer",
  "senior talent sourcer"
];

/**
 * Score how well an Apollo organization name matches the expected company name.
 * Returns 0-1 where 1 is a perfect match.
 */
export function scoreOrgMatch(orgName: string, expectedName: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const orgNorm = normalize(orgName);
  const expNorm = normalize(expectedName);

  // Exact match
  if (orgNorm === expNorm) return 1.0;

  // One contains the other fully
  if (orgNorm.includes(expNorm) || expNorm.includes(orgNorm)) return 0.9;

  // Check if all words of expected appear in org name
  const expWords = expNorm.split(/\s+/);
  const orgWords = orgNorm.split(/\s+/);
  const allExpWordsInOrg = expWords.every(w => orgWords.some(ow => ow.includes(w) || w.includes(ow)));
  if (allExpWordsInOrg) return 0.8;

  // First word match (e.g. "Hone" matches "Hone Health" but NOT "Honeywell")
  if (orgWords[0] === expWords[0] && orgWords[0].length >= 3) return 0.7;

  // Starts-with on full string (catches abbreviation-style matches)
  if (orgNorm.startsWith(expNorm) || expNorm.startsWith(orgNorm)) return 0.6;

  // Poor match — names diverge significantly
  return 0.1;
}

class ApolloService {
  private apiKey: string;
  private baseUrl = "https://api.apollo.io/api/v1";

  constructor() {
    this.apiKey = process.env.APOLLO_API_KEY || "";
    if (!this.apiKey) {
      console.warn("Apollo API key not found in environment variables");
    }
  }

  /**
   * Normalize a URL or domain string to its registrable hostname.
   * Strips protocol, www., paths, and ports.
   * "https://andoverma.gov/jobs/123" → "andoverma.gov"
   * "townofandover.com" → "townofandover.com"
   */
  static normalizeDomain(input: string | null | undefined): string | null {
    if (!input) return null;
    let s = input.trim().toLowerCase();
    if (!s) return null;
    // Strip scheme
    s = s.replace(/^[a-z]+:\/\//, "");
    // Strip path/query
    s = s.split("/")[0].split("?")[0].split("#")[0];
    // Strip port
    s = s.split(":")[0];
    // Strip leading www.
    s = s.replace(/^www\./, "");
    return s || null;
  }

  /**
   * Compare two domains for equivalence. Returns true if they share the same
   * registrable root (last 2 labels), e.g. "townofandover.com" == "townofandover.com"
   * but "andoverma.gov" != "townofandover.com".
   *
   * Also returns true if they share the same SLD with different TLDs from a known
   * "equivalent set" (e.g. .gov / .us / .org for municipal entities). This handles
   * cases like andoverma.gov vs andoverma.us being the same town.
   */
  static domainsMatch(a: string | null, b: string | null): boolean {
    const na = ApolloService.normalizeDomain(a);
    const nb = ApolloService.normalizeDomain(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    // Compare registrable suffix (last two labels)
    const aTail = na.split(".").slice(-2).join(".");
    const bTail = nb.split(".").slice(-2).join(".");
    if (aTail === bTail) return true;

    // Check equivalent-TLD case: same SLD, different TLD from a known group
    const aLabels = na.split(".");
    const bLabels = nb.split(".");
    if (aLabels.length >= 2 && bLabels.length >= 2) {
      const aSld = aLabels[aLabels.length - 2];
      const bSld = bLabels[bLabels.length - 2];
      const aTld = aLabels[aLabels.length - 1];
      const bTld = bLabels[bLabels.length - 1];
      const equivalentTldGroups = [
        new Set(["gov", "us", "org", "ma.us", "il.us", "ca.us", "ny.us"]), // government
        new Set(["edu", "org"]), // educational
      ];
      if (aSld === bSld) {
        for (const group of equivalentTldGroups) {
          if (group.has(aTld) && group.has(bTld)) return true;
        }
      }
    }
    return false;
  }

  /**
   * Build an Apollo organization_locations[] filter from job/contact search params.
   * Used to disambiguate same-name entities across geographies (e.g. multiple
   * "Town of Andover" municipalities). Apollo accepts free-text city/state/country.
   */
  private buildOrgLocationsFilter(params: {
    location?: string;
    job_country?: string;
    job_region?: string;
    company_hq_country?: string;
  }): string[] {
    const out: string[] = [];
    // Most specific first: city + state if we have it
    if (params.location) out.push(params.location);
    // Then state/region (e.g. "Massachusetts")
    if (params.job_region && params.job_region !== params.location) out.push(params.job_region);
    // Then country
    if (params.job_country && !out.includes(params.job_country)) out.push(params.job_country);
    if (params.company_hq_country && !out.includes(params.company_hq_country)) out.push(params.company_hq_country);
    return out;
  }

  /**
   * Generate plausible TLD variants of a domain. Used to retry Apollo org search
   * when the user-provided domain (e.g. andoverma.gov) isn't in Apollo but a sibling
   * (andoverma.us) is.
   */
  private generateTldVariants(domain: string | null | undefined): string[] {
    const normalized = ApolloService.normalizeDomain(domain);
    if (!normalized) return [];
    const labels = normalized.split(".");
    if (labels.length < 2) return [];
    const sld = labels[labels.length - 2];
    const tld = labels[labels.length - 1];

    // Government TLD variants
    const govVariants = ["gov", "us", "org"];
    const eduVariants = ["edu", "org"];

    let variants: string[] = [];
    if (govVariants.includes(tld)) {
      variants = govVariants.filter(t => t !== tld).map(t => `${sld}.${t}`);
    } else if (eduVariants.includes(tld)) {
      variants = eduVariants.filter(t => t !== tld).map(t => `${sld}.${t}`);
    }
    return variants;
  }

  /**
   * Find the best-matching organization from Apollo search results.
   * Returns null if no result scores above the threshold (0.6).
   *
   * If `expectedDomain` is provided, the matched org's domain MUST also match it
   * (same registrable root). This prevents Apollo from returning a private company
   * that happens to share a name with a government entity, etc.
   */
  findBestOrganizationMatch(
    organizations: ApolloOrganization[],
    expectedCompanyName: string,
    threshold = 0.6,
    expectedDomain: string | null = null
  ): ApolloOrganization | null {
    if (organizations.length === 0) return null;

    const normalizedExpected = ApolloService.normalizeDomain(expectedDomain);

    let bestOrg: ApolloOrganization | null = null;
    let bestScore = 0;

    for (const org of organizations) {
      const score = scoreOrgMatch(org.name, expectedCompanyName);
      const orgDomain = ApolloService.normalizeDomain(org.primary_domain);
      const domainOk = !normalizedExpected || ApolloService.domainsMatch(orgDomain, normalizedExpected);
      console.log(`  Org match: "${org.name}" vs "${expectedCompanyName}" → score ${score.toFixed(2)} (domain: ${orgDomain || 'none'}, expected: ${normalizedExpected || 'any'}, domainOk: ${domainOk})`);

      // Hard reject if domain validation is enabled and the domain doesn't match
      if (normalizedExpected && !domainOk) continue;

      if (score > bestScore) {
        bestScore = score;
        bestOrg = org;
      }
    }

    if (bestScore >= threshold) {
      console.log(`✅ Best org match: "${bestOrg!.name}" (score: ${bestScore.toFixed(2)}, id: ${bestOrg!.id}, domain: ${bestOrg!.primary_domain})`);
      return bestOrg;
    }

    if (normalizedExpected) {
      console.log(`⚠️ No org matched "${expectedCompanyName}" with domain "${normalizedExpected}" above threshold ${threshold}. Best name-only was "${bestOrg?.name}" at ${bestScore.toFixed(2)}. Returning null to prevent contact hallucination.`);
    } else {
      console.log(`⚠️ No org matched "${expectedCompanyName}" above threshold ${threshold}. Best was "${bestOrg?.name}" at ${bestScore.toFixed(2)}`);
    }
    return null;
  }

  /**
   * Extract work email from Apollo contact, preferring work-specific fields
   */
  private coerceWorkEmailFromSearch(contact: any): string | undefined {
    // Handle Apollo's contact structure - contacts are direct objects
    return contact.work_email || contact.email || contact.primary_email || undefined;
  }

  /**
   * Filter and shape Apollo search results - Allow all contacts through for enrichment
   * Domain filtering happens AFTER enrichment to prevent losing contacts with no initial emails
   */
  private shapeFromSearch(rawContacts: any[], domainRules: DomainRules): {
    accepted: Array<{
      id: string;
      name: string;
      title?: string;
      email?: string;
      email_domain?: string;
      apolloContact: any;
    }>;
    skipped: Array<{ contact: any; reason: string }>;
  } {
    const accepted = [];
    const skipped = [];

    for (const contact of rawContacts) {
      // Debug: Log the actual contact data structure
      console.log(`DEBUG: Raw contact data:`, JSON.stringify(contact, null, 2));
      
      // Handle Apollo's contact structure - contacts are direct objects
      const contactName = contact.name || contact.first_name || contact.last_name;
      
      console.log(`DEBUG: Processing contact - contact.name: ${contact.name}, contact.first_name: ${contact.first_name}, contact.last_name: ${contact.last_name}, contactName: ${contactName}`);
      
      // Only reject contacts that are clearly invalid
      if (!contactName && !contact.first_name && !contact.last_name) {
        console.log(`DEBUG: Rejecting contact - no name data: name=${contact.name}, first_name=${contact.first_name}, last_name=${contact.last_name}`);
        skipped.push({ 
          contact, 
          reason: `no_name_data` 
        });
        continue;
      }

      const email = this.coerceWorkEmailFromSearch(contact);
      const domain = emailDomain(email || "");

      const processedContact = {
        id: contact.id || contact.person_id || contact.contact_id,
        name: contact.name || `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
        title: contact.title || contact.current_title,
        email,
        email_domain: domain,
        apolloContact: contact
      };
      
      console.log(`DEBUG: ACCEPTING contact for enrichment:`, JSON.stringify(processedContact, null, 2));
      
      // Allow all contacts through for enrichment - domain filtering happens after enrichment
      // This prevents losing contacts who might have real work emails discovered through enrichment
      accepted.push(processedContact);
    }

    console.log(`Pre-enrichment filtering: ${accepted.length} accepted for enrichment, ${skipped.length} skipped (no name) from ${rawContacts.length} total`);
    return { accepted, skipped };
  }

  /**
   * Pick the best company email from enriched contact data
   */
  private pickBestCompanyEmail(enrichedContact: any, domainRules: DomainRules): string | null {
    if (!enrichedContact) return null;
    
    const candidates = [
      enrichedContact.work_email,
      enrichedContact.email,
      enrichedContact.primary_email,
    ].filter(Boolean) as string[];

    for (const email of candidates) {
      const domain = emailDomain(email);
      if (isCompanyDomain(domain, domainRules)) {
        return email;
      }
    }
    return null;
  }

  /**
   * Infer email pattern from found company emails
   */
  private inferEmailPattern(foundEmails: string[], companyDomain: string): string {
    console.log(`Analyzing ${foundEmails.length} found emails for pattern`);
    
    const patterns = {
      'first.last': 0,
      'firstlast': 0, 
      'first_last': 0,
      'flast': 0,
      'firstl': 0,
      'other': 0
    };
    
    for (const email of foundEmails) {
      const localPart = email.split('@')[0].toLowerCase();
      console.log(`  Analyzing: ${localPart}@${companyDomain}`);
      
      if (localPart.includes('.')) {
        patterns['first.last']++;
      } else if (localPart.includes('_')) {
        patterns['first_last']++;
      } else if (localPart.length > 6) {
        patterns['firstlast']++;
      } else if (localPart.length <= 6) {
        patterns['flast']++;
      } else {
        patterns['other']++;
      }
    }
    
    // Find most common pattern
    const mostCommon = Object.entries(patterns).reduce((a, b) => patterns[a[0] as keyof typeof patterns] > patterns[b[0] as keyof typeof patterns] ? a : b);
    console.log(`Pattern analysis:`, patterns);
    console.log(`Most common pattern: ${mostCommon[0]} (${mostCommon[1]} occurrences)`);
    
    return mostCommon[1] > 0 ? mostCommon[0] : 'first.last'; // Default fallback
  }

  /**
   * Generate email from pattern and name
   */
  private generateEmailFromPattern(fullName: string, pattern: string, companyDomain: string): string | null {
    const nameParts = fullName.toLowerCase().replace(/[^a-z\s]/g, '').split(' ').filter(p => p.length > 0);
    
    if (nameParts.length < 2) {
      console.log(`⚠️ Cannot generate email for "${fullName}" - insufficient name parts`);
      return null;
    }
    
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    
    let localPart: string;
    
    switch (pattern) {
      case 'first.last':
        localPart = `${firstName}.${lastName}`;
        break;
      case 'firstlast':
        localPart = `${firstName}${lastName}`;
        break;
      case 'first_last':
        localPart = `${firstName}_${lastName}`;
        break;
      case 'flast':
        localPart = `${firstName.charAt(0)}${lastName}`;
        break;
      case 'firstl':
        localPart = `${firstName}${lastName.charAt(0)}`;
        break;
      default:
        localPart = `${firstName}.${lastName}`; // Default fallback
    }
    
    return `${localPart}@${companyDomain}`;
  }

  private isRecruiterTitle(title: string): { isRecruiter: boolean; confidence: number } {
    const titleLower = title.toLowerCase().trim();
    
    // Exact match scoring for predefined recruiter titles
    const titleScoring: { [key: string]: number } = {
      "recruiter": 1.0,
      "technical recruiter": 1.0,
      "senior recruiter": 0.95,
      "lead recruiter": 0.95,
      "recruiting coordinator": 0.85,
      "recruiting manager": 0.95,
      "recruiting lead": 0.95,
      "talent acquisition": 0.9,
      "talent acquisition specialist": 0.9,
      "talent acquisition partner": 0.95,
      "talent acquisition coordinator": 0.85,
      "talent acquisition manager": 0.95,
      "talent acquisition executive": 0.95,
      "talent acquisition recruiter": 1.0,
      "talent development manager": 0.7,
      "talent manager": 0.8,
      "acquisition manager": 0.6,
      "acquisition specialist": 0.65,
      "people operations manager": 0.8,
      "people partner": 0.85,
      "people experience lead": 0.75
    };

    // Check for exact matches first
    if (titleScoring[titleLower]) {
      return { isRecruiter: true, confidence: Math.round(titleScoring[titleLower] * 100) };
    }

    // Check for partial matches with keywords
    const recruiterKeywords = [
      { terms: ["recruiter", "recruitment"], weight: 0.9 },
      { terms: ["talent acquisition"], weight: 0.85 },
      { terms: ["people operations", "people ops"], weight: 0.75 },
      { terms: ["talent"], weight: 0.7 },
      { terms: ["hiring manager", "hiring"], weight: 0.6 },
      { terms: ["hr manager", "human resources"], weight: 0.5 },
      { terms: ["sourcing"], weight: 0.7 },
      { terms: ["people partner"], weight: 0.8 }
    ];

    let maxConfidence = 0;
    let isRecruiter = false;

    for (const keyword of recruiterKeywords) {
      for (const term of keyword.terms) {
        if (titleLower.includes(term)) {
          maxConfidence = Math.max(maxConfidence, keyword.weight);
          isRecruiter = true;
        }
      }
    }

    return { isRecruiter, confidence: Math.round(maxConfidence * 100) };
  }

  async testApiConnection(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      const testPayload = {
        q_organization_name: "Google",
        page: 1,
        per_page: 1,
        reveal_personal_emails: true
      };

      console.log(`Testing Apollo API connection with payload:`, JSON.stringify(testPayload, null, 2));

      const response = await fetch(`${this.baseUrl}/mixed_people/api_search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "x-api-key": this.apiKey
        },
        body: JSON.stringify(testPayload)
      });

      const data = await response.json();
      console.log(`Apollo API test response - Status: ${response.status}`);
      console.log(`Apollo API test response - Full data:`, JSON.stringify(data, null, 2));
      console.log(`Apollo API test - Contacts length: ${data.contacts?.length || 0}`);
      console.log(`Apollo API test - People length: ${data.people?.length || 0}`);
      
      return response.ok && (data.contacts?.length > 0 || data.people?.length > 0);
    } catch (error) {
      console.error("Apollo API connection test failed:", error);
      return false;
    }
  }

  /**
   * Enrich an organization using Apollo's dedicated enrich endpoint.
   *
   * IMPORTANT (empirically validated 2026-04-09):
   * 1. Apollo's /organizations/enrich endpoint **only supports the `domain`
   *    parameter**. The `name` query string is silently ignored (confirmed by
   *    Apollo's public docs and our probe).
   * 2. Apollo's enrich has a **secondary-domain alias index** that our search
   *    endpoint does NOT have. Example: enrich(andoverma.us) returns the same
   *    canonical Town of Andover org as enrich(andoverma.gov), both with
   *    primary_domain=andoverma.gov. search({q_organization_domains_list:
   *    ["andoverma.us"]}) returns 0 results — search is strict.
   * 3. Therefore: prefer enrich when we have a trusted domain (it handles
   *    aliases). Fall back to search only for disambiguation by name+location.
   * 4. Do NOT TLD-retry inside enrich — Apollo already handles known govt/edu
   *    aliases natively. TLD retry only makes sense on the search path.
   *
   * @param domain — the domain to look up. Required.
   * @returns matched organization or null if not found
   */
  async enrichOrganization(domain: string): Promise<ApolloOrganization | null> {
    if (!this.apiKey) return null;
    if (!domain) return null;

    try {
      const queryParams = new URLSearchParams({ domain });
      console.log(`Apollo org enrich: domain=${domain}`);

      const response = await fetch(
        `${this.baseUrl}/organizations/enrich?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": this.apiKey,
          },
        }
      );

      if (!response.ok) {
        console.log(`Apollo org enrich returned ${response.status} for domain="${domain}"`);
        return null;
      }

      const data = await response.json();
      const org = data.organization;

      if (org && org.id) {
        console.log(`✅ Apollo org enrich matched: "${org.name}" (id: ${org.id}, primary_domain: ${org.primary_domain}, employees: ${org.estimated_num_employees || org.employees || 'unknown'}) via "${domain}"`);
        return {
          id: org.id,
          name: org.name,
          website_url: org.website_url,
          primary_domain: org.primary_domain,
          logo_url: org.logo_url,
          description: org.short_description || org.description,
          industry: org.industry,
          employees: org.estimated_num_employees || org.employees,
        };
      }

      console.log(`Apollo org enrich: no match for domain="${domain}"`);
      return null;
    } catch (error) {
      console.error(`Apollo org enrich error for domain="${domain}":`, error);
      return null;
    }
  }

  /**
   * Search for organizations in Apollo to get organization_id for precise matching.
   *
   * Strategy (in order):
   *   1. Domain exact match  (most precise)
   *   2. Domain TLD variants (for govt/edu entities that use multiple TLDs)
   *   3. Name + location (city/state) — disambiguates "Town of X" matches across states
   *   4. Name only (least precise — let caller validate)
   */
  async searchOrganizations(params: {
    company_name?: string;
    domain?: string;
    fallback_query?: string;
    organization_locations?: string[]; // e.g. ["Andover, Massachusetts", "United States"]
  }): Promise<ApolloOrganization[]> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required");
    }

    try {
      // First try exact domain match if available
      if (params.domain) {
        console.log(`Searching Apollo organizations by domain: ${params.domain}`);

        const domainPayload = {
          q_organization_domains_list: [params.domain],
          page: 1,
          per_page: 10
        };

        const domainResponse = await fetch(`${this.baseUrl}/mixed_companies/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": this.apiKey
          },
          body: JSON.stringify(domainPayload)
        });

        if (domainResponse.ok) {
          const domainData: OrganizationSearchResponse = await domainResponse.json();
          if (domainData.organizations && domainData.organizations.length > 0) {
            console.log(`Found ${domainData.organizations.length} organizations by domain`);
            return domainData.organizations;
          }
        }

        // ─── TLD variant retry ──────────────────────────────────────
        // Government/educational entities legitimately use multiple TLDs.
        // e.g. Town of Andover MA exists at andoverma.us AND andoverma.gov.
        // Try common government TLD variants if the original failed.
        const variants = this.generateTldVariants(params.domain);
        for (const variant of variants) {
          if (variant === params.domain) continue;
          console.log(`Retrying Apollo org search with TLD variant: ${variant}`);
          const variantResp = await fetch(`${this.baseUrl}/mixed_companies/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": this.apiKey },
            body: JSON.stringify({ q_organization_domains_list: [variant], page: 1, per_page: 10 }),
          });
          if (variantResp.ok) {
            const data: OrganizationSearchResponse = await variantResp.json();
            if (data.organizations && data.organizations.length > 0) {
              console.log(`✅ Found ${data.organizations.length} organizations via TLD variant "${variant}"`);
              return data.organizations;
            }
          }
        }
      }

      // If no domain match, try company name + location (disambiguates same-name entities)
      if (params.company_name) {
        const hasLocation = params.organization_locations && params.organization_locations.length > 0;
        console.log(`Searching Apollo organizations by name: ${params.company_name}${hasLocation ? ` + locations: ${params.organization_locations!.join(', ')}` : ''}`);

        const namePayload: any = {
          q_organization_name: params.company_name,
          page: 1,
          per_page: 10
        };
        if (hasLocation) {
          namePayload.organization_locations = params.organization_locations;
        }

        const nameResponse = await fetch(`${this.baseUrl}/mixed_companies/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": this.apiKey
          },
          body: JSON.stringify(namePayload)
        });

        if (nameResponse.ok) {
          const nameData: OrganizationSearchResponse = await nameResponse.json();
          if (nameData.organizations && nameData.organizations.length > 0) {
            console.log(`Found ${nameData.organizations.length} organizations by name`);
            return nameData.organizations;
          }
        }
      }

      // Last resort: fallback query
      if (params.fallback_query) {
        console.log(`Searching Apollo organizations with fallback query: ${params.fallback_query}`);
        
        const fallbackPayload = {
          q_organization_name: params.fallback_query,
          page: 1,
          per_page: 10
        };

        const fallbackResponse = await fetch(`${this.baseUrl}/mixed_companies/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": this.apiKey
          },
          body: JSON.stringify(fallbackPayload)
        });

        if (fallbackResponse.ok) {
          const fallbackData: OrganizationSearchResponse = await fallbackResponse.json();
          if (fallbackData.organizations) {
            console.log(`Found ${fallbackData.organizations.length} organizations with fallback query`);
            return fallbackData.organizations;
          }
        }
      }

      console.log("No organizations found with any search method");
      return [];

    } catch (error) {
      console.error("Apollo organization search error:", error);
      return [];
    }
  }

  /**
   * Search for a specific recruiter by name at a company
   */
  async searchSpecificRecruiter(params: {
    company_name: string;
    recruiter_name: string;
  }): Promise<ProcessedContact[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const nameParts = params.recruiter_name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

      const searchPayload: any = {
        q_organization_name: params.company_name,
        page: 1,
        per_page: 5,
        reveal_personal_emails: true
      };

      // Add name filters
      if (firstName) searchPayload.person_first_names = [firstName];
      if (lastName) searchPayload.person_last_names = [lastName];

      console.log(`Searching Apollo for specific recruiter: ${params.recruiter_name} at ${params.company_name}`);

      // Add reveal_personal_emails if not already present
      if (!searchPayload.reveal_personal_emails) {
        searchPayload.reveal_personal_emails = true;
      }

      const response = await fetch(`${this.baseUrl}/mixed_people/api_search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "x-api-key": this.apiKey
        },
        body: JSON.stringify(searchPayload)
      });

      if (!response.ok) {
        console.error(`Apollo API error searching for specific recruiter: ${response.status}`);
        return [];
      }

      const data: ApolloSearchResponse = await response.json();
      const contacts = data.people || data.contacts || [];

      return contacts
        .filter(contact => contact.name && contact.title)
        .map(contact => ({
          full_name: contact.name,
          title: contact.title,
          email: contact.email,
          linkedin_url: contact.linkedin_url,
          company_name: contact.organization_name || params.company_name,
          is_recruiter_likely: true, // Assume true since found in job description
          recruiter_confidence: 100 // High confidence since explicitly mentioned
        }));
    } catch (error) {
      console.error("Error searching for specific recruiter:", error);
      return [];
    }
  }

  async searchContacts(params: RecruiterSearchParams): Promise<ProcessedContact[]> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required. Please add APOLLO_API_KEY to your environment variables.");
    }

    try {
      // First, if we have a specific recruiter name, search for them directly
      if (params.specific_recruiter_name) {
        console.log(`Prioritizing specific recruiter: ${params.specific_recruiter_name}`);
        const specificContacts = await this.searchSpecificRecruiter({
          company_name: params.company_name,
          recruiter_name: params.specific_recruiter_name
        });
        
        if (specificContacts.length > 0) {
          console.log(`Found ${specificContacts.length} matches for specific recruiter`);
          // Still search for additional contacts, but prioritize the specific one
          const generalContacts = await this.searchGeneralRecruiters(params);
          return [...specificContacts, ...generalContacts];
        }
      }

      return await this.searchGeneralRecruiters(params);
    } catch (error) {
      console.error("Error in searchContacts:", error);
      return [];
    }
  }

  private async searchGeneralRecruiters(params: RecruiterSearchParams): Promise<ProcessedContact[]> {
    try {
      // Implement geographic filtering strategy
      const locationStrategies = this.buildLocationStrategies(params);
      
      for (const strategy of locationStrategies) {
        console.log(`Trying location strategy: ${strategy.name} with location: ${strategy.location}`);
        
        const contacts = await this.searchWithLocationStrategy(params, strategy);
        
        if (contacts.length > 0) {
          console.log(`Found ${contacts.length} contacts using strategy: ${strategy.name}`);
          return contacts;
        }
      }
      
      console.log("No contacts found with any geographic strategy, trying fallback search");
      return await this.searchFallback(params);
    } catch (error) {
      console.error("Error in searchGeneralRecruiters:", error);
      return [];
    }
  }

  /**
   * Build prioritized list of location search strategies
   */
  private buildLocationStrategies(params: RecruiterSearchParams): Array<{name: string, location: string | null}> {
    const strategies: Array<{name: string, location: string | null}> = [];
    
    // Strategy 1: Job country (highest priority)
    if (params.job_country) {
      strategies.push({
        name: `Job Country (${params.job_country})`,
        location: params.job_country
      });
    }
    
    // Strategy 2: Job region/state if available
    if (params.job_region && params.job_country) {
      strategies.push({
        name: `Job Region (${params.job_region}, ${params.job_country})`,
        location: `${params.job_region}, ${params.job_country}`
      });
    }
    
    // Strategy 3: Remote hiring countries (for remote jobs)
    if (params.remote_hiring_countries && params.remote_hiring_countries.length > 0) {
      for (const country of params.remote_hiring_countries) {
        strategies.push({
          name: `Remote Hiring (${country})`,
          location: country
        });
      }
    }
    
    // Strategy 4: Company HQ country
    if (params.company_hq_country && params.company_hq_country !== params.job_country) {
      strategies.push({
        name: `Company HQ (${params.company_hq_country})`,
        location: params.company_hq_country
      });
    }
    
    // Strategy 5: English-speaking regions fallback
    const englishSpeakingRegions = ['United States', 'Canada', 'United Kingdom', 'Australia'];
    for (const region of englishSpeakingRegions) {
      if (!strategies.some(s => s.location === region)) {
        strategies.push({
          name: `English-speaking Fallback (${region})`,
          location: region
        });
      }
    }
    
    return strategies;
  }

  /**
   * Search with a specific location strategy
   */
  private async searchWithLocationStrategy(
    params: RecruiterSearchParams, 
    strategy: {name: string, location: string | null}
  ): Promise<ProcessedContact[]> {
    try {
      // Find and validate the correct organization
      const organizations = await this.searchOrganizations({ company_name: params.company_name });
      const matchedOrg = this.findBestOrganizationMatch(organizations, params.company_name);
      const companyDomain = matchedOrg?.primary_domain || null;
      const resolvedOrgId = matchedOrg?.id || null;

      console.log(`Using company domain: ${companyDomain || 'UNKNOWN'} for ${params.company_name} (org: ${matchedOrg?.name || 'NO MATCH'})`);

      // Build search payload — use org_id for precision when available
      let searchPayload: any = {
        person_titles: RECRUITER_TITLES,
        page: 1,
        per_page: 10
      };

      if (resolvedOrgId) {
        searchPayload.organization_ids = [resolvedOrgId];
      } else {
        searchPayload.q_organization_name = params.company_name;
      }

      // Add location filtering
      if (strategy.location) {
        searchPayload.person_locations = [strategy.location];
      }
      
      console.log(`Searching Apollo for ${strategy.name}:`, JSON.stringify(searchPayload, null, 2));
      
      const result = await this.executeApolloSearch(searchPayload);
      
      if (result.contacts.length === 0) {
        console.log(`No contacts found with strategy ${strategy.name}`);
        return [];
      }
      
      // Use smart email discovery with actual company domain.
      // Refuse to fabricate <name>.com if Apollo couldn't validate the org.
      if (companyDomain) {
        return await this.enrichAndInferEmails(result.contacts, companyDomain);
      } else {
        console.log(`🚫 ABORTED location strategy enrichment: no trusted domain for ${params.company_name}`);
        return [];
      }

    } catch (error) {
      console.error(`Error in location strategy ${strategy.name}:`, error);
      return [];
    }
  }

  /**
   * Fallback search without location filtering
   */
  private async searchFallback(params: RecruiterSearchParams): Promise<ProcessedContact[]> {
    try {
      // Find and validate the correct organization
      const organizations = await this.searchOrganizations({ company_name: params.company_name });
      const matchedOrg = this.findBestOrganizationMatch(organizations, params.company_name);
      const companyDomain = matchedOrg?.primary_domain || null;
      const resolvedOrgId = matchedOrg?.id || null;

      const searchPayload: any = {
        person_titles: RECRUITER_TITLES,
        page: 1,
        per_page: 10
      };

      if (resolvedOrgId) {
        searchPayload.organization_ids = [resolvedOrgId];
      } else {
        searchPayload.q_organization_name = params.company_name;
      }

      console.log(`Fallback search without location filtering:`, searchPayload);
      
      const result = await this.executeApolloSearch(searchPayload);
      const candidateContacts = result.contacts;

      if (candidateContacts.length === 0) {
        console.log("No contacts found in fallback search");
        return [];
      }

      console.log(`Found ${candidateContacts.length} candidate contacts in fallback, processing emails...`);
      
      // Use smart email discovery with actual company domain.
      // Refuse to fabricate <name>.com if no trusted domain available.
      if (companyDomain) {
        return await this.enrichAndInferEmails(candidateContacts, companyDomain);
      } else {
        console.log(`🚫 ABORTED fallback enrichment: no trusted domain for ${params.company_name}`);
        return [];
      }

    } catch (error) {
      console.error("Apollo search error:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to search Apollo contacts");
    }
  }

  /**
   * Smart email discovery with Apollo-first priority logic:
   * 1. Use Apollo email → 2. Verify with NeverBounce → 3. Keep if valid → 4. Pattern only if Apollo fails
   */
  private async enrichAndInferEmails(shapedContacts: ProcessedContact[], companyDomain: string): Promise<ProcessedContact[]> {
    const results: ProcessedContact[] = [];
    const foundEmails: string[] = [];
    
    console.log(`=== APOLLO-FIRST EMAIL DISCOVERY ===`);
    console.log(`Processing ${shapedContacts.length} contacts with company domain: ${companyDomain}`);
    console.log(`Priority: Apollo email → NeverBounce verify → keep if valid → pattern only if Apollo fails`);

    // Step 1: Process each contact with Apollo-first priority
    for (const item of shapedContacts) {
      console.log(`\n--- Contact: ${item.full_name} ---`);
      console.log(`Apollo search email: ${item.email || 'NONE'}`);
      console.log(`Title: ${item.title}`);
      
      let finalEmail: string | null = null;
      let emailSource: 'apollo_verified' | 'apollo_failed_pattern' | 'none' = 'none';
      
      try {
        // PRIORITY 1: Try Apollo email first (from search or enrichment)
        let apolloEmail: string | null = null;
        
        // Check if search already gave us a real email (not placeholder)
        if (item.email && !item.email.includes('email_not_unlocked') && !item.email.includes('placeholder')) {
          apolloEmail = item.email;
          console.log(`✅ Apollo search provided real email: ${apolloEmail}`);
        } else {
          // Try enrichment to get real Apollo email
          console.log(`🔍 Apollo search gave placeholder, trying enrichment...`);
          const enrichedContact = await this.enrichContactByProfile(item.apolloContact!);
          
          if (enrichedContact?.email && enrichedContact.email !== 'NONE') {
            apolloEmail = enrichedContact.email;
            console.log(`✅ Apollo enrichment provided email: ${apolloEmail}`);
          } else {
            console.log(`❌ Apollo enrichment returned no email`);
          }
        }
        
        // PRIORITY 2: If we have Apollo email, verify with NeverBounce
        if (apolloEmail) {
          console.log(`🔍 Verifying Apollo email with NeverBounce: ${apolloEmail}`);
          
          // Import verifierService here to avoid circular dependency
          const { verifierService } = await import('./verifierService');
          const verification = await verifierService.verifyEmail(apolloEmail);
          
          if (verification) {
            console.log(`NeverBounce result: ${verification.result} (execution time: ${verification.execution_time}ms)`);
            
            // PRIORITY 3: Keep Apollo email if valid or catchall (reject invalid/disposable/unknown)
            const acceptedResults = ['valid', 'catchall'];
            const rejectedResults = ['invalid', 'disposable', 'unknown'];
            
            if (acceptedResults.includes(verification.result)) {
              finalEmail = apolloEmail;
              emailSource = 'apollo_verified';
              foundEmails.push(finalEmail);
              console.log(`✅ APOLLO EMAIL ACCEPTED: ${finalEmail} (${verification.result})`);
            } else if (rejectedResults.includes(verification.result)) {
              console.log(`❌ Apollo email rejected: ${apolloEmail} (${verification.result})`);
              console.log(`Will try pattern generation as fallback...`);
            } else {
              // Unknown result - be conservative and reject
              console.log(`⚠️ Unknown NeverBounce result '${verification.result}', rejecting Apollo email`);
              console.log(`Will try pattern generation as fallback...`);
            }
          } else {
            console.log(`⚠️ NeverBounce API unavailable - accepting Apollo email as fallback (unverified)`);
            finalEmail = apolloEmail;
            emailSource = 'apollo_verified';
            foundEmails.push(finalEmail);
          }
        } else {
          console.log(`❌ No Apollo email available, will try pattern generation...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
        
      } catch (error) {
        console.log(`⚠️ Apollo processing failed for ${item.full_name}:`, error);
      }
      
      // Add to results - pattern generation will happen in Step 2 if needed
      const { isRecruiter, confidence } = this.isRecruiterTitle(item.title || "");
      
      results.push({
        full_name: item.full_name,
        title: item.title || "",
        email: finalEmail || undefined,
        linkedin_url: item.linkedin_url,
        company_name: item.company_name || 'Unknown',
        is_recruiter_likely: isRecruiter,
        recruiter_confidence: confidence,
        apolloId: item.apolloId
        // Note: emailSource tracked in logs for debugging
      });
      
      console.log(`${finalEmail ? '✅ APOLLO SUCCESS' : '⚠️ APOLLO FAILED'}: ${item.full_name}`);
    }
    
    // Step 2: Infer email patterns for contacts without emails
    console.log(`\n=== EMAIL PATTERN INFERENCE ===`);
    console.log(`Found ${foundEmails.length} verified emails from ${results.length} contacts`);
    
    if (foundEmails.length > 0) {
      // Analyze patterns from found emails
      const emailPattern = this.inferEmailPattern(foundEmails, companyDomain);
      console.log(`Inferred email pattern: ${emailPattern}`);
      
      // Apply pattern to contacts without emails
      let inferredCount = 0;
      for (const contact of results) {
        if (!contact.email) {
          const inferredEmail = this.generateEmailFromPattern(contact.full_name, emailPattern, companyDomain);
          if (inferredEmail) {
            contact.email = inferredEmail;
            inferredCount++;
            console.log(`📧 Inferred email for ${contact.full_name}: ${inferredEmail}`);
          }
        }
      }
      console.log(`Generated ${inferredCount} inferred emails using pattern`);
    } else {
      console.log(`⚠️ No verified emails found - cannot infer pattern. Contacts will have no emails.`);
    }
    
    console.log(`\n=== FINAL RESULTS ===`);
    console.log(`Total contacts: ${results.length}`);
    const withEmails = results.filter(c => c.email).length;
    const withoutEmails = results.length - withEmails;
    console.log(`With emails: ${withEmails} | Without emails: ${withoutEmails}`);
    
    results.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.full_name} - ${contact.email || 'NO EMAIL'}`);
    });
    
    return results;
  }

  // [Rest of the methods remain the same - executeApolloSearch, enrichContactByProfile, etc.]
  // I'll continue with the remaining methods in the next part to avoid hitting the limit

  async executeApolloSearch(searchPayload: any): Promise<{contacts: ProcessedContact[], searchPayload: any}> {
    // Remove undefined fields
    Object.keys(searchPayload).forEach(key => {
      if ((searchPayload as any)[key] === undefined) {
        delete (searchPayload as any)[key];
      }
    });

    // CRITICAL: Always ensure email unlocking is enabled for all Apollo search calls
    searchPayload.reveal_personal_emails = true;
    console.log(`🔑 Email unlocking enabled: reveal_personal_emails = true`);

    const response = await fetch(`${this.baseUrl}/mixed_people/api_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": this.apiKey
      },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      console.error(`Apollo API error: ${response.status}`);
      const errorText = await response.text();
      console.error(`Apollo API error details:`, errorText);
      throw new Error(`Apollo API error: ${response.status}`);
    }

    const data: ApolloSearchResponse = await response.json();
    
    // CRITICAL: Merge both contacts AND people arrays from Apollo
    const contacts = [...(data.contacts || []), ...(data.people || [])];
    
    if (contacts && contacts.length === 0) {
      console.log(`DEBUG: Zero contacts returned - checking if this is a API limit or search issue`);
      console.log(`DEBUG: Search payload was:`, JSON.stringify(searchPayload, null, 2));
      console.log(`DEBUG: Response pagination:`, data.pagination);
    }
    
    // Log each contact structure for debugging
    if (contacts && contacts.length > 0) {
      contacts.forEach((contact, index) => {
        console.log(`DEBUG: Contact ${index} structure:`, JSON.stringify(contact, null, 2));
      });
    }
    
    if (!contacts || contacts.length === 0) {
      console.log(`DEBUG: No contacts found in Apollo response`);
      return { contacts: [], searchPayload };
    }

    // Process and rank contacts by recruiter likelihood with proper nested structure handling
    const processedContacts = contacts
      .filter(contact => {
        // Handle Apollo's contact structure - contacts are direct objects, not nested
        const name = contact.name || contact.first_name || contact.last_name;
        const title = contact.title || contact.current_title;
        console.log(`DEBUG: Filtering contact - name: ${name}, title: ${title}, structure:`, Object.keys(contact));
        return name && title;
      })
      .map(contact => {
        // Handle Apollo's contact structure - contacts are direct objects
        const title = contact.title || contact.current_title || "";
        const { isRecruiter, confidence } = this.isRecruiterTitle(title);
        
        const processedContact = {
          apolloContact: contact,
          full_name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
          title: title || "",
          email: contact.email || contact.work_email,
          email_status: contact.email_status,
          linkedin_url: contact.linkedin_url,
          company_name: contact.organization_name || 'Unknown',
          is_recruiter_likely: isRecruiter,
          recruiter_confidence: confidence,
          apolloId: contact.id
        };
        console.log(`DEBUG: Processed contact:`, JSON.stringify(processedContact, null, 2));
        return processedContact;
      })
      .sort((a, b) => b.recruiter_confidence - a.recruiter_confidence);
      // Removed .slice(0, 3) to get all contacts instead of limiting to 3

    return { contacts: processedContacts, searchPayload };
  }

  async enrichContact(email: string): Promise<ApolloContact | null> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required");
    }

    try {
      console.log(`Enriching contact: ${email}`);

      const response = await fetch(`${this.baseUrl}/people/match`, {
        method: "POST",
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
          "x-api-key": this.apiKey
        },
        body: JSON.stringify({
          email: email,
          reveal_personal_emails: true
        })
      });

      if (!response.ok) {
        console.error(`Apollo enrichment failed for ${email}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data.person || null;

    } catch (error) {
      console.error(`Apollo enrichment error for ${email}:`, error);
      return null;
    }
  }

  async enrichContactByProfile(contact: ApolloContact): Promise<ApolloContact | null> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required");
    }

    try {
      console.log(`Enriching contact by profile: ${contact.name || contact.id} at ${contact.organization_name || 'unknown org'}`);

      const matchPayload: any = {
        reveal_personal_emails: true
      };

      // PRIORITY 1: Use Apollo person ID if available (most reliable with new API)
      if (contact.id) {
        matchPayload.id = contact.id;
        console.log(`Using Apollo person ID for enrichment: ${contact.id}`);
      } else {
        // Fallback to name-based matching
        if (contact.first_name && contact.last_name) {
          matchPayload.first_name = contact.first_name;
          matchPayload.last_name = contact.last_name;
        } else if (contact.name) {
          const nameParts = contact.name.split(' ');
          matchPayload.first_name = nameParts[0];
          if (nameParts.length > 1) {
            matchPayload.last_name = nameParts.slice(1).join(' ');
          }
        }

        if (contact.organization_name) {
          matchPayload.organization_name = contact.organization_name;
        }

        if (contact.linkedin_url) {
          matchPayload.linkedin_url = contact.linkedin_url;
        }

        if (contact.title) {
          matchPayload.title = contact.title;
        }
      }

      console.log(`Enrichment payload:`, JSON.stringify(matchPayload, null, 2));

      const response = await fetch(`${this.baseUrl}/people/match`, {
        method: "POST",
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
          "x-api-key": this.apiKey
        },
        body: JSON.stringify(matchPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Apollo profile enrichment failed for ${contact.name}: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();
      
      // Apply strict email validation guardrails
      const extractedEmail = safeExtractApolloEmail(data);
      const validationResult = EmailValidationGuardrails.validateApolloEmail(
        extractedEmail,
        'apollo_enrichment',
        data
      );
      
      if (validationResult.isValid && validationResult.validatedEmail) {
        console.log(`✅ Enrichment SUCCESS for ${contact.name}: Validated email ${validationResult.validatedEmail.email} from Apollo (confidence: ${validationResult.validatedEmail.confidence})`);
        
        // Return the person data with validated email
        const personData = data.person || data;
        personData.email = validationResult.validatedEmail.email;
        personData._email_validation = validationResult.validatedEmail;
        return personData;
      } else {
        console.log(`⚠️ Enrichment FAILED validation for ${contact.name}: ${validationResult.rejectionReason}`);
        if (validationResult.warnings.length > 0) {
          console.log(`Validation warnings:`, validationResult.warnings);
        }
        console.log(`Response structure:`, JSON.stringify(data, null, 2));
        
        // Return person data without email to prevent hallucination
        const personData = data.person || data;
        if (personData) {
          delete personData.email; // Remove any invalid email
          personData._email_validation = EmailValidationGuardrails.createNoEmailResult(validationResult.rejectionReason || 'Validation failed');
        }
        return personData;
      }

    } catch (error) {
      console.error(`Apollo profile enrichment error for ${contact.name}:`, error);
      return null;
    }
  }

  // Continue with remaining methods...
  private extractDomain(companyName: string): string | null {
    // Simple domain extraction - convert company name to potential domain
    const cleanName = companyName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .replace(/(inc|corp|company|ltd|llc)$/g, '');
    
    return cleanName ? `${cleanName}.com` : null;
  }

  /**
   * Search specifically for recruiting contacts (2 contacts) - Enhanced with organization_id support
   */
  async searchRecruitingContacts(params: RecruiterSearchParams & { 
    per_page?: number;
    organization_id?: string;
    website_url?: string;
  }): Promise<ProcessedContact[]> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required");
    }

    try {
      // Find and validate the correct organization. Use domain when available,
      // fall back to name + location to disambiguate same-name entities (e.g.
      // multiple "Town of Andover"s across states).
      const expectedDomain = ApolloService.normalizeDomain(params.website_url);
      const orgLocations = this.buildOrgLocationsFilter(params);
      const organizations = await this.searchOrganizations({
        company_name: params.company_name,
        domain: expectedDomain || undefined,
        organization_locations: orgLocations.length > 0 ? orgLocations : undefined,
      });
      const matchedOrg = this.findBestOrganizationMatch(organizations, params.company_name, 0.6, expectedDomain);
      const companyDomain = matchedOrg?.primary_domain || null;
      const resolvedOrgId = params.organization_id || matchedOrg?.id || null;
      console.log(`Company domain for recruiting search: ${companyDomain || 'UNKNOWN'} (org: ${matchedOrg?.name || 'NO MATCH'}, expected: ${expectedDomain || 'none'}, locations: ${orgLocations.join('|') || 'none'})`);

      // CRITICAL: If the user provided a domain and we couldn't validate the org,
      // return empty rather than searching with a fabricated domain. This prevents
      // hallucinated contacts from a wrong-Apollo-org match.
      if (expectedDomain && !matchedOrg) {
        console.log(`🚫 ABORTED recruiting search: user provided domain "${expectedDomain}" but no Apollo org matched. Refusing to fabricate.`);
        return [];
      }

      const searchPayload: any = {
        person_titles: RECRUITER_TITLES,
        page: 1,
        per_page: params.per_page || 10
      };

      // Use organization_id for precise matching — prefer validated org match
      if (resolvedOrgId) {
        searchPayload.organization_ids = [resolvedOrgId];
        console.log(`Using organization_id for recruiting search: ${resolvedOrgId} (from: ${params.organization_id ? 'request' : 'org match'})`);
      } else {
        // Fallback to name-based search only if no org match found AND no expected domain
        searchPayload.q_organization_name = params.company_name;
        console.log(`⚠️ No validated org — using fuzzy company name for recruiting search: ${params.company_name}`);
      }

      // Add geographic filtering if available
      if (params.job_country) {
        searchPayload.person_locations = [params.job_country];
      }

      console.log(`Searching for recruiting contacts:`, JSON.stringify(searchPayload, null, 2));

      const result = await this.executeApolloSearch(searchPayload);

      console.log(`Recruiting search found ${result.contacts.length} contacts (already processed)`);

      // Use smart email discovery with actual company domain
      // Prefer: matched Apollo org domain → user-provided domain → REFUSE (no fabrication)
      const trustedDomain = companyDomain || expectedDomain;
      if (trustedDomain) {
        return await this.enrichAndInferEmails(result.contacts, trustedDomain);
      } else {
        console.log(`🚫 ABORTED recruiting enrichment: no trusted domain available for ${params.company_name}. Refusing to fabricate <name>.com pattern.`);
        return [];
      }

    } catch (error) {
      console.error("Apollo recruiting search error:", error);
      return [];
    }
  }

  /**
   * Search specifically for department lead contacts (2 contacts) - Enhanced with organization_id support
   */
  async searchDepartmentLeads(params: {
    company_name: string;
    job_title?: string;
    location?: string;
    department: string;
    titles: string[];
    seniorities: string[];
    per_page?: number;
    organization_id?: string;
    website_url?: string;
    job_country?: string;
    job_region?: string;
    company_hq_country?: string;
    remote_hiring_countries?: string[];
  }): Promise<ProcessedContact[]> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required");
    }

    try {
      // Find and validate the correct organization, cross-validating against the
      // user-provided website domain when available.
      const expectedDomain = ApolloService.normalizeDomain(params.website_url);
      const orgLocations = this.buildOrgLocationsFilter(params);
      const organizations = await this.searchOrganizations({
        company_name: params.company_name,
        domain: expectedDomain || undefined,
        organization_locations: orgLocations.length > 0 ? orgLocations : undefined,
      });
      const matchedOrg = this.findBestOrganizationMatch(organizations, params.company_name, 0.6, expectedDomain);
      const companyDomain = matchedOrg?.primary_domain || null;
      const resolvedOrgId = params.organization_id || matchedOrg?.id || null;
      console.log(`Company domain for department search: ${companyDomain || 'UNKNOWN'} (org: ${matchedOrg?.name || 'NO MATCH'}, expected: ${expectedDomain || 'none'}, locations: ${orgLocations.join('|') || 'none'})`);

      // CRITICAL: If the user provided a domain and we couldn't validate the org,
      // return empty rather than searching with a fabricated domain.
      if (expectedDomain && !matchedOrg) {
        console.log(`🚫 ABORTED department lead search: user provided domain "${expectedDomain}" but no Apollo org matched.`);
        return [];
      }

      const searchPayload: any = {
        person_titles: params.titles,
        person_seniorities: params.seniorities,
        page: 1,
        per_page: params.per_page || 10
      };

      // Use organization_id for precise matching — prefer validated org match
      if (resolvedOrgId) {
        searchPayload.organization_ids = [resolvedOrgId];
        console.log(`Using organization_id for department lead search: ${resolvedOrgId} (from: ${params.organization_id ? 'request' : 'org match'})`);
      } else {
        // Fallback to name-based search only if no org match found
        searchPayload.q_organization_name = params.company_name;
        console.log(`⚠️ No validated org — using fuzzy company name for department lead search: ${params.company_name}`);
      }

      // Add geographic filtering if available
      if (params.job_country) {
        searchPayload.person_locations = [params.job_country];
      }

      console.log(`Searching for ${params.department} department leads:`, JSON.stringify(searchPayload, null, 2));
      console.log(`Department lead titles being searched: ${params.titles.join(', ')}`);
      console.log(`Department lead seniorities being searched: ${params.seniorities.join(', ')}`);

      const result = await this.executeApolloSearch(searchPayload);
      
      // result.contacts are already processed ProcessedContact[] from executeApolloSearch
      // They already have all required properties, so log and enrich them directly
      console.log(`Department lead search: Found ${result.contacts.length} from Apollo`);
      result.contacts.forEach((contact, index) => {
        console.log(`  Contact ${index + 1}: ${contact.full_name} - ${contact.title} - Email: ${contact.email || 'None'}`);
      });

      // Use smart email discovery with actual company domain.
      // Prefer: matched Apollo org domain → user-provided domain → REFUSE (no fabrication)
      const trustedDomain = companyDomain || expectedDomain;
      if (trustedDomain) {
        return await this.enrichAndInferEmails(result.contacts, trustedDomain);
      } else {
        console.log(`🚫 ABORTED department enrichment: no trusted domain available for ${params.company_name}.`);
        return [];
      }

    } catch (error) {
      console.error("Apollo department lead search error:", error);
      return [];
    }
  }

  private async searchWithoutTitleFilter(params: RecruiterSearchParams): Promise<ProcessedContact[]> {
    try {
      const companyDomain = this.extractDomain(params.company_name);
      
      // Search without title filtering
      const searchPayload = {
        ...(companyDomain && { q_organization_domains: [companyDomain] }),
        q_organization_name: params.company_name,
        page: 1,
        per_page: 15,
        // No person_titles filter here
      };

      console.log(`Searching without title restrictions:`, searchPayload);
      
      const result = await this.executeApolloSearch(searchPayload);
      const candidateContacts = result.contacts;

      if (candidateContacts.length === 0) {
        console.log("No contacts found in title-unrestricted search");
        return [];
      }

      console.log(`Found ${candidateContacts.length} candidate contacts without title filtering, processing...`);
      
      // Use smart email discovery with validated org match
      const organizations = await this.searchOrganizations({ company_name: params.company_name });
      const matchedOrg = this.findBestOrganizationMatch(organizations, params.company_name);
      const apolloCompanyDomain = matchedOrg?.primary_domain || null;
      
      if (apolloCompanyDomain) {
        return await this.enrichAndInferEmails(candidateContacts, apolloCompanyDomain);
      } else {
        return await this.enrichAndInferEmails(candidateContacts, `${params.company_name.toLowerCase().replace(/\s+/g, '')}.com`);
      }

    } catch (error) {
      console.error("Apollo title-unrestricted search error:", error);
      return [];
    }
  }
}

export const apolloService = new ApolloService();