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
  email?: string;
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
  full_name: string;
  title: string;
  email?: string;
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
  "people partner",
  "people experience lead"
];

class ApolloService {
  private apiKey: string;
  private baseUrl = "https://api.apollo.io/v1";

  constructor() {
    this.apiKey = process.env.APOLLO_API_KEY || "";
    if (!this.apiKey) {
      console.warn("Apollo API key not found in environment variables");
    }
  }

  /**
   * Extract work email from Apollo contact, preferring work-specific fields
   */
  private coerceWorkEmailFromSearch(contact: any): string | null {
    // Handle Apollo's nested person structure
    const person = contact.person || contact;
    return person.work_email || person.email || person.primary_email || contact.email || contact.work_email || null;
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
      
      // Handle Apollo's nested person structure
      const person = contact.person || contact;
      const contactName = person.name || person.first_name || person.last_name;
      
      console.log(`DEBUG: Processing contact - person.name: ${person.name}, person.first_name: ${person.first_name}, person.last_name: ${person.last_name}, contactName: ${contactName}`);
      
      // Only reject contacts that are clearly invalid
      if (!contactName && !person.first_name && !person.last_name) {
        console.log(`DEBUG: Rejecting contact - no name data: name=${person.name}, first_name=${person.first_name}, last_name=${person.last_name}`);
        skipped.push({ 
          contact, 
          reason: `no_name_data` 
        });
        continue;
      }

      const email = this.coerceWorkEmailFromSearch(contact);
      const domain = emailDomain(email || "");

      const processedContact = {
        id: person.id || contact.id || contact.person_id || contact.contact_id,
        name: person.name || `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim(),
        title: person.title || contact.title,
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
      ...(enrichedContact.emails || []),
    ].filter(Boolean) as string[];

    for (const email of candidates) {
      const domain = emailDomain(email);
      if (isCompanyDomain(domain, domainRules)) {
        return email;
      }
    }
    return null;
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
        per_page: 1
      };

      const response = await fetch(`${this.baseUrl}/mixed_people/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "x-api-key": this.apiKey
        },
        body: JSON.stringify(testPayload)
      });

      const data = await response.json();
      console.log(`Apollo API test with Google: ${response.status}, contacts: ${data.contacts?.length || 0}`);
      return response.ok && data.contacts && data.contacts.length > 0;
    } catch (error) {
      console.error("Apollo API connection test failed:", error);
      return false;
    }
  }

  /**
   * Search for organizations in Apollo to get organization_id for precise matching
   */
  async searchOrganizations(params: {
    company_name?: string;
    domain?: string;
    fallback_query?: string;
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

        const domainResponse = await fetch(`${this.baseUrl}/organizations/search`, {
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
      }

      // If no domain match, try company name search
      if (params.company_name) {
        console.log(`Searching Apollo organizations by name: ${params.company_name}`);
        
        const namePayload = {
          q_organization_name: params.company_name,
          page: 1,
          per_page: 10
        };

        const nameResponse = await fetch(`${this.baseUrl}/organizations/search`, {
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

        const fallbackResponse = await fetch(`${this.baseUrl}/organizations/search`, {
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
        per_page: 5
      };

      // Add name filters
      if (firstName) searchPayload.person_first_names = [firstName];
      if (lastName) searchPayload.person_last_names = [lastName];

      console.log(`Searching Apollo for specific recruiter: ${params.recruiter_name} at ${params.company_name}`);

      const response = await fetch(`${this.baseUrl}/mixed_people/search`, {
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
      const companyDomain = this.extractDomain(params.company_name);
      
      // Build search payload with location filtering
      let searchPayload: any = {
        q_organization_name: params.company_name,
        person_titles: RECRUITER_TITLES,
        page: 1,
        per_page: 10
      };
      
      // Add location filtering
      if (strategy.location) {
        searchPayload.person_locations = [strategy.location];
      }
      
      // Alternative: try with domain if organization name fails
      if (companyDomain) {
        const domainPayload = {
          q_organization_domains: [companyDomain],
          person_titles: RECRUITER_TITLES,
          page: 1,
          per_page: 10
        };
        
        if (strategy.location) {
          (domainPayload as any)['person_locations'] = [strategy.location];
        }
        
        console.log(`Trying domain search with location for ${strategy.name}:`, domainPayload);
        
        const domainResponse = await this.executeApolloSearch(domainPayload);
        if (domainResponse.contacts.length > 0) {
          return await this.enrichAndOverrideEmail(domainResponse.contacts, buildDomainRules(params.company_name));
        }
      }
      
      console.log(`Searching Apollo for ${strategy.name}:`, JSON.stringify(searchPayload, null, 2));
      
      const result = await this.executeApolloSearch(searchPayload);
      return await this.enrichAndOverrideEmail(result.contacts, buildDomainRules(params.company_name));
    } catch (error) {
      console.error(`Error in location strategy ${strategy.name}:`, error);
      return [];
    }
  }

  /**
   * Execute Apollo search and process results
   */
  private async executeApolloSearch(searchPayload: any): Promise<{contacts: ProcessedContact[], searchPayload: any}> {
    // Remove undefined fields
    Object.keys(searchPayload).forEach(key => {
      if ((searchPayload as any)[key] === undefined) {
        delete (searchPayload as any)[key];
      }
    });

    const response = await fetch(`${this.baseUrl}/mixed_people/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": this.apiKey
      },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Apollo API error (${response.status}):`, errorText);
      return { contacts: [], searchPayload };
    }

    const data: ApolloSearchResponse = await response.json();
    console.log(`DEBUG: Full Apollo API response:`, JSON.stringify(data, null, 2));
    
    const contacts = data.people || data.contacts || [];
    console.log(`DEBUG: Extracted contacts array length: ${contacts ? contacts.length : 'null'}`);
    
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
        // Handle Apollo's nested person structure
        const person = contact.person || contact;
        const name = person.name || person.first_name || person.last_name;
        const title = person.title || contact.title;
        console.log(`DEBUG: Filtering contact - name: ${name}, title: ${title}`);
        return name && title;
      })
      .map(contact => {
        // Handle Apollo's nested person structure
        const person = contact.person || contact;
        const title = person.title || contact.title;
        const { isRecruiter, confidence } = this.isRecruiterTitle(title);
        
        const processedContact = {
          apolloContact: contact,
          full_name: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
          title: title,
          email: person.email || contact.email,
          linkedin_url: person.linkedin_url || contact.linkedin_url,
          company_name: person.organization_name || contact.organization_name || 'Unknown',
          is_recruiter_likely: isRecruiter,
          recruiter_confidence: confidence,
          apolloId: person.id || contact.id
        };
        console.log(`DEBUG: Processed contact:`, JSON.stringify(processedContact, null, 2));
        return processedContact;
      })
      .sort((a, b) => b.recruiter_confidence - a.recruiter_confidence)
      .slice(0, 3); // Take top 3 candidates for enrichment

    return { contacts: processedContacts, searchPayload };
  }

  /**
   * Fallback search without location filtering
   */
  private async searchFallback(params: RecruiterSearchParams): Promise<ProcessedContact[]> {
    try {
      const searchPayload: any = {
        q_organization_name: params.company_name,
        person_titles: RECRUITER_TITLES,
        page: 1,
        per_page: 10
      };

      console.log(`Fallback search without location filtering:`, searchPayload);
      
      const result = await this.executeApolloSearch(searchPayload);
      const candidateContacts = result.contacts;

      if (candidateContacts.length === 0) {
        console.log("No contacts found in fallback search");
        return [];
      }

      console.log(`Found ${candidateContacts.length} candidate contacts in fallback, enriching emails...`);
      return await this.enrichAndOverrideEmail(candidateContacts, buildDomainRules(params.company_name));

    } catch (error) {
      console.error("Apollo search error:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to search Apollo contacts");
    }
  }

  /**
   * Enrich contacts and prefer company emails from enrichment, with domain validation
   */
  private async enrichAndOverrideEmail(shapedContacts: ProcessedContact[], domainRules: DomainRules): Promise<ProcessedContact[]> {
    const results: ProcessedContact[] = [];
    const skippedEnrichment = [];

    for (const item of shapedContacts) {
      try {
        // Try to enrich the contact to get potentially better email
        const enrichedContact = await this.enrichContactByProfile(item.apolloContact!);
        
        // Pick the best company email from enrichment results
        const overrideEmail = this.pickBestCompanyEmail(enrichedContact, domainRules);
        
        // Prefer enrichment email when it finds a better @company email
        const finalEmail = overrideEmail ?? item.email;

        // Final safety: still must be company domain (no NB filtering here)
        if (!finalEmail || !isCompanyDomain(emailDomain(finalEmail), domainRules)) {
          skippedEnrichment.push({ 
            item, 
            reason: "no_company_email_after_enrichment" 
          });
          continue;
        }

        // Determine recruiter likelihood
        const { isRecruiter, confidence } = this.isRecruiterTitle(item.title || "");

        const processedContact: ProcessedContact = {
          full_name: item.full_name,
          title: item.title || "",
          email: finalEmail,
          linkedin_url: item.linkedin_url,
          company_name: item.company_name || 'Unknown',
          is_recruiter_likely: isRecruiter,
          recruiter_confidence: confidence,
          apolloId: item.apolloId
        };
        
        results.push(processedContact);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Enrichment failed for ${item.full_name}:`, error);
        
        // Include contact with original email if enrichment fails (if it's still company domain)
        if (item.email && isCompanyDomain(emailDomain(item.email), domainRules)) {
          const { isRecruiter, confidence } = this.isRecruiterTitle(item.title || "");
          
          const processedContact: ProcessedContact = {
            full_name: item.full_name,
            title: item.title || "",
            email: item.email,
            linkedin_url: item.linkedin_url,
            company_name: item.company_name || 'Unknown',
            is_recruiter_likely: isRecruiter,
            recruiter_confidence: confidence,
            apolloId: item.id
          };
          
          results.push(processedContact);
        } else {
          skippedEnrichment.push({ 
            item, 
            reason: "enrichment_failed_and_no_valid_original_email" 
          });
        }
      }
    }

    console.log(`Enrichment processing: ${results.length} final contacts, ${skippedEnrichment.length} skipped`);
    return results;
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
      console.log(`Enriching contact by profile: ${contact.name} at ${contact.organization_name}`);

      const matchPayload: any = {
        reveal_personal_emails: true
        // Note: reveal_phone_number requires webhook_url, so we'll skip it for now
      };

      // Use multiple identifiers for better matching
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

      // Add title for better matching
      if (contact.title) {
        matchPayload.title = contact.title;
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
      // Build domain rules for filtering
      const domainRules = buildDomainRules(params.company_name, params.website_url);
      console.log(`Domain rules for ${params.company_name}:`, domainRules);

      const searchPayload: any = {
        person_titles: RECRUITER_TITLES,
        page: 1,
        per_page: params.per_page || 3
      };

      // Use organization_id for precise matching if available
      if (params.organization_id) {
        searchPayload.organization_ids = [params.organization_id];
        console.log(`Using organization_id for recruiting search: ${params.organization_id}`);
      } else {
        // Fallback to name-based search
        searchPayload.q_organization_name = params.company_name;
        console.log(`Using company name for recruiting search: ${params.company_name}`);
      }

      // Add geographic filtering if available
      if (params.job_country) {
        searchPayload.person_locations = [params.job_country];
      }

      console.log(`Searching for recruiting contacts:`, JSON.stringify(searchPayload, null, 2));

      const result = await this.executeApolloSearch(searchPayload);
      
      // Apply domain filtering early - reject non-company emails at source
      const { accepted, skipped } = this.shapeFromSearch(result.contacts, domainRules);
      console.log(`Recruiting search domain filtering: ${accepted.length} accepted, ${skipped.length} skipped`);

      return await this.enrichAndOverrideEmail(accepted, domainRules);

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
    job_country?: string;
    job_region?: string;
    company_hq_country?: string;
    remote_hiring_countries?: string[];
    per_page?: number;
    organization_id?: string;
    website_url?: string;
  }): Promise<ProcessedContact[]> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required");
    }

    try {
      // Build domain rules for filtering
      const domainRules = buildDomainRules(params.company_name, params.website_url);
      console.log(`Domain rules for ${params.company_name}:`, domainRules);

      const searchPayload: any = {
        person_titles: params.titles,
        person_seniorities: params.seniorities,
        page: 1,
        per_page: params.per_page || 3
      };

      // Use organization_id for precise matching if available
      if (params.organization_id) {
        searchPayload.organization_ids = [params.organization_id];
        console.log(`Using organization_id for department lead search: ${params.organization_id}`);
      } else {
        // Fallback to name-based search
        searchPayload.q_organization_name = params.company_name;
        console.log(`Using company name for department lead search: ${params.company_name}`);
      }

      // Add geographic filtering if available
      if (params.job_country) {
        searchPayload.person_locations = [params.job_country];
      }

      console.log(`Searching for ${params.department} department leads:`, JSON.stringify(searchPayload, null, 2));

      const result = await this.executeApolloSearch(searchPayload);
      
      // Apply domain filtering early - reject non-company emails at source
      const { accepted, skipped } = this.shapeFromSearch(result.contacts, domainRules);
      console.log(`Department lead search domain filtering: ${accepted.length} accepted, ${skipped.length} skipped`);

      return await this.enrichAndOverrideEmail(accepted, domainRules);

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
        per_page: 15 // Get more results since we'll filter client-side
      };

      console.log(`Searching Apollo without title filter for ${params.company_name}`);

      const response = await fetch(`${this.baseUrl}/mixed_people/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "x-api-key": this.apiKey
        },
        body: JSON.stringify(searchPayload)
      });

      if (!response.ok) {
        console.log(`Search without title filter failed: ${response.status}`);
        return await this.tryBroaderSearch(params.company_name);
      }

      const data: ApolloSearchResponse = await response.json();
      const contacts = data.people || data.contacts || [];
      
      if (!contacts || contacts.length === 0) {
        console.log("No contacts found without title filter, trying broader search...");
        return await this.tryBroaderSearch(params.company_name);
      }

      // Filter and process results to find recruiters
      const candidateContacts = contacts
        .filter(contact => contact.name && contact.title)
        .map(contact => {
          const { isRecruiter, confidence } = this.isRecruiterTitle(contact.title);
          
          return {
            apolloContact: contact,
            full_name: contact.name,
            title: contact.title,
            email: contact.email,
            linkedin_url: contact.linkedin_url,
            company_name: contact.organization_name || params.company_name,
            is_recruiter_likely: isRecruiter,
            recruiter_confidence: confidence
          };
        })
        .filter(contact => contact.is_recruiter_likely) // Only keep likely recruiters
        .sort((a, b) => b.recruiter_confidence - a.recruiter_confidence)
        .slice(0, 3); // Take top 3 recruiter candidates

      console.log(`Found ${candidateContacts.length} recruiter candidates without title filter, enriching emails...`);

      // Enrich contacts to get real email addresses
      const enrichedContacts: ProcessedContact[] = [];
      
      for (const candidate of candidateContacts) {
        try {
          const enrichedContact = await this.enrichContactByProfile(candidate.apolloContact);
          
          // Apply validation guardrails to enriched email
          const validatedEmail = enrichedContact?.email ? 
            EmailValidationGuardrails.validateApolloEmail(
              enrichedContact.email,
              'apollo_enrichment',
              enrichedContact
            ) : null;
          
          const processedContact: ProcessedContact = {
            full_name: candidate.full_name,
            title: candidate.title,
            email: validatedEmail?.isValid ? validatedEmail.validatedEmail!.email : undefined,
            linkedin_url: candidate.linkedin_url,
            company_name: candidate.company_name,
            is_recruiter_likely: candidate.is_recruiter_likely,
            recruiter_confidence: candidate.recruiter_confidence
          };
          
          enrichedContacts.push(processedContact);
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Enrichment failed for ${candidate.full_name}:`, error);
          
          const processedContact: ProcessedContact = {
            full_name: candidate.full_name,
            title: candidate.title,
            email: undefined,
            linkedin_url: candidate.linkedin_url,
            company_name: candidate.company_name,
            is_recruiter_likely: candidate.is_recruiter_likely,
            recruiter_confidence: candidate.recruiter_confidence,
            apolloId: candidate.apolloContact.id
          };
          
          enrichedContacts.push(processedContact);
        }
      }

      console.log(`Search without title filter returned ${enrichedContacts.length} enriched contacts`);
      return enrichedContacts;

    } catch (error) {
      console.error("Search without title filter failed:", error);
      return await this.tryBroaderSearch(params.company_name);
    }
  }

  private async tryBroaderSearch(companyName: string): Promise<ProcessedContact[]> {
    try {
      const companyDomain = this.extractDomain(companyName);
      // Very broad search with minimal filters
      const broadSearchPayload = {
        // Use domain for more reliable matching
        ...(companyDomain && { q_organization_domains: [companyDomain] }),
        q_organization_name: companyName,
        page: 1,
        per_page: 10,
        // Use core recruiter titles for broader search
        person_titles: [
          "recruiter", 
          "talent acquisition", 
          "talent acquisition manager",
          "talent acquisition specialist",
          "recruiting manager",
          "people operations manager",
          "people partner"
        ]
      };

      console.log(`Trying broader Apollo search for ${companyName} with domain: ${companyDomain}`);

      const response = await fetch(`${this.baseUrl}/mixed_people/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "x-api-key": this.apiKey
        },
        body: JSON.stringify(broadSearchPayload)
      });

      if (!response.ok) {
        console.log(`Broader search also failed: ${response.status}`);
        return [];
      }

      const data: ApolloSearchResponse = await response.json();
      
      // Apollo returns data in 'people' array, not 'contacts'
      const contacts = data.people || data.contacts || [];
      
      if (!contacts || contacts.length === 0) {
        console.log("No contacts found even in broader search");
        return [];
      }

      // Process broader search results with enrichment
      const candidateContacts = contacts
        .filter(contact => contact.name && contact.title)
        .map(contact => {
          const { isRecruiter, confidence } = this.isRecruiterTitle(contact.title);
          
          return {
            apolloContact: contact,
            full_name: contact.name,
            title: contact.title,
            linkedin_url: contact.linkedin_url,
            company_name: contact.organization_name || companyName,
            is_recruiter_likely: isRecruiter,
            recruiter_confidence: confidence
          };
        })
        .sort((a, b) => b.recruiter_confidence - a.recruiter_confidence)
        .slice(0, 3); // Take top 3 candidates for broader search (testing mode)

      console.log(`Broader search found ${candidateContacts.length} candidates, enriching emails...`);

      // Enrich contacts to get real email addresses
      const enrichedContacts: ProcessedContact[] = [];
      
      for (const candidate of candidateContacts) {
        try {
          const enrichedContact = await this.enrichContactByProfile(candidate.apolloContact);
          
          // Apply validation guardrails to enriched email
          const validatedEmail = enrichedContact?.email ? 
            EmailValidationGuardrails.validateApolloEmail(
              enrichedContact.email,
              'apollo_enrichment',
              enrichedContact
            ) : null;
          
          const processedContact: ProcessedContact = {
            full_name: candidate.full_name,
            title: candidate.title,
            email: validatedEmail?.isValid ? validatedEmail.validatedEmail!.email : undefined,
            linkedin_url: candidate.linkedin_url,
            company_name: candidate.company_name,
            is_recruiter_likely: candidate.is_recruiter_likely,
            recruiter_confidence: candidate.recruiter_confidence
          };
          
          enrichedContacts.push(processedContact);
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Broader search enrichment failed for ${candidate.full_name}:`, error);
          
          const processedContact: ProcessedContact = {
            full_name: candidate.full_name,
            title: candidate.title,
            email: undefined,
            linkedin_url: candidate.linkedin_url,
            company_name: candidate.company_name,
            is_recruiter_likely: candidate.is_recruiter_likely,
            recruiter_confidence: candidate.recruiter_confidence
          };
          
          enrichedContacts.push(processedContact);
        }
      }

      console.log(`Broader search returned ${enrichedContacts.length} enriched contacts`);
      return enrichedContacts;

    } catch (error) {
      console.error("Broader Apollo search failed:", error);
      return [];
    }
  }

  private isPlaceholderEmail(email?: string): boolean {
    if (!email) return false;
    
    // Apollo placeholder email patterns
    const placeholderPatterns = [
      'email_not_unlocked@domain.com',
      'email_locked@domain.com', 
      '@domain.com',
      'contact@example.com',
      'noemail@apollo.io'
    ];
    
    return placeholderPatterns.some(pattern => 
      email.includes(pattern) || email === pattern
    );
  }

  private extractDomain(companyName: string): string | null {
    // Simple domain extraction - could be enhanced with a lookup table
    const cleaned = companyName.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/(inc|corp|llc|ltd|company|co)$/, '');
    
    // For known companies, return the actual domain
    const domainMap: Record<string, string> = {
      'betterhelp': 'betterhelp.com',
      'wave': 'wave.com',
      'google': 'google.com',
      'microsoft': 'microsoft.com',
      'amazon': 'amazon.com',
      'meta': 'meta.com',
      'apple': 'apple.com'
    };
    
    return domainMap[cleaned] || `${cleaned}.com`;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const apolloService = new ApolloService();