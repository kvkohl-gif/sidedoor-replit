import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { extractRecruiterInfo, extractJobData } from "./openai";
import { enrichmentService, ContactEnrichmentService } from "./enrichmentService";
import { enhancedEnrichmentService } from "./enhancedEnrichmentService";
import { urlScrapingService } from "./urlScrapingService";
import { insertJobSubmissionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Job submission routes
  app.post("/api/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const submissionData = insertJobSubmissionSchema.parse({
        ...req.body,
        userId,
      });

      // Create initial job submission
      const jobSubmission = await storage.createJobSubmission(submissionData);

      // Process job input based on type
      let jobContent = submissionData.jobInput;
      let jobDataExtraction = null;

      // If URL, scrape the content first
      if (submissionData.inputType === "url") {
        console.log(`Scraping URL: ${submissionData.jobInput}`);
        const scrapedData = await urlScrapingService.scrapeJobURL(submissionData.jobInput);
        
        if (scrapedData.error) {
          throw new Error(`Failed to scrape URL: ${scrapedData.error}`);
        }
        
        jobContent = scrapedData.cleanedContent;
        console.log(`Scraped content length: ${jobContent.length} characters`);
        
        // Extract structured job data using enhanced prompt
        jobDataExtraction = await extractJobData(jobContent);
        console.log(`Extracted job data:`, jobDataExtraction);
      }

      // Extract recruiter information using OpenAI
      try {
        const extraction = await extractRecruiterInfo(
          jobContent, 
          submissionData.inputType as "text" | "url"
        );

        // Use enhanced job data if available, otherwise fall back to basic extraction
        const companyName = jobDataExtraction?.company_name || extraction.company_name;
        const jobTitle = jobDataExtraction?.job_title || extraction.job_title;

        // Update job submission with extracted data
        const updatedSubmission = await storage.updateJobSubmission(jobSubmission.id, {
          openaiResponseRaw: JSON.stringify({
            basic_extraction: extraction,
            enhanced_data: jobDataExtraction
          }),
          companyName,
          jobTitle,
          emailDraft: extraction.email_draft,
          linkedinMessage: extraction.linkedin_message,
        });

        // Apollo + NeverBounce Enhanced Search
        console.log(`Starting Apollo + NeverBounce enrichment for ${companyName}`);
        
        const apolloSearchResult = await enhancedEnrichmentService.searchAndEnrichContacts({
          company_name: companyName,
          job_title: jobTitle,
          location: jobDataExtraction?.location,
          departments: jobDataExtraction?.likely_departments
        });

        console.log(`Apollo search completed:`, apolloSearchResult.searchMetadata);

        let totalContactsAdded = 0;

        // Save Apollo contacts to database
        if (apolloSearchResult.contacts.length > 0) {
          const contactsToInsert = enhancedEnrichmentService.convertToInsertFormat(
            apolloSearchResult.contacts,
            updatedSubmission.id
          );

          for (const contact of contactsToInsert) {
            await storage.createRecruiterContact(contact);
            totalContactsAdded++;
          }
          
          console.log(`Saved ${apolloSearchResult.contacts.length} Apollo contacts to database`);
        }

        // Fallback to OpenAI-extracted contacts if Apollo didn't find anyone
        if (apolloSearchResult.contacts.length === 0 && extraction.recruiters && extraction.recruiters.length > 0) {
          console.log("No Apollo contacts found, using OpenAI-extracted contacts as fallback");
          
          const companyDomain = ContactEnrichmentService.extractDomain(companyName);
          const enrichedContacts = await enrichmentService.enrichContacts(extraction.recruiters, companyDomain);

          const recruiterContacts = enrichedContacts.map(contact => ({
            jobSubmissionId: updatedSubmission.id,
            name: contact.name,
            title: contact.title,
            email: contact.verifiedEmail || contact.email,
            linkedinUrl: contact.linkedinUrl,
            confidenceScore: extraction.recruiters.find(r => r.name === contact.name)?.confidence_score || 50,
            emailVerified: contact.emailVerified ? "true" : "false",
            verificationStatus: contact.verificationStatus,
            sourcePlatform: contact.sourcePlatform,
            recruiterConfidence: 0.6,
          }));

          for (const contact of recruiterContacts) {
            await storage.createRecruiterContact(contact);
            totalContactsAdded++;
          }
          
          console.log(`Saved ${recruiterContacts.length} OpenAI fallback contacts`);
        }

        console.log(`Total contacts added: ${totalContactsAdded}`);

        // Return the complete submission with recruiters
        const completeSubmission = await storage.getJobSubmissionById(jobSubmission.id);
        res.json(completeSubmission);

      } catch (openaiError) {
        console.error("OpenAI extraction error:", openaiError);
        // Update submission with error status but still return it
        const errorMessage = openaiError instanceof Error ? openaiError.message : "Unknown error";
        await storage.updateJobSubmission(jobSubmission.id, {
          openaiResponseRaw: JSON.stringify({ error: errorMessage }),
        });
        res.status(500).json({ 
          message: "Failed to extract recruiter information", 
          submissionId: jobSubmission.id 
        });
      }

    } catch (error) {
      console.error("Error creating submission:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid request data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create submission" });
      }
    }
  });

  app.get("/api/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const submissions = await storage.getJobSubmissionsByUser(userId);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  app.get("/api/submissions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const submissionId = parseInt(req.params.id);
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }

      const submission = await storage.getJobSubmissionById(submissionId);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Ensure user owns this submission
      if (submission.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(submission);
    } catch (error) {
      console.error("Error fetching submission:", error);
      res.status(500).json({ message: "Failed to fetch submission" });
    }
  });

  // Get enhanced job data for a submission
  app.get("/api/submissions/:id/job-data", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const submissionId = parseInt(req.params.id);
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }

      const submission = await storage.getJobSubmissionById(submissionId);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Ensure user owns this submission
      if (submission.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Parse the enhanced job data from openaiResponseRaw
      let enhancedData = null;
      if (submission.openaiResponseRaw) {
        try {
          const parsed = JSON.parse(submission.openaiResponseRaw);
          enhancedData = parsed.enhanced_data;
        } catch (error) {
          console.error("Error parsing enhanced data:", error);
        }
      }

      res.json({
        submissionId: submission.id,
        enhancedData,
        hasEnhancedData: !!enhancedData
      });
    } catch (error) {
      console.error("Error fetching enhanced job data:", error);
      res.status(500).json({ message: "Failed to fetch enhanced job data" });
    }
  });

  // API status endpoint for debugging
  app.get("/api/status", isAuthenticated, async (req, res) => {
    try {
      const serviceStatus = enhancedEnrichmentService.getServiceStatus();
      res.json({
        apollo: {
          configured: serviceStatus.apollo_configured,
          status: serviceStatus.apollo_configured ? "ready" : "api_key_missing"
        },
        neverbounce: {
          configured: serviceStatus.neverbounce_configured,
          status: serviceStatus.neverbounce_configured ? "ready" : "api_key_missing"
        },
        openai: {
          configured: !!process.env.OPENAI_API_KEY,
          status: !!process.env.OPENAI_API_KEY ? "ready" : "api_key_missing"
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching API status:", error);
      res.status(500).json({ message: "Failed to fetch API status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
