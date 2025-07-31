import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';

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
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-features=VizDisplayCompositor',
        ]
      });
    }

    const page = await this.browser.newPage();
    
    try {
      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to the page
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Wait for content to load
      await page.waitForTimeout(2000);

      // Extract title and content
      const title = await page.title();
      const content = await page.content();

      const cleanedContent = this.cleanHTML(content);

      return {
        title,
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