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

  async searchContacts(params: RecruiterSearchParams): Promise<ProcessedContact[]> {
    if (!this.apiKey) {
      throw new Error("Apollo API key is required. Please add APOLLO_API_KEY to your environment variables.");
    }

    try {
      // Try a very basic search to test if Apollo API is working
      const companyDomain = this.extractDomain(params.company_name);
      
      // Try multiple search approaches to test Apollo API
      let searchPayload: any = {};
      
      // First try: organization name only (no domain)
      if (params.company_name) {
        searchPayload = {
          q_organization_name: params.company_name,
          page: 1,
          per_page: 10
        };
      }
      
      // If that fails, try with domain
      if (companyDomain && Object.keys(searchPayload).length === 0) {
        searchPayload = {
          q_organization_domains: [companyDomain],
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
        console.log("No contacts in primary search, trying broader search...");
        return await this.tryBroaderSearch(params.company_name);
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