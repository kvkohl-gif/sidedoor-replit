import { apolloService, type ProcessedContact } from "./apolloService";
import { verifierService, type EmailVerificationResult, type VerificationStatus } from "./verifierService";
import { analyzeEmailPatterns, type EmailSuggestion, type PatternAnalysisResult } from "./emailPatternService";
import { emailPatternInference, type InferredEmail, type EmailPattern } from "./emailPatternInference";
import { extractRecruiterName, type RecruiterNameExtraction } from "./openai";
import type { InsertRecruiterContact } from "@shared/schema";

export interface ContactSearchRequest {
  company_name: string;
  job_title?: string;
  location?: string;
  departments?: string[];
  job_content?: string; // New: for extracting recruiter names from job descriptions
}

export interface EnrichedContact {
  name: string;
  title: string;
  email?: string;
  linkedinUrl?: string;
  confidenceScore: number;
  source: string;
  emailVerified: boolean;
  verificationStatus: "valid" | "risky" | "invalid" | "unknown";
  sourcePlatform: string;
  apolloId?: string;
  recruiterConfidence: number;
  verificationData?: EmailVerificationResult;
  verificationStatusInfo?: VerificationStatus;
  isPrimaryRecruiter?: boolean; // New: indicates if this is the recruiter mentioned in job description
  inferredEmail?: InferredEmail; // New: for inferred emails using pattern analysis
}

export interface ContactSearchResult {
  contacts: EnrichedContact[];
  searchMetadata: {
    query: string;
    results_found: number;
    apollo_configured: boolean;
    neverbounce_configured: boolean;
    apollo_results: number;
    verified_emails: number;
  };
  emailPatterns?: PatternAnalysisResult;
}

export class EnhancedEnrichmentService {
  
