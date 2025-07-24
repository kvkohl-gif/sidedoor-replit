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
    const recruiterKeywords = [
      { terms: ["recruiter", "recruitment"], weight: 1.0 },
      { terms: ["talent acquisition", "talent"], weight: 0.9 },
      { terms: ["people ops", "people operations"], weight: 0.8 },
      { terms: ["technical recruiter", "tech recruiter"], weight: 1.0 },
      { terms: ["hiring manager", "hiring"], weight: 0.7 },
      { terms: ["hr manager", "human resources"], weight: 0.6 },
      { terms: ["sourcr", "sourcing"], weight: 0.8 },
      { terms: ["people partner", "people team"], weight: 0.7 }
    ];

    const titleLower = title.toLowerCase();
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

    return { isRecruiter, confidence: maxConfidence };
  }

  async searchContacts(params: RecruiterSearchParams): Promise<ProcessedContact[]> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required. Please add APOLLO_API_KEY to your environment variables.");
    }

    try {
      // Build comprehensive search query using Apollo's correct field names and broader filters
      const companyDomain = this.extractDomain(params.company_name);
      const searchPayload = {
        // Use q_organization_domains which is more reliable than q_organization_name
        ...(companyDomain && { q_organization_domains: [companyDomain] }),
        // Also include organization name as backup
        q_organization_name: params.company_name,
        page: 1,
        per_page: 25,
        // Broader job title search with variations and partial matches
        person_titles: [
          "recruiter",
          "recruiting manager", 
          "talent acquisition",
          "talent acquisition manager",
          "talent acquisition partner",
          "ta partner",
          "technical recruiter",
          "senior recruiter", 
          "people ops",
          "people operations",
          "people operations manager",
          "hiring manager",
          "hr manager",
          "human resources",
          "people partner",
          "talent partner",
          "head of talent",
          "director of recruiting",
          "director of talent",
          "head of people",
          "sourcer",
          "talent sourcer",
          "people business partner",
          "hr business partner"
        ]
      };

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
      console.log(`Apollo returned ${data.contacts?.length || 0} contacts`);

      if (!data.contacts || data.contacts.length === 0) {
        console.log("No contacts in primary search, trying broader search...");
        return await this.tryBroaderSearch(params.company_name);
      }

      // Process and rank contacts by recruiter likelihood
      const processedContacts: ProcessedContact[] = data.contacts
        .filter(contact => contact.name && contact.title)
        .map(contact => {
          const { isRecruiter, confidence } = this.isRecruiterTitle(contact.title);
          
          return {
            full_name: contact.name,
            title: contact.title,
            email: contact.email,
            linkedin_url: contact.linkedin_url,
            company_name: contact.organization_name || params.company_name,
            is_recruiter_likely: isRecruiter,
            recruiter_confidence: confidence
          };
        })
        .sort((a, b) => {
          // Sort by recruiter confidence first, then by whether they have email
          if (a.recruiter_confidence !== b.recruiter_confidence) {
            return b.recruiter_confidence - a.recruiter_confidence;
          }
          if (a.email && !b.email) return -1;
          if (!a.email && b.email) return 1;
          return 0;
        })
        .slice(0, 10); // Take top 10 matches

      console.log(`Processed ${processedContacts.length} recruiter contacts`);
      return processedContacts;

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
          "X-Api-Key": this.apiKey
        },
        body: JSON.stringify({
          email: email
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
        // Minimal job title filters for broader results
        person_titles: [
          "recruiter", 
          "talent acquisition", 
          "hr", 
          "people ops",
          "hiring"
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
      
      if (!data.contacts || data.contacts.length === 0) {
        console.log("No contacts found even in broader search");
        return [];
      }

      // Process broader search results
      const processedContacts: ProcessedContact[] = data.contacts
        .filter(contact => contact.name && contact.title)
        .map(contact => {
          const { isRecruiter, confidence } = this.isRecruiterTitle(contact.title);
          
          return {
            full_name: contact.name,
            title: contact.title,
            email: contact.email,
            linkedin_url: contact.linkedin_url,
            company_name: contact.organization_name || companyName,
            is_recruiter_likely: isRecruiter,
            recruiter_confidence: confidence
          };
        })
        .sort((a, b) => b.recruiter_confidence - a.recruiter_confidence)
        .slice(0, 5);

      console.log(`Broader search returned ${processedContacts.length} contacts`);
      return processedContacts;

    } catch (error) {
      console.error("Broader Apollo search failed:", error);
      return [];
    }
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