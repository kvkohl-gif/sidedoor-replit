/**
 * Email Validation Guardrails - Prevents hallucination of non-existent emails
 * 
 * This module enforces strict validation to ensure we only display emails that:
 * 1. Come from verified Apollo API responses
 * 2. Pass domain validation checks
 * 3. Are explicitly marked with their source for transparency
 */

export interface ValidatedEmail {
  email: string;
  source: 'apollo_enrichment' | 'apollo_search' | 'none';
  verified: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

export interface EmailValidationResult {
  isValid: boolean;
  validatedEmail?: ValidatedEmail;
  rejectionReason?: string;
  warnings: string[];
}

/**
 * Strict email validation to prevent hallucination
 */
export class EmailValidationGuardrails {
  
  /**
   * Validate an email from Apollo API response
   */
  static validateApolloEmail(
    email: string | undefined | null,
    source: 'apollo_enrichment' | 'apollo_search',
    apolloResponse?: any
  ): EmailValidationResult {
    const warnings: string[] = [];
    
    // Reject undefined/null emails immediately
    if (!email || typeof email !== 'string') {
      return {
        isValid: false,
        rejectionReason: 'Email is null, undefined, or not a string',
        warnings
      };
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        isValid: false,
        rejectionReason: 'Email does not match valid email format',
        warnings
      };
    }

    // Reject obvious pattern-like emails that suggest inference rather than real data
    const suspiciousPatterns = [
      /^[a-z]+\.[a-z]+@[a-z]+\.com$/,  // firstname.lastname@company.com pattern
      /^[a-z]+_[a-z]+@[a-z]+\.com$/,   // firstname_lastname@company.com pattern
      /test|example|sample|demo/i,      // Test emails
      /noreply|no-reply/i               // No-reply emails
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(email)) {
        warnings.push(`Email matches suspicious pattern: ${pattern.toString()}`);
      }
    }

    // Verify the email came from Apollo's actual response data
    if (apolloResponse && !this.verifyEmailInApolloResponse(email, apolloResponse)) {
      return {
        isValid: false,
        rejectionReason: 'Email not found in Apollo API response data',
        warnings
      };
    }

    // Determine confidence based on source and Apollo response quality
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    
    if (source === 'apollo_enrichment' && apolloResponse?.email === email) {
      confidence = 'high';  // Direct enrichment match
    } else if (source === 'apollo_search' && apolloResponse?.email === email) {
      confidence = 'medium'; // Search result email
    } else {
      confidence = 'low';
      warnings.push('Email source verification incomplete');
    }

    return {
      isValid: true,
      validatedEmail: {
        email,
        source,
        verified: true,
        confidence
      },
      warnings
    };
  }

  /**
   * Verify that an email actually exists in the Apollo API response
   */
  private static verifyEmailInApolloResponse(email: string, apolloResponse: any): boolean {
    if (!apolloResponse) return false;
    
    // Check direct email field
    if (apolloResponse.email === email) return true;
    
    // Check in person object
    if (apolloResponse.person?.email === email) return true;
    
    // Check in email arrays if they exist
    if (Array.isArray(apolloResponse.emails)) {
      return apolloResponse.emails.includes(email);
    }
    
    if (Array.isArray(apolloResponse.person?.emails)) {
      return apolloResponse.person.emails.includes(email);
    }
    
    return false;
  }

  /**
   * Create a "no email found" result for transparency
   */
  static createNoEmailResult(reason: string): ValidatedEmail {
    return {
      email: '',
      source: 'none',
      verified: false,
      confidence: 'none'
    };
  }

  /**
   * Validate multiple emails and return only verified ones
   */
  static validateEmailBatch(
    emails: Array<{ email: string | undefined; source: 'apollo_enrichment' | 'apollo_search'; apolloResponse?: any }>
  ): ValidatedEmail[] {
    const validatedEmails: ValidatedEmail[] = [];
    
    for (const emailData of emails) {
      const result = this.validateApolloEmail(
        emailData.email,
        emailData.source,
        emailData.apolloResponse
      );
      
      if (result.isValid && result.validatedEmail) {
        validatedEmails.push(result.validatedEmail);
      } else {
        console.warn(`Email validation failed: ${result.rejectionReason}`, result.warnings);
      }
    }
    
    return validatedEmails;
  }

  /**
   * Log validation metrics for monitoring
   */
  static logValidationMetrics(
    contactName: string,
    validationResults: EmailValidationResult[]
  ): void {
    const validCount = validationResults.filter(r => r.isValid).length;
    const totalCount = validationResults.length;
    
    console.log(`Email validation for ${contactName}: ${validCount}/${totalCount} emails validated`);
    
    // Log rejections for monitoring
    validationResults
      .filter(r => !r.isValid)
      .forEach(r => {
        console.warn(`Email rejected for ${contactName}: ${r.rejectionReason}`);
      });
  }
}

/**
 * Helper function to safely extract email from Apollo response
 */
export function safeExtractApolloEmail(apolloResponse: any): string | undefined {
  if (!apolloResponse) return undefined;
  
  // Try different possible locations for email in Apollo response
  return apolloResponse.email || 
         apolloResponse.person?.email || 
         apolloResponse.work_email ||
         apolloResponse.person?.work_email ||
         undefined;
}

/**
 * Type guard to ensure we only work with validated emails
 */
export function isValidatedEmail(email: any): email is ValidatedEmail {
  return email && 
         typeof email === 'object' && 
         typeof email.email === 'string' && 
         typeof email.source === 'string' && 
         typeof email.verified === 'boolean';
}