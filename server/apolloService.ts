import { z } from "zod";

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
          return await this.enrichContactsList(domainResponse.contacts);
        }
      }
      
      console.log(`Searching Apollo for ${strategy.name}:`, JSON.stringify(searchPayload, null, 2));
      
      const result = await this.executeApolloSearch(searchPayload);
      return await this.enrichContactsList(result.contacts);
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
    const contacts = data.people || data.contacts || [];
    
    if (!contacts || contacts.length === 0) {
      return { contacts: [], searchPayload };
    }

    // Process and rank contacts by recruiter likelihood
    const processedContacts = contacts
      .filter(contact => contact.name && contact.title)
      .map(contact => {
        const { isRecruiter, confidence } = this.isRecruiterTitle(contact.title);
        
        return {
          apolloContact: contact,
          full_name: contact.name,
          title: contact.title,
          email: contact.email,
          linkedin_url: contact.linkedin_url,
          company_name: contact.organization_name || 'Unknown',
          is_recruiter_likely: isRecruiter,
          recruiter_confidence: confidence,
          apolloId: contact.id
        };
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
      return await this.enrichContactsList(candidateContacts);

    } catch (error) {
      console.error("Apollo search error:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to search Apollo contacts");
    }
  }

  /**
   * Enrich a list of processed contacts with email information
   */
  private async enrichContactsList(contacts: Array<{
    apolloContact: ApolloContact;
    full_name: string;
    title: string;
    email: string | undefined;
    linkedin_url: string | undefined;
    company_name: string;
    is_recruiter_likely: boolean;
    recruiter_confidence: number;
  }>): Promise<ProcessedContact[]> {
    const enrichedContacts: ProcessedContact[] = [];
    
    for (const candidate of contacts) {
      try {
        // Try to enrich the contact to get real email
        const enrichedContact = await this.enrichContactByProfile(candidate.apolloContact);
        
        const processedContact: ProcessedContact = {
          full_name: candidate.full_name,
          title: candidate.title,
          email: enrichedContact?.email || undefined,
          linkedin_url: candidate.linkedin_url,
          company_name: candidate.company_name,
          is_recruiter_likely: candidate.is_recruiter_likely,
          recruiter_confidence: candidate.recruiter_confidence,
          apolloId: candidate.apolloContact.id
        };
        
        enrichedContacts.push(processedContact);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Enrichment failed for ${candidate.full_name}:`, error);
        
        // Include contact without email if enrichment fails
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

    console.log(`Processed ${enrichedContacts.length} recruiter contacts with enrichment`);
    return enrichedContacts;
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
      
      if (data.person && data.person.email) {
        console.log(`✅ Enrichment SUCCESS for ${contact.name}: Found email ${data.person.email}`);
        return data.person;
      } else {
        console.log(`⚠️ Enrichment result for ${contact.name}: No email found in response`);
        console.log(`Response structure:`, JSON.stringify(data, null, 2));
        return data.person || null;
      }

    } catch (error) {
      console.error(`Apollo profile enrichment error for ${contact.name}:`, error);
      return null;
    }
  }

  /**
   * Search specifically for recruiting contacts (2 contacts)
   */
  async searchRecruitingContacts(params: RecruiterSearchParams & { per_page?: number }): Promise<ProcessedContact[]> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required");
    }

    try {
      const searchPayload: any = {
        q_organization_name: params.company_name,
        person_titles: RECRUITER_TITLES,
        page: 1,
        per_page: params.per_page || 2
      };

      // Add geographic filtering if available
      if (params.job_country) {
        searchPayload.person_locations = [params.job_country];
      }

      console.log(`Searching for recruiting contacts:`, JSON.stringify(searchPayload, null, 2));

      const result = await this.executeApolloSearch(searchPayload);
      return await this.enrichContactsList(result.contacts);

    } catch (error) {
      console.error("Apollo recruiting search error:", error);
      return [];
    }
  }

  /**
   * Search specifically for department lead contacts (2 contacts)
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
  }): Promise<ProcessedContact[]> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required");
    }

    try {
      const searchPayload: any = {
        q_organization_name: params.company_name,
        person_titles: params.titles,
        person_seniorities: params.seniorities,
        page: 1,
        per_page: params.per_page || 2
      };

      // Add geographic filtering if available
      if (params.job_country) {
        searchPayload.person_locations = [params.job_country];
      }

      console.log(`Searching for ${params.department} department leads:`, JSON.stringify(searchPayload, null, 2));

      const result = await this.executeApolloSearch(searchPayload);
      return await this.enrichContactsList(result.contacts);

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
          
          const processedContact: ProcessedContact = {
            full_name: candidate.full_name,
            title: candidate.title,
            email: enrichedContact?.email || undefined,
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
          
          const processedContact: ProcessedContact = {
            full_name: candidate.full_name,
            title: candidate.title,
            email: enrichedContact?.email || undefined,
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

  /**
   * Search for department lead contacts using two-bucket approach
   */
  async searchDepartmentLeads(params: DepartmentLeadSearchParams): Promise<ProcessedContact[]> {
    if (!this.apiKey) {
      console.log("Apollo API key not configured - skipping department lead search");
      return [];
    }

    try {
      console.log(`Searching for ${params.department} department leads at ${params.company_name}`);
      
      // Create search payload for department leads
      const searchPayload: any = {
        q_organization_name: params.company_name,
        person_titles: params.titles,
        person_seniorities: params.seniorities,
        page: 1,
        per_page: 10
      };

      // Add location filtering with priority hierarchy
      const locationStrategy = this.createLocationStrategy({
        company_name: params.company_name,
        job_country: params.job_country,
        job_region: params.job_region,
        company_hq_country: params.company_hq_country,
        remote_hiring_countries: params.remote_hiring_countries
      });

      if (locationStrategy.length > 0) {
        const strategy = locationStrategy[0]; // Use highest priority location
        if (strategy.location) {
          searchPayload.person_locations = [strategy.location];
        }
      }

      console.log(`Department lead search payload:`, searchPayload);

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
        console.error(`Apollo department lead search failed: ${response.status}`);
        return [];
      }

      const data: ApolloSearchResponse = await response.json();
      const contacts = data.people || data.contacts || [];

      if (!contacts || contacts.length === 0) {
        console.log("No department lead contacts found");
        return [];
      }

      // Process contacts and calculate confidence scores
      const processedContacts = contacts
        .filter(contact => contact.name && contact.title)
        .map(contact => {
          const confidenceScore = this.calculateDepartmentLeadConfidence(contact.title, params.department);
          
          return {
            full_name: contact.name,
            title: contact.title,
            email: contact.email,
            linkedin_url: contact.linkedin_url,
            company_name: contact.organization_name || params.company_name,
            is_recruiter_likely: false, // These are department leads, not recruiters
            recruiter_confidence: 0.0,
            apolloId: contact.id,
            apolloContact: contact
          };
        })
        .sort((a, b) => this.calculateDepartmentLeadConfidence(b.title, params.department) - 
                        this.calculateDepartmentLeadConfidence(a.title, params.department))
        .slice(0, 3); // Take top 3 department leads

      console.log(`Found ${processedContacts.length} department lead contacts, enriching emails...`);

      // Enrich contacts to get real email addresses
      const enrichedContacts: ProcessedContact[] = [];
      
      for (const candidate of processedContacts) {
        try {
          const enrichedContact = await this.enrichContactByProfile(candidate.apolloContact!);
          
          const processedContact: ProcessedContact = {
            full_name: candidate.full_name,
            title: candidate.title,
            email: enrichedContact?.email || undefined,
            linkedin_url: candidate.linkedin_url,
            company_name: candidate.company_name,
            is_recruiter_likely: candidate.is_recruiter_likely,
            recruiter_confidence: candidate.recruiter_confidence,
            apolloId: candidate.apolloId
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
            apolloId: candidate.apolloId
          };
          
          enrichedContacts.push(processedContact);
        }
      }

      console.log(`Department lead search returned ${enrichedContacts.length} enriched contacts`);
      return enrichedContacts;

    } catch (error) {
      console.error("Apollo department lead search error:", error);
      return [];
    }
  }

  /**
   * Calculate confidence score for department lead based on title and department
   */
  private calculateDepartmentLeadConfidence(title: string, department: string): number {
    const titleLower = title.toLowerCase();
    const departmentLower = department.toLowerCase();
    
    // Higher scores for exact department matches
    if (titleLower.includes(departmentLower)) {
      if (titleLower.includes('head') || titleLower.includes('director')) return 0.95;
      if (titleLower.includes('manager') || titleLower.includes('lead')) return 0.90;
      if (titleLower.includes('vp') || titleLower.includes('vice president')) return 0.98;
      if (titleLower.includes('cto') || titleLower.includes('cfo') || titleLower.includes('cmo')) return 0.99;
      return 0.85;
    }
    
    // Medium scores for leadership roles in any department
    if (titleLower.includes('director') || titleLower.includes('head')) return 0.75;
    if (titleLower.includes('manager') || titleLower.includes('lead')) return 0.70;
    if (titleLower.includes('vp') || titleLower.includes('vice president')) return 0.80;
    if (titleLower.includes('chief') || titleLower.includes('ceo') || titleLower.includes('president')) return 0.85;
    
    // Lower scores for non-leadership roles
    return 0.50;
  }
}

export const apolloService = new ApolloService();