import { supabaseAdmin as supabase } from "./lib/supabaseClient";
import { 
  type InsertContactEmailSupplemental,
  type InsertCompanyEmailPattern
} from "../shared/schema";
import { verifierService } from "./verifierService";

// Type for recruiter contact from Supabase
type RecruiterContact = {
  id: number;
  job_submission_id: number;
  name: string | null;
  email: string | null;
  title: string | null;
  linkedin_url: string | null;
  department: string | null;
  seniority: string | null;
  source: string | null;
  source_platform: string | null;
  confidence_score: number | null;
  recruiter_confidence: string | null;
  email_verified: string | null;
  verification_status: string | null;
  verification_data: any;
  apollo_id: string | null;
  suggested_email: string | null;
  email_suggestion_reasoning: string | null;
  contact_status: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  outreach_bucket: string | null;
  generated_email_message: string | null;
  generated_linkedin_message: string | null;
  email_draft: string | null;
  linkedin_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

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
      
      // 2. Find contacts with invalid Apollo emails only using Supabase
      const { data: invalidEmailContacts, error: contactsError } = await supabase
        .from('recruiter_contacts')
        .select('*')
        .eq('job_submission_id', jobSubmissionId)
        .eq('verification_status', 'invalid')
        .not('email', 'is', null)
        .not('name', 'is', null);
      
      if (contactsError) {
        console.error(`[SUPPLEMENTAL] Error fetching invalid contacts:`, contactsError);
        return;
      }
      
      console.log(`[SUPPLEMENTAL] Found ${invalidEmailContacts?.length || 0} contacts with invalid emails`);
      
      // 3. Generate pattern-inferred emails for invalid contacts only
      for (const contact of (invalidEmailContacts || [])) {
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
    
    // Get all VALID Apollo emails from this company using Supabase
    const { data: validContacts, error: validContactsError } = await supabase
      .from('recruiter_contacts')
      .select('*')
      .eq('job_submission_id', jobSubmissionId)
      .eq('verification_status', 'valid')
      .not('email', 'is', null)
      .not('name', 'is', null);
    
    if (validContactsError) {
      console.error(`[SUPPLEMENTAL] Error fetching valid contacts:`, validContactsError);
      return null;
    }
    
    if (!validContacts || validContacts.length < 2) {
      console.log(`[SUPPLEMENTAL] Need at least 2 valid emails for pattern analysis, found ${validContacts?.length || 0}`);
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
    
    // Store pattern analysis using Supabase
    const { data: analysis, error: insertError } = await supabase
      .from('company_email_patterns')
      .insert({
        job_submission_id: jobSubmissionId,
        company_domain: companyDomain,
        detected_pattern: topPattern.pattern,
        pattern_confidence: topPattern.confidence,
        valid_email_sample_count: validContacts.length,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error(`[SUPPLEMENTAL] Error storing pattern analysis:`, insertError);
      return null;
    }
    
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
    if (!contact.name || !patternAnalysis.company_domain) return;
    
    console.log(`[SUPPLEMENTAL] Generating email for ${contact.name} using pattern ${patternAnalysis.detected_pattern}`);
    
    // Generate candidate email using pattern
    const candidateEmail = this.generateEmailFromPattern(
      contact.name, 
      patternAnalysis.company_domain, 
      patternAnalysis.detected_pattern
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
      // Insert using Supabase with snake_case field mapping
      const { error: insertError } = await supabase
        .from('contact_emails_supplemental')
        .insert({
          recruiter_contact_id: contact.id,
          email_address: candidateEmail,
          email_type: 'pattern_inferred',
          verification_status: 'valid',
          verification_data: verification,
          confidence_score: patternAnalysis.pattern_confidence,
          pattern_reasoning: `Generated using ${patternAnalysis.detected_pattern} pattern from ${patternAnalysis.valid_email_sample_count} valid company emails`,
          is_verified: 'true',
        });
      
      if (insertError) {
        console.error(`[SUPPLEMENTAL] Error inserting supplemental email:`, insertError);
        return;
      }
      
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