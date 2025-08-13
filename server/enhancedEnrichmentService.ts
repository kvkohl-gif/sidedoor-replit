import { apolloService, type ProcessedContact } from "./apolloService";
import { verifierService, type EmailVerificationResult, type VerificationStatus } from "./verifierService";
import { analyzeEmailPatterns, type EmailSuggestion, type PatternAnalysisResult } from "./emailPatternService";
import { emailPatternInference, type InferredEmail, type EmailPattern } from "./emailPatternInference";
import { extractRecruiterName, generateTwoBucketTargets, type RecruiterNameExtraction, type TwoBucketTargets } from "./openai";
import { EmailValidationGuardrails, ValidatedEmail } from "./emailValidationGuardrails";
import type { InsertRecruiterContact } from "@shared/schema";

export interface ContactSearchRequest {
  company_name: string;
  job_title?: string;
  location?: string;
  departments?: string[];
  job_content?: string; // New: for extracting recruiter names from job descriptions
  job_country?: string; // New: country where job is located
  job_region?: string; // New: state/region where job is located  
  company_hq_country?: string; // New: company headquarters country
  remote_hiring_countries?: string[]; // New: countries where company hires remotely
  organization_id?: string; // New: Apollo organization ID for precise matching
  website_url?: string; // New: company website URL for domain filtering
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
  outreachBucket: "recruiter" | "department_lead"; // New: two-bucket classification
  department?: string; // New: department for department_lead bucket
  seniority?: string; // New: seniority level for department_lead bucket
  emailValidation?: ValidatedEmail; // New: email validation guardrail results
}

export interface ContactSearchResult {
  contacts: EnrichedContact[];
  recruiter_contacts: EnrichedContact[];
  department_lead_contacts: EnrichedContact[];
  searchMetadata: {
    query: string;
    results_found: number;
    apollo_configured: boolean;
    neverbounce_configured: boolean;
    apollo_results: number;
    verified_emails: number;
    two_bucket_strategy: TwoBucketTargets;
  };
  emailPatterns?: PatternAnalysisResult;
}

export class EnhancedEnrichmentService {
  
