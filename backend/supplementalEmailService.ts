import { db } from "./db";
import { eq, and, isNotNull } from "drizzle-orm";
import { 
  recruiterContacts, 
  contactEmailsSupplemental, 
  companyEmailPatterns,
  type RecruiterContact,
  type InsertContactEmailSupplemental,
  type InsertCompanyEmailPattern
} from "../shared/schema";
import { verifierService } from "./verifierService";

interface EmailPattern {
  pattern: string;
  confidence: number;
  frequency: number;
  examples: string[];
}

export class SupplementalEmailService {
  
  /**
   * Main entry point: Adds pattern-inferred emails for contacts with invalid Apollo emails
   * Runs AFTER all existing processing is complete
   */
  async addPatternInferredEmails(jobSubmissionId: number): Promise<void> {
    console.log(`[SUPPLEMENTAL] Starting pattern inference for job ${jobSubmissionId}`);
    
    try {
      // 1. Analyze company email patterns from VALID Apollo emails only
      const patternAnalysis = await this.analyzeCompanyEmailPatterns(jobSubmissionId);
      if (!patternAnalysis || !patternAnalysis.patternConfidence || patternAnalysis.patternConfidence < 0.7) {
        console.log(`[SUPPLEMENTAL] Pattern confidence too low (${patternAnalysis?.patternConfidence || 0}), skipping inference`);
        return;
      }
      
      // 2. Find contacts with invalid Apollo emails only
      const invalidEmailContacts = await db
        .select()
        .from(recruiterContacts)
        .where(
          and(
            eq(recruiterContacts.jobSubmissionId, jobSubmissionId),
            eq(recruiterContacts.verificationStatus, 'invalid'),
            isNotNull(recruiterContacts.email),
            isNotNull(recruiterContacts.name)
          )
        );
      
      console.log(`[SUPPLEMENTAL] Found ${invalidEmailContacts.length} contacts with invalid emails`);
      
      // 3. Generate pattern-inferred emails for invalid contacts only
      for (const contact of invalidEmailContacts) {
        await this.generateSupplementalEmailsForContact(contact, patternAnalysis);
      }
      
      console.log(`[SUPPLEMENTAL] Pattern inference completed for job ${jobSubmissionId}`);
      
    } catch (error) {
      console.error(`[SUPPLEMENTAL] Pattern inference failed for job ${jobSubmissionId}:`, error);
      // Don't throw - this is optional enhancement
    }
  }
  
  /**
   * Analyzes email patterns from valid Apollo emails in the same company
   */
  private async analyzeCompanyEmailPatterns(jobSubmissionId: number) {
    console.log(`[SUPPLEMENTAL] Analyzing email patterns for job ${jobSubmissionId}`);
    
    // Get all VALID Apollo emails from this company
    const validContacts = await db
      .select()
      .from(recruiterContacts)
      .where(
        and(
          eq(recruiterContacts.jobSubmissionId, jobSubmissionId),
          eq(recruiterContacts.verificationStatus, 'valid'),
          isNotNull(recruiterContacts.email),
          isNotNull(recruiterContacts.name)
        )
      );
    
    if (validContacts.length < 2) {
      console.log(`[SUPPLEMENTAL] Need at least 2 valid emails for pattern analysis, found ${validContacts.length}`);
      return null;
    }
    
    console.log(`[SUPPLEMENTAL] Analyzing patterns from ${validContacts.length} valid emails`);
    
    // Extract patterns from valid emails
    const emailAddresses = validContacts.map(c => c.email!);
    const patterns = this.extractEmailPatterns(emailAddresses, validContacts);
    
    if (patterns.length === 0) {
      console.log(`[SUPPLEMENTAL] No consistent patterns detected`);
      return null;
    }
    
    const topPattern = patterns[0];
    const companyDomain = this.extractDomain(emailAddresses[0]);
    
    // Store pattern analysis
    const [analysis] = await db
      .insert(companyEmailPatterns)
      .values({
        jobSubmissionId,
        companyDomain,
        detectedPattern: topPattern.pattern,
        patternConfidence: topPattern.confidence,
        validEmailSampleCount: validContacts.length,
      })
      .returning();
    
    console.log(`[SUPPLEMENTAL] Detected pattern: ${topPattern.pattern} (confidence: ${topPattern.confidence})`);
    
    return analysis;
  }
  
