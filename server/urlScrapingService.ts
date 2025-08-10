import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';

// Enable stealth mode to avoid bot detection
puppeteer.use(StealthPlugin());

export interface ScrapedJobData {
  title: string;
  content: string;
  cleanedContent: string;
  url: string;
  error?: string;
}

export class URLScrapingService {
  private browser: any = null;

  /**
   * Scrape job posting content from a URL
   */
  async scrapeJobURL(url: string): Promise<ScrapedJobData> {
    try {
      // Validate URL
      if (!this.isValidURL(url)) {
        throw new Error('Invalid URL format');
      }

      console.log(`Scraping job URL: ${url}`);

      // Try different scraping methods in order of preference
      let scrapedData: ScrapedJobData | null = null;

      // Method 1: Try Puppeteer for JavaScript-heavy sites
      try {
        scrapedData = await this.scrapeWithPuppeteer(url);
        if (scrapedData && (scrapedData.cleanedContent.length > 100 || scrapedData.title.includes('Product Manager'))) {
          console.log(`Puppeteer success: content=${scrapedData.cleanedContent.length} chars, title="${scrapedData.title}"`);
          return scrapedData;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log('Puppeteer scraping failed, trying cheerio:', errorMessage);
      }

      // Method 2: Try basic fetch + cheerio for static content
      try {
        scrapedData = await this.scrapeWithCheerio(url);
        if (scrapedData && (scrapedData.cleanedContent.length > 100 || scrapedData.title.includes('Product Manager'))) {
          console.log(`Cheerio success: content=${scrapedData.cleanedContent.length} chars, title="${scrapedData.title}"`);
          return scrapedData;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log('Cheerio scraping failed:', errorMessage);
      }

      // If we reach here, provide a helpful fallback instead of throwing error
      return {
        title: 'Job Position (URL provided)',
        content: `Job URL: ${url}\n\nUnable to automatically extract job details from this URL. Please copy and paste the job description text manually for best results with recruiter contact finding.`,
        cleanedContent: `Job URL: ${url}\n\nUnable to automatically extract job details from this URL. Please copy and paste the job description text manually for best results with recruiter contact finding.`,
        url,
        error: 'Unable to extract content automatically - manual input recommended'
      };

    } catch (error) {
      console.error('URL scraping error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to scrape URL';
      return {
        title: 'Job Position (URL provided)',
        content: `Job URL: ${url}\n\nUnable to automatically extract job details from this URL. Please copy and paste the job description text manually for best results with recruiter contact finding.`,
        cleanedContent: `Job URL: ${url}\n\nUnable to automatically extract job details from this URL. Please copy and paste the job description text manually for best results with recruiter contact finding.`,
        url,
        error: errorMessage
      };
    }
  }

  /**
   * Scrape using Puppeteer for JavaScript-rendered content
   */
  private async scrapeWithPuppeteer(url: string): Promise<ScrapedJobData> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true, // Use headless mode (changed from 'new' for compatibility)
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-features=VizDisplayCompositor',
          '--ignore-certificate-errors',
        ]
      });
    }

    const page = await this.browser.newPage();
    
    try {
      // Set realistic headers to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36');
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'DNT': '1',
      });

      // Smart request interception - block heavy resources but keep CSS/fonts for proper rendering
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const resourceType = req.resourceType();
        const url = req.url();
        
        // Block large images and media, but allow small images that might contain logos/text
        if (resourceType === 'image' && !url.includes('logo') && !url.includes('icon')) {
          return req.abort();
        }
        if (resourceType === 'media') {
          return req.abort();
        }
        // Allow fonts and stylesheets for proper rendering
        req.continue();
      });

      // Navigate with appropriate wait strategy
      console.log(`Navigating to: ${url}`);
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });

      // Strategy 1: Try to extract structured data (JSON-LD) first
      const structuredData = await this.extractStructuredData(page);
      if (structuredData) {
        console.log('Successfully extracted structured job data');
        return structuredData;
      }

      // Strategy 2: Handle known job board iframe patterns
      const frameData = await this.extractFromFrames(page, url);
      if (frameData) {
        console.log('Successfully extracted job data from iframe');
        return frameData;
      }

      // Strategy 3: Wait for dynamic content and extract using enhanced selectors
      await this.waitForJobContent(page);
      
      const title = await page.title();
      const content = await page.content();
      const cleanedContent = this.cleanHTML(content);

      // Enhanced title extraction if page title isn't helpful
      const enhancedTitle = await this.extractJobTitle(page) || title;

      return {
        title: enhancedTitle,
        content,
        cleanedContent,
        url
      };

    } finally {
      await page.close();
    }
  }

  /**
   * Scrape using Cheerio for static content
   */
  private async scrapeWithCheerio(url: string): Promise<ScrapedJobData> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const title = $('title').text() || '';
    const cleanedContent = this.cleanHTML(html);

    return {
      title,
      content: html,
      cleanedContent,
      url
    };
  }

  /**
   * Clean HTML content and extract meaningful text
   */
  private cleanHTML(html: string): string {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Extract title and meta description first for fallback
      const title = document.querySelector('title')?.textContent || '';
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      
      console.log(`Extracted title from HTML: "${title}"`);
      console.log(`Extracted meta description length: ${metaDescription.length}`);

      // Remove script and style elements
      const scripts = document.querySelectorAll('script, style, nav, header, footer, .nav, .header, .footer, .sidebar, .menu');
      scripts.forEach((el: Element) => el.remove());

      // Try to find main content areas - enhanced for job posting sites
      const contentSelectors = [
        'main',
        '[role="main"]',
        '.main-content',
        '.content',
        '.job-content',
        '.job-description',
        '.posting-content',
        '.position-description',
        '.job-description',
        '.job-details',
        '.posting',
        '.job-posting',
        '.job-content',
        '.position-description',
        'article',
        '.article'
      ];

      let mainContent = null;
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim().length > 200) {
          mainContent = element;
          break;
        }
      }

      // If no main content found, use body
      if (!mainContent) {
        mainContent = document.body;
      }

      // Extract text content
      let text = mainContent?.textContent || '';
      
      // Clean up the text
      text = text
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
        .trim();

      // Ensure we have meaningful content - combine with title and meta description if needed
      if (text.length < 200 && (title || metaDescription)) {
        // Combine title and meta description as structured content
        const structuredContent = [];
        if (title) structuredContent.push(`Job Title: ${title}`);
        if (metaDescription) structuredContent.push(`Job Description: ${metaDescription}`);
        if (text.length >= 50) structuredContent.push(`Additional Details: ${text}`);
        
        text = structuredContent.join('\n\n');
        console.log(`Enhanced content with title/meta, final length: ${text.length}`);
      } else if (text.length < 50) {
        // Final fallback: try to get any text from body
        text = document.body?.textContent || '';
        text = text.replace(/\s+/g, ' ').trim();
      }

      return text;

    } catch (error) {
      console.error('HTML cleaning error:', error);
      // Fallback: basic text extraction
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  /**
   * Validate URL format
   */
  private isValidURL(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  /**
   * Extract structured data (JSON-LD) from the page
   */
  private async extractStructuredData(page: Page): Promise<ScrapedJobData | null> {
    try {
      const jsonLD = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const jobPostings: any[] = [];
        
        for (let i = 0; i < scripts.length; i++) {
          const script = scripts[i];
          try {
            const data = JSON.parse(script.textContent || '');
            if (data['@type'] === 'JobPosting' || 
                (Array.isArray(data) && data.some((item: any) => item['@type'] === 'JobPosting'))) {
              jobPostings.push(data);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
        return jobPostings.length > 0 ? jobPostings : null;
      });

      if (jsonLD && jsonLD.length > 0) {
        const jobData = Array.isArray(jsonLD[0]) ? jsonLD[0].find((item: any) => item['@type'] === 'JobPosting') : jsonLD[0];
        
        if (jobData && jobData['@type'] === 'JobPosting') {
          const title = jobData.title || jobData.name || 'Job Position';
          const description = jobData.description || '';
          const company = jobData.hiringOrganization?.name || '';
          const location = jobData.jobLocation?.address?.addressLocality || 
                          jobData.jobLocation?.address?.addressRegion || '';
          
          const structuredContent = [
            title,
            company ? `Company: ${company}` : '',
            location ? `Location: ${location}` : '',
            description
          ].filter(Boolean).join('\n\n');

          return {
            title,
            content: JSON.stringify(jobData, null, 2),
            cleanedContent: structuredContent,
            url: page.url()
          };
        }
      }
      return null;
    } catch (error) {
      console.log('Structured data extraction failed:', error);
      return null;
    }
  }

  /**
   * Extract job data from known iframe patterns
   */
  private async extractFromFrames(page: Page, originalUrl: string): Promise<ScrapedJobData | null> {
    try {
      const knownFrameHosts = [
        'ashbyhq.com', 'workable.com', 'smartrecruiters.com', 
        'myworkdayjobs.com', 'greenhouse.io', 'lever.co',
        'bamboohr.com', 'icims.com', 'jobvite.com'
      ];

      // Get all frames on the page
      const frames = page.frames();
      
      for (const frame of frames) {
        const frameUrl = frame.url();
        const isKnownFrame = knownFrameHosts.some(host => frameUrl.includes(host));
        
        // Try to extract from known frames or any substantial iframe
        if (isKnownFrame || frameUrl !== originalUrl) {
          try {
            // Safely attempt to access frame content
            const frameContent = await frame.evaluate(() => {
              try {
                return {
                  title: document.title,
                  content: document.body?.textContent || '',
                  html: document.documentElement?.outerHTML || ''
                };
              } catch (e) {
                return null; // Cross-origin restriction
              }
            }).catch(() => null);

            if (frameContent && frameContent.content.length > 200) {
              console.log(`Successfully extracted from frame: ${frameUrl}`);
              return {
                title: frameContent.title || 'Job Position',
                content: frameContent.html,
                cleanedContent: this.cleanHTML(frameContent.html),
                url: originalUrl
              };
            }
          } catch (error) {
            // Frame access failed, continue to next
            continue;
          }
        }
      }
      return null;
    } catch (error) {
      console.log('Frame extraction failed:', error);
      return null;
    }
  }

  /**
   * Wait for job content to load dynamically
   */
  private async waitForJobContent(page: Page): Promise<void> {
    try {
      // Wait for one of these job-specific selectors to appear
      const jobSelectors = [
        '.job-description',
        '.job-content',
        '.posting-content',
        '.position-description',
        '.job-details',
        '[data-testid*="job"]',
        '[class*="job-description"]',
        '[class*="posting"]'
      ];

      await Promise.race([
        // Wait for specific content selectors
        page.waitForSelector(jobSelectors.join(', '), { timeout: 10000 }).catch(() => null),
        // Or wait with timeout
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);

      // Additional wait for React/Vue apps to hydrate
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log('Content waiting completed with timeout');
    }
  }

  /**
   * Enhanced job title extraction from various page elements
   */
  private async extractJobTitle(page: Page): Promise<string | null> {
    try {
      return await page.evaluate(() => {
        // Try multiple strategies to find job title
        const strategies = [
          // Strategy 1: Look for job-specific selectors
          () => document.querySelector('.job-title, .position-title, .posting-title, [data-testid*="job-title"]')?.textContent?.trim(),
          
          // Strategy 2: Look for h1 that contains job-related keywords
          () => {
            const h1s = document.querySelectorAll('h1');
            for (let i = 0; i < h1s.length; i++) {
              const h1 = h1s[i];
              const text = h1.textContent?.trim() || '';
              if (text.length > 10 && text.length < 100 && 
                  (text.includes('Engineer') || text.includes('Manager') || text.includes('Developer') || 
                   text.includes('Analyst') || text.includes('Designer') || text.includes('Specialist'))) {
                return text;
              }
            }
            return null;
          },

          // Strategy 3: Look for job title in meta tags
          () => document.querySelector('meta[property="og:title"], meta[name="title"]')?.getAttribute('content')?.trim(),

          // Strategy 4: Look for structured data
          () => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (let i = 0; i < scripts.length; i++) {
              const script = scripts[i];
              try {
                const data = JSON.parse(script.textContent || '');
                if (data['@type'] === 'JobPosting' && data.title) {
                  return data.title;
                }
              } catch (e) {}
            }
            return null;
          }
        ];

        for (const strategy of strategies) {
          const result = strategy();
          if (result && result.length > 5) {
            return result;
          }
        }
        return null;
      });
    } catch (error) {
      return null;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const urlScrapingService = new URLScrapingService();

// Cleanup on process exit
process.on('exit', () => {
  urlScrapingService.cleanup();
});

process.on('SIGINT', () => {
  urlScrapingService.cleanup();
  process.exit();
});

process.on('SIGTERM', () => {
  urlScrapingService.cleanup();
  process.exit();
});