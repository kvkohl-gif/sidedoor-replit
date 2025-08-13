// Domain filtering rules for preventing email contamination
export type DomainRules = {
  canonical: string;
  aliases: string[];
  personalBlocks: string[];
};

export function hostToDomain(url = ""): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

export function emailDomain(email?: string): string {
  return (email || "").toLowerCase().split("@")[1] || "";
}

export function isCompanyDomain(dom: string, rules: DomainRules): boolean {
  const d = dom.toLowerCase();
  return d === rules.canonical || rules.aliases.includes(d);
}

export function buildDomainRules(companyName: string, websiteUrl?: string): DomainRules {
  // First try to extract from website URL
  let canonical = "";
  if (websiteUrl) {
    canonical = hostToDomain(websiteUrl);
  }
  
  // Fallback to company name mapping if no website or extraction failed
  if (!canonical || canonical.length < 3) {
    canonical = getCanonicalDomainFromCompanyName(companyName);
  }
  
  return {
    canonical,
    aliases: [canonical], // Can be extended with legitimate alternates
    personalBlocks: [
      "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
      "aol.com", "protonmail.com", "mail.com", "live.com", "msn.com"
    ]
  };
}

function getCanonicalDomainFromCompanyName(companyName: string): string {
  if (!companyName) return "";
  
  const name = companyName.toLowerCase().trim();
  
  // Direct company name to domain mapping
  const domainMappings: Record<string, string> = {
    'aha!': 'aha.io',
    'aha': 'aha.io',
    'dropbox': 'dropbox.com',
    'google': 'google.com',
    'microsoft': 'microsoft.com',
    'apple': 'apple.com',
    'meta': 'meta.com',
    'facebook': 'meta.com',
    'amazon': 'amazon.com',
    'netflix': 'netflix.com',
    'spotify': 'spotify.com',
    'uber': 'uber.com',
    'airbnb': 'airbnb.com',
    'stripe': 'stripe.com',
    'slack': 'slack.com',
    'zoom': 'zoom.us',
    'salesforce': 'salesforce.com',
    'adobe': 'adobe.com',
    'tesla': 'tesla.com',
    'twitter': 'twitter.com',
    'linkedin': 'linkedin.com'
  };
  
  // Check direct mappings first
  if (domainMappings[name]) {
    return domainMappings[name];
  }
  
  // For other companies, try to infer the domain
  // Remove common suffixes and special characters
  let cleanName = name
    .replace(/\s*(inc|llc|ltd|corp|corporation|company|co)\s*\.?\s*$/i, '')
    .replace(/[^a-z0-9]/g, '');
  
  // If the clean name looks reasonable, assume .com domain
  if (cleanName.length >= 2 && cleanName.length <= 20) {
    return `${cleanName}.com`;
  }
  
  return "";
}