  /**
   * Main function to search and enrich contacts using two-bucket approach
   */
  async searchAndEnrichContacts(request: ContactSearchRequest): Promise<ContactSearchResult> {
    console.log(`Starting enhanced contact search for ${request.company_name}`);
    
    // Generate two-bucket targets based on job title
    const twoBucketTargets = await generateTwoBucketTargets(request.job_title || "Unknown Position");
    
    const searchMetadata = {
      query: `${request.company_name} recruiters and department leads`,
      results_found: 0,
      apollo_configured: apolloService.isConfigured(),
      neverbounce_configured: verifierService.isConfigured(),
      apollo_results: 0,
      verified_emails: 0,
      two_bucket_strategy: twoBucketTargets
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

    // Step 2: Search Apollo using two-bucket approach (3 recruiters + 3 department leads)
    let recruiterContacts: ProcessedContact[] = [];
    let departmentLeadContacts: ProcessedContact[] = [];
    
    if (apolloService.isConfigured()) {
      try {
        // Search for recruiting contacts (2 contacts)
        console.log("Searching for recruiting contacts...");
        recruiterContacts = await apolloService.searchRecruitingContacts({
          company_name: request.company_name,
          job_title: request.job_title,
          location: request.location,
          specific_recruiter_name: recruiterFromJobDescription?.recruiter_name || undefined,
          job_country: request.job_country,
          job_region: request.job_region,
          company_hq_country: request.company_hq_country,
          remote_hiring_countries: request.remote_hiring_countries,
          per_page: 3, // Get 3 recruiting contacts
          organization_id: request.organization_id,
          website_url: request.website_url
        });
        
        // Search for department lead contacts (3 contacts)
        console.log("Searching for department lead contacts...");
        departmentLeadContacts = await apolloService.searchDepartmentLeads({
          company_name: request.company_name,
          job_title: request.job_title,
          location: request.location,
          department: twoBucketTargets.department_lead_contacts.primary_department,
          titles: twoBucketTargets.department_lead_contacts.titles,
          seniorities: twoBucketTargets.department_lead_contacts.seniorities,
          job_country: request.job_country,
          job_region: request.job_region,
          company_hq_country: request.company_hq_country,
          remote_hiring_countries: request.remote_hiring_countries,
          per_page: 3, // Get 3 department leads
          organization_id: request.organization_id,
          website_url: request.website_url
        });
        
        // Process all contacts from both searches
        
      } catch (error) {
        console.error("Apollo search failed:", error);
      }
    } else {
      console.warn("Apollo API not configured - skipping Apollo search");
    }

    // Combine all contacts for processing
    const apolloContacts = [...recruiterContacts, ...departmentLeadContacts];
    searchMetadata.apollo_results = apolloContacts.length;
    console.log(`Apollo returned ${recruiterContacts.length} recruiting contacts + ${departmentLeadContacts.length} department leads = ${apolloContacts.length} total`);

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
    }

    // Step 2: Annotate emails with NeverBounce status (don't filter - show all with status badges)
    const enrichedContacts: EnrichedContact[] = [];
    
    if (apolloContacts.length > 0) {
      // Get emails for verification (Domain-filtered Apollo contacts now only have company emails)
      const emailsToVerify = apolloContacts
        .filter(contact => contact.email) // Has email
        .map(contact => contact.email!);

      console.log(`Found ${apolloContacts.length} total contacts, ${emailsToVerify.length} with company domain emails`);

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

      // Step 3: Process contacts (include all with NeverBounce status annotation)
      for (const contact of apolloContacts) {
        const verificationResult = contact.email ? verificationResults.get(contact.email) ?? null : null;
        const verificationStatus = verifierService.getVerificationStatus(verificationResult, contact.email);
        
        // Apply email validation guardrails
        const emailValidation = contact.email ? 
          EmailValidationGuardrails.validateApolloEmail(
            contact.email,
            'apollo_search',
            contact
          ) : null;
        
        // Only use validated emails to prevent hallucination
        const validatedEmail = emailValidation?.isValid ? emailValidation.validatedEmail?.email : undefined;
        
        // Simplify outreach bucket determination - use title-based detection
        const titleLower = contact.title.toLowerCase();
        const isRecruiter = titleLower.includes('recruiter') || titleLower.includes('talent acquisition') || titleLower.includes('talent sourcing') || titleLower.includes('recruiting');
        const outreachBucket = isRecruiter ? "recruiter" : "department_lead";
        const department = isRecruiter ? undefined : twoBucketTargets.department_lead_contacts.primary_department;
        const seniority = isRecruiter ? undefined : this.extractSeniority(contact.title);
        
        console.log(`Processing contact: ${contact.full_name} - Email: ${validatedEmail || 'None (validation failed)'} - LinkedIn: ${contact.linkedin_url || 'None'} - Bucket: ${outreachBucket} - Status: ${verificationStatus.status_label} - Validation: ${emailValidation?.isValid ? 'PASSED' : 'FAILED'}`);
        
        // Include ALL contacts (domain filtering already ensured company emails only)
        const enrichedContact: EnrichedContact = {
          name: contact.full_name,
          title: contact.title,
          email: validatedEmail, // Use validated email to prevent hallucination
          linkedinUrl: contact.linkedin_url,
          confidenceScore: contact.recruiter_confidence,
          source: "Apollo + AI",
          emailVerified: verificationStatus.is_valid && !!validatedEmail,
          verificationStatus: this.mapVerificationStatus(verificationStatus.status_label),
          sourcePlatform: "apollo",
          recruiterConfidence: contact.recruiter_confidence,
          verificationData: verificationResult || undefined,
          verificationStatusInfo: verificationStatus,
          outreachBucket,
          department,
          seniority,
          emailValidation: emailValidation?.validatedEmail // Store validation metadata
        };

        enrichedContacts.push(enrichedContact);
        
        if (verificationStatus.is_valid) {
          searchMetadata.verified_emails++;
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
      
      // Step 4: Try email pattern inference for contacts without real emails
      const contactsWithoutEmails = topContacts.filter(c => !c.email);
      
      if (contactsWithoutEmails.length > 0) {
        console.log(`Found ${contactsWithoutEmails.length} contacts without real emails - attempting email pattern inference`);
        
        // Extract company domain from company name or website
        const companyDomain = this.extractCompanyDomain(request.company_name, []);
        
        if (companyDomain) {
          for (const contact of contactsWithoutEmails) {
            try {
              // Use email pattern inference to suggest emails
              const emailPatterns = await emailPatternInference.analyzeEmailPatterns([], companyDomain);
              const inferredEmails = await emailPatternInference.inferRecruiterEmail(
                contact.name,
                companyDomain,
                emailPatterns
              );
              
              if (inferredEmails.length > 0) {
                const bestInferredEmail = inferredEmails[0];
                console.log(`Inferred email for ${contact.name}: ${bestInferredEmail.email} (confidence: ${bestInferredEmail.confidence})`);
                
                // Add the inferred email to the contact
                contact.email = bestInferredEmail.email;
                contact.inferredEmail = bestInferredEmail;
                contact.source = "Apollo + Email Pattern Inference";
                
                // Verify the inferred email
                if (verifierService.isConfigured()) {
                  const verificationResult = await verifierService.verifyEmail(bestInferredEmail.email);
                  const verificationStatus = verifierService.getVerificationStatus(verificationResult, bestInferredEmail.email);
                  
                  contact.emailVerified = verificationStatus.is_valid;
                  contact.verificationStatus = this.mapVerificationStatus(verificationStatus.status_label);
                  contact.verificationData = verificationResult || undefined;
                  contact.verificationStatusInfo = verificationStatus;
                }
              }
            } catch (error) {
              console.error(`Email pattern inference failed for ${contact.name}:`, error);
            }
          }
        }
      }

      // Step 5: Analyze email patterns for suggestions
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
      
      // Split contacts into two buckets
      const recruiterContacts = topContacts.filter(c => c.outreachBucket === "recruiter");
      const departmentLeadContacts = topContacts.filter(c => c.outreachBucket === "department_lead");
      
      return {
        contacts: topContacts,
        recruiter_contacts: recruiterContacts,
        department_lead_contacts: departmentLeadContacts,
        searchMetadata,
        emailPatterns
      };
    }

    // Fallback: No Apollo contacts found
    console.log("No contacts found from Apollo search");
    return {
      contacts: [],
      recruiter_contacts: [],
      department_lead_contacts: [],
      searchMetadata
    };
  }

  /**
   * Extract seniority level from job title
   */
  private extractSeniority(title: string): string | undefined {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('director') || titleLower.includes('vp') || titleLower.includes('vice president')) {
      return 'Director';
    } else if (titleLower.includes('senior') || titleLower.includes('sr.') || titleLower.includes('lead')) {
      return 'Senior';
    } else if (titleLower.includes('manager') || titleLower.includes('head')) {
      return 'Manager';
    } else if (titleLower.includes('junior') || titleLower.includes('jr.') || titleLower.includes('associate')) {
      return 'Junior';
    }
    
    return undefined;
  }

  /**
   * Check if an email is a placeholder from Apollo API
   */
  private isPlaceholderEmail(email: string): boolean {
    const placeholderPatterns = [
      'email_not_unlocked@domain.com',
      'email_not_unlocked@',
      'placeholder@',
      'noemail@',
      'hidden@'
    ];
    
    return placeholderPatterns.some(pattern => email.includes(pattern));
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
        outreachBucket: contact.outreachBucket,
        department: contact.department,
        seniority: contact.seniority,
      };
    });
  }

  /**
   * Extract seniority level from job title
   */
  private extractSeniority(title: string): string {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('ceo') || titleLower.includes('cto') || titleLower.includes('cfo') || titleLower.includes('cmo') || titleLower.includes('chief')) {
      return 'c_suite';
    }
    if (titleLower.includes('vp') || titleLower.includes('vice president')) {
      return 'vp';
    }
    if (titleLower.includes('head') || titleLower.includes('director')) {
      return 'director';
    }
    if (titleLower.includes('manager') || titleLower.includes('lead')) {
      return 'manager';
    }
    
    return 'individual_contributor';
  }

  /**
   * Extract company domain from company name or existing emails
   */
  private extractCompanyDomain(companyName: string, existingEmails: string[]): string | null {
    // Try to get domain from existing emails first
    if (existingEmails.length > 0) {
      const emailDomains = existingEmails.map(email => email.split('@')[1]).filter(Boolean);
      if (emailDomains.length > 0) {
        // Return the most common domain
        const domainCounts: Record<string, number> = {};
        emailDomains.forEach(domain => {
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        });
        
        return Object.entries(domainCounts)
          .sort(([, a], [, b]) => b - a)[0][0];
      }
    }
    
    // Fallback: guess domain from company name
    const cleanName = companyName.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
    
    return `${cleanName}.com`;
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