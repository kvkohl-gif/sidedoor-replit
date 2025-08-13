import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { registerContactRoutes } from "./routes/contacts";
import OpenAI from "openai";
import { extractRecruiterInfo, extractJobData, extractApolloSearchParams } from "./openai";
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

  // Active run IDs for session-based duplicate prevention
  const activeRuns = new Map<string, { userId: string; startTime: number }>();

  // Job submission routes
  app.post("/api/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { runId } = req.body;

      // Validate runId is provided
      if (!runId) {
        return res.status(400).json({ message: "Run ID is required for input locking protection" });
      }

      // Check if this runId is already active for this user
      if (activeRuns.has(runId)) {
        const activeRun = activeRuns.get(runId);
        if (activeRun?.userId === userId) {
          return res.status(409).json({ 
            message: "Duplicate submission - analysis already in progress",
            runId 
          });
        }
      }

      // Check if user has any other active runs (prevent multiple simultaneous runs per user)
      const userActiveRuns = Array.from(activeRuns.entries()).filter(([_, run]) => run.userId === userId);
      if (userActiveRuns.length > 0) {
        return res.status(429).json({ 
          message: "Another analysis is already running. Please wait for it to complete.",
          activeRunId: userActiveRuns[0][0]
        });
      }

      // Register the run as active
      activeRuns.set(runId, { userId, startTime: Date.now() });
      
      // Validate request body
      const submissionData = insertJobSubmissionSchema.parse({
        ...req.body,
        userId,
      });

      // Extract organization_id and company_domain from request if provided
      const { organizationId = null, companyDomain = null } = req.body;

      // Create initial job submission
      const jobSubmission = await storage.createJobSubmission(submissionData);

      // Process job input based on type
      let jobContent = submissionData.jobInput;
      let jobDataExtraction = null;

      // Extract structured job data for both URL and text inputs
      if (submissionData.inputType === "url") {
        console.log(`Scraping URL: ${submissionData.jobInput}`);
        const scrapedData = await urlScrapingService.scrapeJobURL(submissionData.jobInput);
        
        if (scrapedData.error || !scrapedData.cleanedContent || scrapedData.cleanedContent.length < 50) {
          // Continue with what we have rather than failing completely
          console.log('URL scraping had issues, using fallback content:', scrapedData.error);
          jobContent = scrapedData.cleanedContent || `Job URL: ${submissionData.jobInput}\n\nPlease manually paste the job description for better recruiter finding results.`;
        } else {
          jobContent = scrapedData.cleanedContent;
        }
        
        console.log(`Content length: ${jobContent.length} characters`);
        console.log(`First 500 chars of scraped content:`, jobContent.substring(0, 500));
        
        // Debug: Check if we got title from URL
        if (scrapedData.title) {
          console.log(`Extracted page title: "${scrapedData.title}"`);
        }
        
        // Extract structured job data using standardized prompt format
        jobDataExtraction = await extractJobData(jobContent, submissionData.jobInput);
        console.log(`Extracted job data:`, JSON.stringify(jobDataExtraction, null, 2));
      } else {
        // For text input, also extract structured job data
        console.log(`Processing text input for structured data extraction`);
        jobDataExtraction = await extractJobData(jobContent);
        console.log(`Extracted job data from text:`, jobDataExtraction);
      }

      // Extract recruiter information using OpenAI
      try {
        const extraction = await extractRecruiterInfo(
          jobContent, 
          submissionData.inputType as "text" | "url"
        );

        // Use enhanced job data if available, otherwise fall back to basic extraction
        // CRITICAL FIX: Don't let "Not specified" override real data
        const companyName = (jobDataExtraction?.company_name && jobDataExtraction.company_name !== "Not specified") 
          ? jobDataExtraction.company_name 
          : extraction.company_name;
        const jobTitle = (jobDataExtraction?.job_title && jobDataExtraction.job_title !== "Not specified") 
          ? jobDataExtraction.job_title 
          : extraction.job_title;

        // Update job submission with extracted data and organization info
        const updatedSubmission = await storage.updateJobSubmission(jobSubmission.id, {
          openaiResponseRaw: JSON.stringify({
            basic_extraction: extraction,
            enhanced_data: jobDataExtraction
          }),
          companyName,
          jobTitle,
          organizationId: organizationId,
          companyDomain: companyDomain,
          emailDraft: extraction.email_draft,
          linkedinMessage: extraction.linkedin_message,
        });

        // Extract optimized Apollo search parameters
        console.log(`Extracting Apollo search parameters for ${companyName}`);
        const apolloParams = await extractApolloSearchParams(jobContent);
        console.log(`Apollo search params:`, apolloParams);

        // Apollo + NeverBounce Enhanced Search
        console.log(`Starting Apollo + NeverBounce enrichment for ${companyName}`);
        
        const apolloSearchResult = await enhancedEnrichmentService.searchAndEnrichContacts({
          company_name: apolloParams.company_name || companyName,
          job_title: apolloParams.job_title || jobTitle,
          location: apolloParams.location || jobDataExtraction?.location,
          departments: apolloParams.fallback_departments || jobDataExtraction?.likely_departments,
          job_content: jobContent, // Pass job content for recruiter name extraction
          job_country: apolloParams.job_country,
          job_region: apolloParams.job_region,
          company_hq_country: apolloParams.company_hq_country,
          remote_hiring_countries: apolloParams.remote_hiring_countries,
          organization_id: organizationId,
          website_url: apolloParams.website_url // Pass website URL for domain filtering
        });

        console.log(`Apollo search completed:`, apolloSearchResult.searchMetadata);

        // Save email pattern analysis if available
        if (apolloSearchResult.emailPatterns) {
          try {
            await storage.createEmailPatternAnalysis({
              jobSubmissionId: updatedSubmission.id,
              verifiedPattern: apolloSearchResult.emailPatterns.verified_pattern || null,
              analysisSummary: apolloSearchResult.emailPatterns.analysis_summary,
              suggestionsCount: apolloSearchResult.emailPatterns.suggestions.length,
            });
            console.log(`Saved email pattern analysis with ${apolloSearchResult.emailPatterns.suggestions.length} suggestions`);
          } catch (error) {
            console.error("Failed to save email pattern analysis:", error);
          }
        }

        let totalContactsAdded = 0;

        // Save Apollo contacts to database
        if (apolloSearchResult.contacts.length > 0) {
          const contactsToInsert = enhancedEnrichmentService.convertToInsertFormat(
            apolloSearchResult.contacts,
            updatedSubmission.id,
            apolloSearchResult.emailPatterns?.suggestions
          );

          for (const contact of contactsToInsert) {
            await storage.createRecruiterContact(contact);
            totalContactsAdded++;
          }
          
          console.log(`Saved ${apolloSearchResult.contacts.length} Apollo contacts to database`);
        }

        // If no Apollo contacts found, create a placeholder message
        if (apolloSearchResult.contacts.length === 0) {
          console.log("No Apollo contacts found - no fallback contacts will be generated");
          
          // Create a single informational record indicating no contacts were found
          await storage.createRecruiterContact({
            jobSubmissionId: updatedSubmission.id,
            name: "No Recruiter Contacts Found",
            title: "Apollo search returned no results",
            email: null,
            linkedinUrl: null,
            confidenceScore: 0,
            source: "Apollo Search",
            emailVerified: "false",
            verificationStatus: "unknown",
            sourcePlatform: "apollo",
            recruiterConfidence: 0.0,
          });
          
          console.log("Created placeholder record for no contacts found");
        }

        console.log(`Total contacts added: ${totalContactsAdded}`);

        // Return the complete submission with recruiters
        const completeSubmission = await storage.getJobSubmissionById(jobSubmission.id);
        res.json({ id: jobSubmission.id, submission: completeSubmission, runId });

        // Remove from active runs on successful completion
        if (req.body.runId) {
          activeRuns.delete(req.body.runId);
          console.log(`Completed and removed runId ${req.body.runId} from active runs`);
        }

      } catch (openaiError) {
        console.error("OpenAI extraction error:", openaiError);
        
        // Remove from active runs on error
        if (req.body.runId) {
          activeRuns.delete(req.body.runId);
          console.log(`Error occurred, removed runId ${req.body.runId} from active runs`);
        }
        
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
      
      // Ensure runId is removed from active runs on any error
      if (runId) {
        activeRuns.delete(runId);
      }
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid request data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create submission" });
      }
    }
  });

  // Clean up expired runs periodically (every 5 minutes)
  setInterval(() => {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    let cleanedCount = 0;
    for (const [id, run] of activeRuns.entries()) {
      if (run.startTime < tenMinutesAgo) {
        activeRuns.delete(id);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired run IDs`);
    }
  }, 5 * 60 * 1000); // 5 minutes

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

  // Update job submission (status, notes, etc.)
  app.patch("/api/submissions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const submissionId = parseInt(req.params.id);
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }

      // First verify the submission exists and user owns it
      const submission = await storage.getJobSubmissionById(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      if (submission.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update the submission
      const updatedSubmission = await storage.updateJobSubmission(submissionId, req.body);
      res.json(updatedSubmission);
    } catch (error) {
      console.error("Error updating submission:", error);
      res.status(500).json({ message: "Failed to update submission" });
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

  // Get email pattern analysis for a submission
  app.get("/api/submissions/:id/email-patterns", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const submissionId = parseInt(req.params.id);
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }

      // Verify user owns this submission
      const submission = await storage.getJobSubmissionById(submissionId);
      if (!submission || submission.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const patterns = await storage.getEmailPatternAnalysis(submissionId);
      res.json(patterns || { message: "No pattern analysis found" });
    } catch (error) {
      console.error("Error fetching email patterns:", error);
      res.status(500).json({ message: "Failed to fetch email patterns" });
    }
  });

  // Message template routes
  app.post("/api/recruiters/:recruiterId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recruiterId = parseInt(req.params.recruiterId);
      const { messageType, subject, content, version } = req.body;
      
      if (isNaN(recruiterId)) {
        return res.status(400).json({ message: "Invalid recruiter ID" });
      }

      // Verify the recruiter belongs to a job submission owned by the user
      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }

      const submission = await storage.getJobSubmissionById(recruiter.jobSubmissionId);
      if (!submission || submission.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const template = await storage.createMessageTemplate({
        recruiterContactId: recruiterId,
        messageType,
        subject,
        content,
        version: version || "v1"
      });

      res.json(template);
    } catch (error) {
      console.error("Error creating message template:", error);
      res.status(500).json({ message: "Failed to create message template" });
    }
  });

  app.get("/api/recruiters/:recruiterId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recruiterId = parseInt(req.params.recruiterId);
      
      if (isNaN(recruiterId)) {
        return res.status(400).json({ message: "Invalid recruiter ID" });
      }

      // Verify access through job submission ownership
      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }

      const submission = await storage.getJobSubmissionById(recruiter.jobSubmissionId);
      if (!submission || submission.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const templates = await storage.getMessageTemplatesByRecruiter(recruiterId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching message templates:", error);
      res.status(500).json({ message: "Failed to fetch message templates" });
    }
  });

  app.patch("/api/messages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messageId = parseInt(req.params.id);
      
      if (isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }

      // Verify ownership through recruiter -> job submission
      const template = await storage.getMessageTemplateById(messageId);
      if (!template) {
        return res.status(404).json({ message: "Message template not found" });
      }

      const recruiter = await storage.getRecruiterById(template.recruiterContactId);
      if (!recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }
      
      const submission = await storage.getJobSubmissionById(recruiter.jobSubmissionId);
      
      if (!submission || submission.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updated = await storage.updateMessageTemplate(messageId, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating message template:", error);
      res.status(500).json({ message: "Failed to update message template" });
    }
  });

  app.post("/api/recruiters/:recruiterId/generate-messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recruiterId = parseInt(req.params.recruiterId);
      
      if (isNaN(recruiterId)) {
        return res.status(400).json({ message: "Invalid recruiter ID" });
      }

      // Verify access and get context
      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }

      const submission = await storage.getJobSubmissionById(recruiter.jobSubmissionId);
      if (!submission || submission.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Generate personalized messages using OpenAI
      const { generatePersonalizedMessages } = await import("./personalizedMessaging.js");
      const messages = await generatePersonalizedMessages({
        recruiterName: recruiter.name || "Hiring Manager",
        recruiterTitle: recruiter.title || "Recruiter",
        companyName: submission.companyName || "the company",
        jobTitle: submission.jobTitle || "this position",
        jobDescription: submission.jobInput,
        recruiterEmail: recruiter.email
      });

      // Save both messages to database
      const emailTemplate = await storage.createMessageTemplate({
        recruiterContactId: recruiterId,
        messageType: "email",
        subject: messages.emailSubject,
        content: messages.emailContent,
        version: "v1"
      });

      const linkedinTemplate = await storage.createMessageTemplate({
        recruiterContactId: recruiterId,
        messageType: "linkedin",
        subject: null,
        content: messages.linkedinContent,
        version: "v1"
      });

      res.json({
        email: emailTemplate,
        linkedin: linkedinTemplate
      });
    } catch (error) {
      console.error("Error generating messages:", error);
      res.status(500).json({ message: "Failed to generate messages" });
    }
  });

  // Company search routes for organization ID handling
  app.post("/api/company/search", isAuthenticated, async (req: any, res) => {
    try {
      const { jobContent } = req.body;
      if (!jobContent) {
        return res.status(400).json({ message: "Job content is required" });
      }

      // Extract company information using OpenAI
      const { extractCompanyInfo } = await import("./openai");
      const companyInfo = await extractCompanyInfo(jobContent);

      if (!companyInfo.company_name && !companyInfo.company_domain) {
        return res.json({
          companyInfo: null,
          organizations: []
        });
      }

      // Search Apollo organizations
      const { apolloService } = await import("./apolloService");
      const organizations = await apolloService.searchOrganizations({
        company_name: companyInfo.company_name,
        domain: companyInfo.company_domain,
        fallback_query: companyInfo.fallback_query
      });

      res.json({
        companyInfo,
        organizations
      });
    } catch (error) {
      console.error("Company search error:", error);
      res.status(500).json({ message: "Failed to search for company" });
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

  // Message improvement endpoint
  app.post("/api/improve-message", isAuthenticated, async (req, res) => {
    try {
      const { message, tone } = req.body;
      
      if (!message || !tone) {
        return res.status(400).json({ message: "Message and tone are required" });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const tonePrompts = {
        confident: "Rewrite the following message to sound more confident and assertive. Preserve the meaning, and keep it suitable for outreach.",
        concise: "Rewrite the following message to be more concise and direct while maintaining the key points. Preserve the meaning, and keep it suitable for outreach.",
        friendly: "Rewrite the following message to sound friendlier and more approachable. Preserve the meaning, and keep it suitable for outreach.",
        professional: "Rewrite the following message to sound more professional and formal. Preserve the meaning, and keep it suitable for outreach.",
        personalized: "Rewrite the following message to sound more personalized and engaging. Preserve the meaning, and keep it suitable for outreach."
      };

      const prompt = tonePrompts[tone as keyof typeof tonePrompts] || tonePrompts.professional;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: `Message:\n${message}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const improvedMessage = response.choices[0].message.content;
      
      res.json({ improvedMessage });
    } catch (error) {
      console.error("Error improving message:", error);
      res.status(500).json({ message: "Failed to improve message" });
    }
  });

  // Update contact information
  app.patch("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const updates = req.body;
      
      // Update the contact in the database
      const updatedContact = await storage.updateContact(contactId, updates);
      
      res.json(updatedContact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  // Generate message for contact
  app.post("/api/contacts/:id/generate-message", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const { messageType, tone = "professional" } = req.body;
      
      // Get contact details
      const contact = await storage.getContactById(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get submission details for context
      const submission = await storage.getJobSubmissionById(contact.jobSubmissionId);
      if (!submission) {
        return res.status(404).json({ message: "Job submission not found" });
      }

      // Generate message using OpenAI
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const prompt = messageType === "email" 
        ? `Generate a professional ${tone} email to ${contact.name || "the recruiter"} (${contact.title || "Unknown Title"}) about the ${submission.jobTitle || "position"} at ${submission.companyName || "the company"}. 

Keep it concise (under 150 words), personalized, and include:
- Brief introduction
- Specific interest in the role
- Relevant qualifications
- Request for discussion

Contact: ${contact.name || "Unknown"} - ${contact.title || "Unknown Title"}
Company: ${submission.companyName || "Unknown Company"}
Job: ${submission.jobTitle || "Unknown Position"}

Email tone: ${tone}`
        : `Generate a professional ${tone} LinkedIn message to ${contact.name || "the recruiter"} (${contact.title || "Unknown Title"}) about the ${submission.jobTitle || "position"} at ${submission.companyName || "the company"}.

Keep it under 300 characters for LinkedIn limits, personalized and include:
- Brief introduction
- Interest in the role
- Request to connect

Contact: ${contact.name || "Unknown"} - ${contact.title || "Unknown Title"}
Company: ${submission.companyName || "Unknown Company"}
Job: ${submission.jobTitle || "Unknown Position"}

LinkedIn message tone: ${tone}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system", 
            content: "You are an expert at writing professional outreach messages for job seekers. Write clear, personalized, and effective messages."
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const generatedMessage = response.choices[0].message.content;

      // Update contact with generated message
      const updateFields: any = {};
      
      if (messageType === "email") {
        updateFields.generatedEmailMessage = generatedMessage;
        updateFields.emailDraft = generatedMessage;
      } else {
        updateFields.generatedLinkedInMessage = generatedMessage;
        updateFields.linkedinMessage = generatedMessage;
      }
      
      await storage.updateContact(contactId, req.user?.claims?.sub, updateFields);

      res.json({ message: generatedMessage });
    } catch (error) {
      console.error("Error generating message:", error);
      res.status(500).json({ message: "Failed to generate message" });
    }
  });

  // Register contact routes
  registerContactRoutes(app);

  // Debug endpoint for department targeting (no auth for testing)
  app.post('/api/debug/department-test', async (req, res) => {
    try {
      const { company_name, job_title, job_content } = req.body;
      
      console.log('=== DEBUG: Testing Department Targeting ===');
      console.log(`Company: ${company_name}`);
      console.log(`Job Title: ${job_title}`);
      console.log(`Content length: ${job_content?.length} chars`);
      
      // Import here to avoid circular dependencies
      const { inferDepartmentTargets } = await import('./departmentRouter');
      
      const result = await inferDepartmentTargets(company_name, job_title, job_content);
      
      console.log('=== Department Inference Result ===');
      console.log(`Summary: ${result.summary}`);
      console.log(`Primary Department: ${result.departments[0]?.label} (${result.departments[0]?.confidence}%)`);
      console.log(`Primary Titles: ${result.primary_titles.slice(0, 3).map(t => t.title).join(', ')}`);
      
      res.json({ 
        success: true, 
        result,
        analysis: {
          primary_department: result.departments[0],
          top_titles: result.primary_titles.slice(0, 5),
          summary: result.summary
        }
      });
    } catch (error) {
      console.error('Department test error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