  /**
   * Generates supplemental emails for a single contact using pattern analysis
   */
  private async generateSupplementalEmailsForContact(
    contact: RecruiterContact, 
    patternAnalysis: any
  ) {
    if (!contact.name || !patternAnalysis.companyDomain) return;
    
    console.log(`[SUPPLEMENTAL] Generating email for ${contact.name} using pattern ${patternAnalysis.detectedPattern}`);
    
    // Generate candidate email using pattern
    const candidateEmail = this.generateEmailFromPattern(
      contact.name, 
      patternAnalysis.companyDomain, 
      patternAnalysis.detectedPattern
    );
    
    if (!candidateEmail) {
      console.log(`[SUPPLEMENTAL] Could not generate email for ${contact.name}`);
      return;
    }
    
    console.log(`[SUPPLEMENTAL] Generated candidate: ${candidateEmail}`);
    
    // Verify with NeverBounce
    const verification = await verifierService.verifyEmail(candidateEmail);
    const verificationStatus = verifierService.getVerificationStatus(verification, candidateEmail);
    
    // Only store if verification is valid
    if (verificationStatus.is_valid) {
      const supplementalEmail: InsertContactEmailSupplemental = {
        recruiterContactId: contact.id,
        emailAddress: candidateEmail,
        emailType: 'pattern_inferred',
        verificationStatus: 'valid',
        verificationData: verification,
        confidenceScore: patternAnalysis.patternConfidence,
        patternReasoning: `Generated using ${patternAnalysis.detectedPattern} pattern from ${patternAnalysis.validEmailSampleCount} valid company emails`,
        isVerified: 'true',
      };
      
      await db.insert(contactEmailsSupplemental).values(supplementalEmail);
      
      console.log(`[SUPPLEMENTAL] ✅ Added verified email ${candidateEmail} for ${contact.name}`);
    } else {
      console.log(`[SUPPLEMENTAL] ❌ Email ${candidateEmail} failed verification: ${verificationStatus.status_label}`);
    }
  }
  
  /**
   * Extracts email patterns from a list of valid emails
   */
  private extractEmailPatterns(emails: string[], contacts: RecruiterContact[]): EmailPattern[] {
    const patterns = new Map<string, { count: number; examples: string[] }>();
    
    emails.forEach((email, index) => {
      const contact = contacts[index];
      if (!contact.name) return;
      
      const [localPart, domain] = email.split('@');
      const pattern = this.inferPatternFromLocalPart(localPart, contact.name);
      
      if (pattern) {
        if (!patterns.has(pattern)) {
          patterns.set(pattern, { count: 0, examples: [] });
        }
        const patternData = patterns.get(pattern)!;
        patternData.count++;
        if (patternData.examples.length < 3) {
          patternData.examples.push(email);
        }
      }
    });
    
    return Array.from(patterns.entries())
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        confidence: data.count / emails.length,
        examples: data.examples
      }))
      .filter(p => p.confidence >= 0.5) // At least 50% of emails must match
      .sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Infers the pattern from a local part and contact name
   */
  private inferPatternFromLocalPart(localPart: string, contactName: string): string | null {
    const nameParts = this.parseContactName(contactName);
    const firstName = nameParts.firstName.toLowerCase();
    const lastName = nameParts.lastName.toLowerCase();
    
    // Remove dots, hyphens, underscores for pattern matching
    const cleanLocal = localPart.toLowerCase().replace(/[.\-_]/g, '');
    const cleanFirstName = firstName.replace(/[.\-_]/g, '');
    const cleanLastName = lastName.replace(/[.\-_]/g, '');
    
    // Check common patterns
    if (cleanLocal === cleanFirstName + cleanLastName) {
      if (localPart.includes('.')) return 'firstname.lastname';
      if (localPart.includes('_')) return 'firstname_lastname';
      return 'firstnamelastname';
    }
    
    if (cleanLocal === cleanFirstName.charAt(0) + cleanLastName) {
      if (localPart.includes('.')) return 'f.lastname';
      if (localPart.includes('_')) return 'f_lastname';
      return 'flastname';
    }
    
    if (cleanLocal === cleanFirstName + cleanLastName.charAt(0)) {
      if (localPart.includes('.')) return 'firstname.l';
      return 'firstnamel';
    }
    
    if (cleanLocal === cleanFirstName) {
      return 'firstname';
    }
    
    return null; // Pattern not recognized
  }
  
  /**
   * Generates an email using a detected pattern
   */
  private generateEmailFromPattern(contactName: string, domain: string, pattern: string): string | null {
    const nameParts = this.parseContactName(contactName);
    const firstName = nameParts.firstName.toLowerCase();
    const lastName = nameParts.lastName.toLowerCase();
    
    let localPart: string;
    
    switch (pattern) {
      case 'firstname.lastname':
        localPart = `${firstName}.${lastName}`;
        break;
      case 'firstname_lastname':
        localPart = `${firstName}_${lastName}`;
        break;
      case 'firstnamelastname':
        localPart = `${firstName}${lastName}`;
        break;
      case 'f.lastname':
        localPart = `${firstName.charAt(0)}.${lastName}`;
        break;
      case 'f_lastname':
        localPart = `${firstName.charAt(0)}_${lastName}`;
        break;
      case 'flastname':
        localPart = `${firstName.charAt(0)}${lastName}`;
        break;
      case 'firstname.l':
        localPart = `${firstName}.${lastName.charAt(0)}`;
        break;
      case 'firstnamel':
        localPart = `${firstName}${lastName.charAt(0)}`;
        break;
      case 'firstname':
        localPart = firstName;
        break;
      default:
        return null;
    }
    
    return `${localPart}@${domain}`;
  }
  
  /**
   * Parses contact name into first and last name components
   */
  private parseContactName(name: string): { firstName: string; lastName: string } {
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts[parts.length - 1] || '';
    
    return { firstName, lastName };
  }
  
  /**
   * Extracts domain from email address
   */
  private extractDomain(email: string): string {
    return email.split('@')[1] || '';
  }
}

// Export singleton instance
export const supplementalEmailService = new SupplementalEmailService();