  /**
   * Main function to search and enrich recruiter contacts using Apollo + NeverBounce
   */
  async searchAndEnrichContacts(request: ContactSearchRequest): Promise<ContactSearchResult> {
    console.log(`Starting enhanced contact search for ${request.company_name}`);
    
    const searchMetadata = {
      query: `${request.company_name} recruiters`,
      results_found: 0,
      apollo_configured: apolloService.isConfigured(),
      neverbounce_configured: verifierService.isConfigured(),
      apollo_results: 0,
      verified_emails: 0
    };

    // Step 1: Extract recruiter name mentioned in job description
    let recruiterFromJobDescription: RecruiterNameExtraction | null = null;
    if (request.job_content) {
      console.log("Extracting recruiter name from job description...");
      recruiterFromJobDescription = await extractRecruiterName(request.job_content);
      
      if (recruiterFromJobDescription.recruiter_name) {
        console.log(`Found recruiter in job description: ${recruiterFromJobDescription.recruiter_name} (${recruiterFromJobDescription.title})`);
      }
    }

    // Step 1: Test Apollo API connection first
    if (apolloService.isConfigured()) {
      console.log("Testing Apollo API connection...");
      const connectionTest = await apolloService.testApiConnection();
      console.log(`Apollo API connection test result: ${connectionTest}`);
    }

    // Step 2: Search Apollo for contacts (prioritizing specific recruiter if found)
    let apolloContacts: ProcessedContact[] = [];
    if (apolloService.isConfigured()) {
      try {
        apolloContacts = await apolloService.searchContacts({
          company_name: request.company_name,
          job_title: request.job_title,
          location: request.location,
          departments: request.departments,
          specific_recruiter_name: recruiterFromJobDescription?.recruiter_name || undefined
        });
        searchMetadata.apollo_results = apolloContacts.length;
        console.log(`Apollo returned ${apolloContacts.length} contacts`);
      } catch (error) {
        console.error("Apollo search failed:", error);
      }
    }

    // Step 3: Handle case where Apollo doesn't have specific recruiter's email
    let inferredEmails: InferredEmail[] = [];
    if (recruiterFromJobDescription?.recruiter_name && apolloContacts.length > 0) {
      // Check if any Apollo contact matches the recruiter from job description
      const primaryRecruiterContact = apolloContacts.find(contact => 
        contact.full_name.toLowerCase().includes(recruiterFromJobDescription!.recruiter_name!.toLowerCase())
      );

      // If we found the recruiter but they don't have a verified email, try to infer it
      if (primaryRecruiterContact && !primaryRecruiterContact.email) {
        console.log(`Primary recruiter found but no email - attempting pattern inference for ${primaryRecruiterContact.full_name}`);
        
        // Analyze email patterns from other contacts at the company
        const companyEmails = apolloContacts
          .filter(c => c.email && c.company_name === request.company_name)
          .map(c => c.email!);
        
        const companyDomain = this.extractCompanyDomain(request.company_name, companyEmails);
        
        if (companyDomain) {
          const emailPatterns = await emailPatternInference.analyzeEmailPatterns(companyEmails, companyDomain);
          inferredEmails = await emailPatternInference.inferRecruiterEmail(
            primaryRecruiterContact.full_name,
            companyDomain,
            emailPatterns
          );
          
          console.log(`Inferred ${inferredEmails.length} possible emails for ${primaryRecruiterContact.full_name}`);
        }
      }
    } else {
      console.warn("Apollo API not configured - skipping Apollo search");
    }

    // Step 2: Verify emails with NeverBounce (only real emails, not placeholders)
    const enrichedContacts: EnrichedContact[] = [];
    
    if (apolloContacts.length > 0) {
      // Filter out placeholder emails before verification
      const emailsToVerify = apolloContacts
        .filter(contact => contact.email) // Has email
        .map(contact => contact.email!);

      console.log(`Found ${apolloContacts.length} total contacts, ${emailsToVerify.length} with real emails`);

      let verificationResults = new Map<string, EmailVerificationResult | null>();
      
      if (verifierService.isConfigured() && emailsToVerify.length > 0) {
        try {
          verificationResults = await verifierService.verifyMultipleEmails(emailsToVerify);
          console.log(`Verified ${emailsToVerify.length} emails with NeverBounce`);
        } catch (error) {
          console.error("NeverBounce verification failed:", error);
        }
      } else if (emailsToVerify.length > 0) {
        console.warn("NeverBounce API not configured - using basic email validation");
      }

      // Step 3: Process and filter contacts
      for (const contact of apolloContacts) {
        const verificationResult = contact.email ? verificationResults.get(contact.email) ?? null : null;
        const verificationStatus = verifierService.getVerificationStatus(verificationResult, contact.email);
        
        console.log(`Processing contact: ${contact.full_name} - Email: ${contact.email || 'None'} - LinkedIn: ${contact.linkedin_url || 'None'} - Status: ${verificationStatus.status_label} - Should include: ${!contact.email || verificationStatus.should_include}`);
        
        // Include contacts with LinkedIn URL OR verified emails 
        if (!contact.email || verificationStatus.should_include || contact.linkedin_url) {
          const enrichedContact: EnrichedContact = {
            name: contact.full_name,
            title: contact.title,
            email: contact.email,
            linkedinUrl: contact.linkedin_url,
            confidenceScore: contact.recruiter_confidence,
            source: "Apollo + AI",
            emailVerified: verificationStatus.is_valid,
            verificationStatus: this.mapVerificationStatus(verificationStatus.status_label),
            sourcePlatform: "apollo",
            recruiterConfidence: contact.recruiter_confidence,
            verificationData: verificationResult || undefined,
            verificationStatusInfo: verificationStatus
          };

          enrichedContacts.push(enrichedContact);
          
          if (verificationStatus.is_valid) {
            searchMetadata.verified_emails++;
          }
        }
      }

      // Sort by recruiter confidence and email verification status
      enrichedContacts.sort((a, b) => {
        // Prioritize verified emails
        if (a.emailVerified && !b.emailVerified) return -1;
        if (!a.emailVerified && b.emailVerified) return 1;
        
        // Then by recruiter confidence
        return b.recruiterConfidence - a.recruiterConfidence;
      });

      // Take top 3 matches as specified in requirements
      const topContacts = enrichedContacts.slice(0, 3);
      
      searchMetadata.results_found = topContacts.length;
      
      console.log(`Returning ${topContacts.length} enriched contacts (${searchMetadata.verified_emails} with verified emails)`);
      
      // Step 4: Analyze email patterns for suggestions
      let emailPatterns: PatternAnalysisResult | undefined;
      
      if (topContacts.length > 0) {
        try {
          console.log("Analyzing email patterns with OpenAI...");
          const companyDomain = request.company_name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') + '.com';
          
          emailPatterns = await analyzeEmailPatterns(
            topContacts.map(c => ({
              name: c.name,
              email: c.email || '',
              verificationStatus: c.verificationStatus,
              emailVerified: c.emailVerified
            })),
            companyDomain
          );
          
          console.log(`Email pattern analysis completed: ${emailPatterns.suggestions.length} suggestions generated`);
        } catch (error) {
          console.error("Email pattern analysis failed:", error);
        }
      }
      
      return {
        contacts: topContacts,
        searchMetadata,
        emailPatterns
      };
    }

    // Fallback: No Apollo contacts found
    console.log("No contacts found from Apollo search");
    return {
      contacts: [],
      searchMetadata
    };
  }

