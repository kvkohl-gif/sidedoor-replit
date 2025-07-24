export interface EmailVerificationResult {
  email: string;
  result: "valid" | "invalid" | "catchall" | "unknown" | "disposable";
  flags: string[];
  suggested_correction?: string;
  execution_time: number;
}

export interface VerificationStatus {
  is_valid: boolean;
  status_label: "Valid" | "Risky" | "Invalid" | "Unverified";
  status_icon: "✅" | "⚠️" | "❌" | "❓";
  should_include: boolean;
}

class VerifierService {
  private apiKey: string;
  private baseUrl = "https://api.neverbounce.com/v4";

  constructor() {
    this.apiKey = process.env.NEVERBOUNCE_API_KEY || "";
    if (!this.apiKey) {
      console.warn("NeverBounce API key not found in environment variables");
    }
  }

  async verifyEmail(email: string): Promise<EmailVerificationResult | null> {
    if (!this.apiKey) {
      console.warn(`NeverBounce API key missing - skipping verification for ${email}`);
      return null;
    }

    if (!email || !this.isValidEmailFormat(email)) {
      console.warn(`Invalid email format: ${email}`);
      return null;
    }

    try {
      console.log(`Verifying email: ${email}`);

      const params = new URLSearchParams({
        email: email,
        key: this.apiKey,
        address_info: "1"
      });

      const response = await fetch(`${this.baseUrl}/single/check?${params}`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "RecruiterFinder/1.0"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`NeverBounce API error (${response.status}):`, errorText);
        return null;
      }

      const data = await response.json();
      
      if (data.status !== "success") {
        console.error(`NeverBounce verification failed for ${email}:`, data);
        return null;
      }

      const result: EmailVerificationResult = {
        email: email,
        result: data.result,
        flags: data.flags || [],
        suggested_correction: data.suggested_correction,
        execution_time: data.execution_time || 0
      };

      console.log(`Email verification result for ${email}: ${data.result}`);
      return result;

    } catch (error) {
      console.error(`NeverBounce verification error for ${email}:`, error);
      return null;
    }
  }

  async verifyMultipleEmails(emails: string[]): Promise<Map<string, EmailVerificationResult | null>> {
    const results = new Map<string, EmailVerificationResult | null>();
    
    // Process emails in parallel with some rate limiting
    const batches = this.chunkArray(emails, 5); // Process 5 at a time
    
    for (const batch of batches) {
      const batchPromises = batch.map(email => 
        this.verifyEmail(email).then(result => ({ email, result }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const { email, result } of batchResults) {
        results.set(email, result);
      }
      
      // Small delay between batches to avoid rate limiting
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  getVerificationStatus(result: EmailVerificationResult | null): VerificationStatus {
    if (!result) {
      return {
        is_valid: false,
        status_label: "Unverified",
        status_icon: "❓",
        should_include: true // Include emails we couldn't verify
      };
    }

    switch (result.result) {
      case "valid":
        return {
          is_valid: true,
          status_label: "Valid",
          status_icon: "✅",
          should_include: true
        };
      
      case "catchall":
        return {
          is_valid: true,
          status_label: "Risky",
          status_icon: "⚠️",
          should_include: true // Include catchall emails per requirements
        };
      
      case "invalid":
        return {
          is_valid: false,
          status_label: "Invalid",
          status_icon: "❌",
          should_include: false
        };
      
      case "unknown":
      case "disposable":
      default:
        return {
          is_valid: false,
          status_label: "Invalid",
          status_icon: "❌",
          should_include: false
        };
    }
  }

  private isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // Basic email format validation as fallback
  validateEmailFormat(email: string): VerificationStatus {
    if (!email || !this.isValidEmailFormat(email)) {
      return {
        is_valid: false,
        status_label: "Invalid",
        status_icon: "❌",
        should_include: false
      };
    }

    // Basic validation passed - treat as unverified but valid format
    return {
      is_valid: true,
      status_label: "Unverified",
      status_icon: "❓",
      should_include: true
    };
  }
}

export const verifierService = new VerifierService();