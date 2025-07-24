import { apolloService, type ProcessedContact } from "./apolloService";
import { verifierService, type EmailVerificationResult, type VerificationStatus } from "./verifierService";
import type { InsertRecruiterContact } from "@shared/schema";

export interface ContactSearchRequest {
  company_name: string;
  job_title?: string;
  location?: string;
  departments?: string[];
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

    // Step 1: Test Apollo API connection first
    if (apolloService.isConfigured()) {
      console.log("Testing Apollo API connection...");
      const connectionTest = await apolloService.testApiConnection();
      console.log(`Apollo API connection test result: ${connectionTest}`);
    }

    // Step 2: Search Apollo for contacts
    let apolloContacts: ProcessedContact[] = [];
    if (apolloService.isConfigured()) {
      try {
        apolloContacts = await apolloService.searchContacts({
          company_name: request.company_name,
          job_title: request.job_title,
          location: request.location,
          departments: request.departments
        });
        searchMetadata.apollo_results = apolloContacts.length;
        console.log(`Apollo returned ${apolloContacts.length} contacts`);
      } catch (error) {
        console.error("Apollo search failed:", error);
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
      
      return {
        contacts: topContacts,
        searchMetadata
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
    jobSubmissionId: number
  ): InsertRecruiterContact[] {
    return contacts.map(contact => ({
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
      verificationData: contact.verificationData ? JSON.stringify(contact.verificationData) : null
    }));
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
}

export const enhancedEnrichmentService = new EnhancedEnrichmentService();