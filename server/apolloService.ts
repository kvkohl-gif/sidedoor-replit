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
}

export interface ProcessedContact {
  full_name: string;
  title: string;
  email?: string;
  linkedin_url?: string;
  company_name: string;
  is_recruiter_likely: boolean;
  recruiter_confidence: number;
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
      // Try a very basic search to test if Apollo API is working
      const companyDomain = this.extractDomain(params.company_name);
      
      // Try multiple search approaches to test Apollo API
      let searchPayload: any = {};
      
      // First try: organization name with recruiter title filtering
      if (params.company_name) {
        searchPayload = {
          q_organization_name: params.company_name,
          person_titles: RECRUITER_TITLES,
          page: 1,
          per_page: 10
        };
      }
      
      // If that fails, try with domain and title filtering
      if (companyDomain && Object.keys(searchPayload).length === 0) {
        searchPayload = {
          q_organization_domains: [companyDomain],
          person_titles: RECRUITER_TITLES,
          page: 1,
          per_page: 10
        };
      }
      
      // Fallback: try a test company we know should have data
      if (Object.keys(searchPayload).length === 0) {
        searchPayload = {
          q_organization_name: "Google",
          page: 1,
          per_page: 5
        };
      }
      
      // Remove undefined fields
      Object.keys(searchPayload).forEach(key => {
        if ((searchPayload as any)[key] === undefined) {
          delete (searchPayload as any)[key];
        }
      });

      console.log(`Searching Apollo for contacts at ${params.company_name} with payload:`, JSON.stringify(searchPayload, null, 2));

      const response = await fetch(`${this.baseUrl}/mixed_people/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "x-api-key": this.apiKey  // Use lowercase x-api-key as per Apollo docs
        },
        body: JSON.stringify(searchPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Apollo API error (${response.status}):`, errorText);
        console.error(`Apollo API response headers:`, Object.fromEntries(response.headers.entries()));
        
        // If no results, try a broader search
        if (response.status === 200 || response.status === 404) {
          console.log("Trying broader Apollo search...");
          return await this.tryBroaderSearch(params.company_name);
        }
        
        throw new Error(`Apollo API request failed: ${response.status} ${response.statusText}`);
      }

      const data: ApolloSearchResponse = await response.json();
      console.log(`Apollo API response:`, JSON.stringify(data, null, 2));
      
      // Apollo returns data in 'people' array, not 'contacts'
      const contacts = data.people || data.contacts || [];
      console.log(`Apollo returned ${contacts.length} contacts`);

      if (!contacts || contacts.length === 0) {
        console.log("No contacts found with title filtering, trying without title filters...");
        return await this.searchWithoutTitleFilter(params);
      }

      // Process and rank contacts by recruiter likelihood
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
        .sort((a, b) => b.recruiter_confidence - a.recruiter_confidence)
        .slice(0, 3); // Take top 3 candidates for enrichment (testing mode)

      console.log(`Found ${candidateContacts.length} candidate contacts, enriching emails...`);

      // Step 2: Enrich contacts to get real email addresses
      const enrichedContacts: ProcessedContact[] = [];
      
      for (const candidate of candidateContacts) {
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
            recruiter_confidence: candidate.recruiter_confidence
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
            recruiter_confidence: candidate.recruiter_confidence
          };
          
          enrichedContacts.push(processedContact);
        }
      }

      console.log(`Processed ${enrichedContacts.length} recruiter contacts with enrichment`);
      return enrichedContacts;

    } catch (error) {
      console.error("Apollo search error:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to search Apollo contacts");
    }
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
      console.log(`Enriching contact by profile: ${contact.name}`);

      const matchPayload: any = {
        reveal_personal_emails: true
      };

      // Use multiple identifiers for better matching
      if (contact.first_name && contact.last_name) {
        matchPayload.first_name = contact.first_name;
        matchPayload.last_name = contact.last_name;
      } else if (contact.name) {
        const nameParts = contact.name.split(' ');
        matchPayload.first_name = nameParts[0];
        matchPayload.last_name = nameParts.slice(1).join(' ');
      }

      if (contact.organization_name) {
        matchPayload.organization_name = contact.organization_name;
      }

      if (contact.linkedin_url) {
        matchPayload.linkedin_url = contact.linkedin_url;
      }

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
        console.error(`Apollo profile enrichment failed for ${contact.name}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log(`Enrichment result for ${contact.name}: ${data.person?.email ? 'Email found' : 'No email'}`);
      return data.person || null;

    } catch (error) {
      console.error(`Apollo profile enrichment error for ${contact.name}:`, error);
      return null;
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
            recruiter_confidence: candidate.recruiter_confidence
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
}

export const apolloService = new ApolloService();