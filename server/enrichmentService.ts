export interface ContactEnrichment {
  name: string;
  title: string;
  company: string;
  email?: string;
  linkedinUrl?: string;
  verifiedEmail?: string;
  emailVerified: boolean;
  verificationStatus: 'valid' | 'risky' | 'invalid' | 'unknown';
  sourcePlatform: 'openai' | 'apollo' | 'zoominfo' | 'clay' | 'hunter';
}

export interface EmailVerificationResult {
  email: string;
  isValid: boolean;
  verificationStatus: 'valid' | 'risky' | 'invalid' | 'unknown';
  risk?: string;
  reason?: string;
}

export class ContactEnrichmentService {
  private apolloApiKey?: string;
  private hunterApiKey?: string;
  private zeroBouncApiKey?: string;

  constructor() {
    // These would be set from environment variables or user-provided API keys
    this.apolloApiKey = process.env.APOLLO_API_KEY;
    this.hunterApiKey = process.env.HUNTER_API_KEY;
    this.zeroBouncApiKey = process.env.ZEROBOUNCE_API_KEY;
  }

  /**
   * Main enrichment function that processes OpenAI-extracted contacts
   */
  async enrichContacts(contacts: any[], companyDomain: string): Promise<ContactEnrichment[]> {
    const enrichedContacts: ContactEnrichment[] = [];

    for (const contact of contacts) {
      try {
        const enriched = await this.enrichSingleContact(contact, companyDomain);
        
        // Only add contacts with valid email or LinkedIn
        if (enriched.verifiedEmail || enriched.linkedinUrl) {
          enrichedContacts.push(enriched);
        }
      } catch (error) {
        console.error(`Failed to enrich contact ${contact.name}:`, error);
        // Add original contact with unknown verification status
        enrichedContacts.push({
          name: contact.name,
          title: contact.title,
          company: companyDomain,
          email: contact.email,
          linkedinUrl: contact.linkedin_url,
          emailVerified: false,
          verificationStatus: 'unknown',
          sourcePlatform: 'openai',
        });
      }
    }

    return enrichedContacts;
  }

  /**
   * Enrich a single contact with email verification and additional data
   */
  private async enrichSingleContact(contact: any, companyDomain: string): Promise<ContactEnrichment> {
    let verifiedEmail = contact.email;
    let emailVerified = false;
    let verificationStatus: 'valid' | 'risky' | 'invalid' | 'unknown' = 'unknown';
    let sourcePlatform: 'openai' | 'apollo' | 'zoominfo' | 'clay' | 'hunter' = 'openai';

    // Step 1: Try to find verified email using enrichment services
    if (!verifiedEmail && this.apolloApiKey) {
      try {
        const apolloResult = await this.findEmailWithApollo(contact.name, contact.title, companyDomain);
        if (apolloResult?.email) {
          verifiedEmail = apolloResult.email;
          sourcePlatform = 'apollo';
        }
      } catch (error) {
        console.error('Apollo enrichment failed:', error);
      }
    }

    // Step 2: Try Hunter.io if Apollo didn't work
    if (!verifiedEmail && this.hunterApiKey) {
      try {
        const hunterResult = await this.findEmailWithHunter(contact.name, companyDomain);
        if (hunterResult?.email) {
          verifiedEmail = hunterResult.email;
          sourcePlatform = 'hunter';
        }
      } catch (error) {
        console.error('Hunter enrichment failed:', error);
      }
    }

    // Step 3: Verify the email if we have one
    if (verifiedEmail) {
      try {
        const verification = await this.verifyEmail(verifiedEmail);
        emailVerified = verification.isValid;
        verificationStatus = verification.verificationStatus;
      } catch (error) {
        console.error('Email verification failed:', error);
        verificationStatus = 'unknown';
      }
    }

    return {
      name: contact.name,
      title: contact.title,
      company: companyDomain,
      email: contact.email, // Original email from OpenAI
      verifiedEmail: verifiedEmail !== contact.email ? verifiedEmail : undefined,
      linkedinUrl: contact.linkedin_url,
      emailVerified,
      verificationStatus,
      sourcePlatform,
    };
  }

  /**
   * Find email using Apollo.io API
   */
  private async findEmailWithApollo(name: string, title: string, domain: string): Promise<{ email: string } | null> {
    if (!this.apolloApiKey) return null;

    try {
      // This is a placeholder implementation
      // In reality, you would make actual API calls to Apollo.io
      console.log(`Apollo enrichment for ${name} at ${domain} - API not implemented`);
      return null;
    } catch (error) {
      console.error('Apollo API error:', error);
      return null;
    }
  }

  /**
   * Find email using Hunter.io API
   */
  private async findEmailWithHunter(name: string, domain: string): Promise<{ email: string } | null> {
    if (!this.hunterApiKey) return null;

    try {
      // This is a placeholder implementation
      // In reality, you would make actual API calls to Hunter.io
      console.log(`Hunter enrichment for ${name} at ${domain} - API not implemented`);
      return null;
    } catch (error) {
      console.error('Hunter API error:', error);
      return null;
    }
  }

  /**
   * Verify email using ZeroBounce or similar service
   */
  private async verifyEmail(email: string): Promise<EmailVerificationResult> {
    if (!this.zeroBouncApiKey) {
      // Basic email format validation as fallback
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidFormat = emailRegex.test(email);
      
      return {
        email,
        isValid: isValidFormat,
        verificationStatus: isValidFormat ? 'unknown' : 'invalid',
        reason: isValidFormat ? 'Format validation only' : 'Invalid email format',
      };
    }

    try {
      // This is a placeholder implementation
      // In reality, you would make actual API calls to ZeroBounce, Mailboxlayer, etc.
      console.log(`Email verification for ${email} - API not implemented`);
      
      // For now, just return basic format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidFormat = emailRegex.test(email);
      
      return {
        email,
        isValid: isValidFormat,
        verificationStatus: isValidFormat ? 'unknown' : 'invalid',
        reason: 'Service not configured',
      };
    } catch (error) {
      console.error('Email verification error:', error);
      return {
        email,
        isValid: false,
        verificationStatus: 'unknown',
        reason: 'Verification failed',
      };
    }
  }

  /**
   * Extract company domain from company name or URL
   */
  static extractDomain(companyName: string): string {
    // Simple domain extraction logic
    // In reality, you might want more sophisticated company-to-domain mapping
    const cleaned = companyName.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/(inc|corp|llc|ltd|company|co)$/, '');
    
    return `${cleaned}.com`;
  }

  /**
   * Check if API keys are configured for enhanced features
   */
  hasEnrichmentCapabilities(): boolean {
    return !!(this.apolloApiKey || this.hunterApiKey);
  }

  hasVerificationCapabilities(): boolean {
    return !!this.zeroBouncApiKey;
  }
}

export const enrichmentService = new ContactEnrichmentService();