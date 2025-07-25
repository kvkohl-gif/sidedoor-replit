import { verifierService } from "./verifierService";
import type { ProcessedContact } from "./apolloService";

export interface EmailPattern {
  pattern: string;
  examples: string[];
  confidence: number;
  description: string;
}

export interface InferredEmail {
  email: string;
  pattern: EmailPattern;
  confidence: number;
  verified: boolean;
  verification_status: "valid" | "risky" | "invalid" | "unknown";
}

export class EmailPatternInference {
  
  /**
   * Analyze existing emails from Apollo to detect company email patterns
   */
  async analyzeEmailPatterns(companyEmails: string[], companyDomain?: string): Promise<EmailPattern[]> {
    if (!companyEmails || companyEmails.length === 0) {
      return this.getCommonPatterns(companyDomain);
    }

    const patterns: { [key: string]: { count: number; examples: string[] } } = {};
    
    for (const email of companyEmails) {
      if (!email || !email.includes('@')) continue;
      
      const [localPart, domain] = email.split('@');
      const pattern = this.extractPattern(localPart);
      
      if (!patterns[pattern]) {
        patterns[pattern] = { count: 0, examples: [] };
      }
      
      patterns[pattern].count++;
      if (patterns[pattern].examples.length < 3) {
        patterns[pattern].examples.push(email);
      }
    }

    // Convert to EmailPattern objects and sort by confidence
    return Object.entries(patterns)
      .map(([pattern, data]) => ({
        pattern,
        examples: data.examples,
        confidence: Math.min(95, (data.count / companyEmails.length) * 100),
        description: this.getPatternDescription(pattern)
      }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate likely email addresses for a recruiter based on detected patterns
   */
  async inferRecruiterEmail(
    recruiterName: string, 
    companyDomain: string, 
    detectedPatterns: EmailPattern[]
  ): Promise<InferredEmail[]> {
    const nameParts = recruiterName.toLowerCase().trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    
    const patterns = detectedPatterns.length > 0 ? detectedPatterns : this.getCommonPatterns(companyDomain);
    const inferredEmails: InferredEmail[] = [];

    for (const pattern of patterns.slice(0, 3)) { // Try top 3 patterns
      const email = this.generateEmail(firstName, lastName, companyDomain, pattern.pattern);
      
      if (email) {
        // Verify the inferred email
        const verification = await this.verifyInferredEmail(email);
        
        inferredEmails.push({
          email,
          pattern,
          confidence: Math.round(pattern.confidence * 0.8), // Reduce confidence for inferred emails
          verified: verification.verified,
          verification_status: verification.status
        });
      }
    }

    return inferredEmails.sort((a, b) => b.confidence - a.confidence);
  }

  private extractPattern(localPart: string): string {
    // Remove numbers and special characters to detect pattern
    const cleaned = localPart.replace(/[0-9]/g, '').replace(/[._-]/g, '');
    
    // Try to identify common patterns
    if (localPart.includes('.')) {
      if (localPart.split('.').length === 2) {
        return 'first.last';
      }
      return 'first.middle.last';
    }
    
    if (localPart.includes('_')) {
      return 'first_last';
    }
    
    if (cleaned.length <= 4) {
      return 'firstinitial';
    }
    
    if (cleaned.length <= 8) {
      return 'firstlast';
    }
    
    return 'first';
  }

  private generateEmail(firstName: string, lastName: string, domain: string, pattern: string): string | null {
    if (!firstName || !domain) return null;

    const f = firstName.toLowerCase();
    const l = lastName.toLowerCase();
    const firstInitial = f.charAt(0);
    const lastInitial = l.charAt(0);

    switch (pattern) {
      case 'first.last':
        return l ? `${f}.${l}@${domain}` : null;
      case 'first_last':
        return l ? `${f}_${l}@${domain}` : null;
      case 'firstlast':
        return l ? `${f}${l}@${domain}` : null;
      case 'first':
        return `${f}@${domain}`;
      case 'firstinitial':
        return `${firstInitial}@${domain}`;
      case 'first.lastinitial':
        return l ? `${f}.${lastInitial}@${domain}` : null;
      case 'firstinitial.last':
        return l ? `${firstInitial}.${l}@${domain}` : null;
      default:
        return l ? `${f}.${l}@${domain}` : `${f}@${domain}`;
    }
  }

  private getPatternDescription(pattern: string): string {
    const descriptions: { [key: string]: string } = {
      'first.last': 'First name dot last name (e.g., john.smith)',
      'first_last': 'First name underscore last name (e.g., john_smith)',
      'firstlast': 'First and last name combined (e.g., johnsmith)',
      'first': 'First name only (e.g., john)',
      'firstinitial': 'First initial only (e.g., j)',
      'first.lastinitial': 'First name dot last initial (e.g., john.s)',
      'firstinitial.last': 'First initial dot last name (e.g., j.smith)'
    };
    
    return descriptions[pattern] || 'Custom pattern';
  }

  private getCommonPatterns(domain?: string): EmailPattern[] {
    return [
      {
        pattern: 'first.last',
        examples: domain ? [`john.smith@${domain}`, `jane.doe@${domain}`] : ['john.smith@company.com'],
        confidence: 80,
        description: 'First name dot last name (most common)'
      },
      {
        pattern: 'firstlast',
        examples: domain ? [`johnsmith@${domain}`, `janedoe@${domain}`] : ['johnsmith@company.com'],
        confidence: 60,
        description: 'First and last name combined'
      },
      {
        pattern: 'first',
        examples: domain ? [`john@${domain}`, `jane@${domain}`] : ['john@company.com'],
        confidence: 40,
        description: 'First name only'
      }
    ];
  }

  private async verifyInferredEmail(email: string): Promise<{ verified: boolean; status: "valid" | "risky" | "invalid" | "unknown" }> {
    if (!verifierService.isConfigured()) {
      return { verified: false, status: "unknown" };
    }

    try {
      const result = await verifierService.verifyEmail(email);
      if (!result) {
        return { verified: false, status: "unknown" };
      }
      
      const statusMapping: { [key: string]: "valid" | "risky" | "invalid" | "unknown" } = {
        "valid": "valid",
        "invalid": "invalid", 
        "disposable": "risky",
        "catchall": "risky",
        "unknown": "unknown"
      };
      
      const mappedStatus = statusMapping[result.result] || "unknown";
      return {
        verified: mappedStatus === "valid",
        status: mappedStatus
      };
    } catch (error) {
      console.error(`Email verification failed for ${email}:`, error);
      return { verified: false, status: "unknown" };
    }
  }
}

export const emailPatternInference = new EmailPatternInference();