  /**
   * Convert verification status to database enum
   */
  private mapVerificationStatus(statusLabel: string): "valid" | "risky" | "invalid" | "unknown" {
    switch (statusLabel) {
      case "Valid":
        return "valid";
      case "Risky":
        return "risky";
      case "Invalid":
        return "invalid";
      default:
        return "unknown";
    }
  }

  /**
   * Convert enriched contacts to database insert format
   */
  convertToInsertFormat(
    contacts: EnrichedContact[], 
    jobSubmissionId: number,
    emailSuggestions?: EmailSuggestion[]
  ): InsertRecruiterContact[] {
    return contacts.map(contact => {
      // Find email suggestion for this contact
      const suggestion = emailSuggestions?.find(s => 
        s.name === contact.name || s.original_email === contact.email
      );

      return {
        jobSubmissionId,
        name: contact.name,
        title: contact.title,
        email: contact.email,
        linkedinUrl: contact.linkedinUrl,
        confidenceScore: contact.confidenceScore,
        source: contact.source,
        emailVerified: contact.emailVerified ? "true" : "false",
        verificationStatus: contact.verificationStatus,
        sourcePlatform: contact.sourcePlatform,
        apolloId: contact.apolloId,
        recruiterConfidence: contact.recruiterConfidence,
        verificationData: contact.verificationData ? JSON.stringify(contact.verificationData) : null,
        suggestedEmail: suggestion?.suggested_email || null,
        emailSuggestionReasoning: suggestion?.confidence_reasoning || null,
      };
    });
  }

  /**
   * Get service status for debugging
   */
  getServiceStatus() {
    return {
      apollo_configured: apolloService.isConfigured(),
      neverbounce_configured: verifierService.isConfigured(),
      services_available: apolloService.isConfigured() || verifierService.isConfigured()
    };
  }

  /**
   * Extract company domain from company name or existing emails
   */
  private extractCompanyDomain(companyName: string, existingEmails: string[]): string | null {
    // First try to extract from existing emails
    if (existingEmails.length > 0) {
      const domainCounts: { [key: string]: number } = {};
      
      for (const email of existingEmails) {
        const domain = email.split('@')[1];
        if (domain) {
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        }
      }
      
      // Return most common domain
      const sortedDomains = Object.entries(domainCounts)
        .sort(([,a], [,b]) => b - a);
      
      if (sortedDomains.length > 0) {
        return sortedDomains[0][0];
      }
    }
    
    // Fallback: try to guess domain from company name
    const cleanName = companyName.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
    
    return `${cleanName}.com`;
  }
}

export const enhancedEnrichmentService = new EnhancedEnrichmentService();