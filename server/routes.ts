import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { extractRecruiterInfo } from "./openai";
import { enrichmentService, ContactEnrichmentService } from "./enrichmentService";
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

      // Extract recruiter information using OpenAI
      try {
        const extraction = await extractRecruiterInfo(
          submissionData.jobInput, 
          submissionData.inputType as "text" | "url"
        );

        // Update job submission with extracted data
        const updatedSubmission = await storage.updateJobSubmission(jobSubmission.id, {
          openaiResponseRaw: JSON.stringify(extraction),
          companyName: extraction.company_name,
          jobTitle: extraction.job_title,
          emailDraft: extraction.email_draft,
          linkedinMessage: extraction.linkedin_message,
        });

        // Enrich and verify recruiter contacts
        const companyDomain = ContactEnrichmentService.extractDomain(extraction.company_name);
        const enrichedContacts = await enrichmentService.enrichContacts(extraction.recruiters, companyDomain);

        // Create recruiter contacts with enrichment data
        const recruiterContacts = enrichedContacts.map(contact => ({
          jobSubmissionId: jobSubmission.id,
          name: contact.name,
          title: contact.title,
          email: contact.verifiedEmail || contact.email,
          linkedinUrl: contact.linkedinUrl,
          confidenceScore: extraction.recruiters.find(r => r.name === contact.name)?.confidence_score || 50,
          emailVerified: contact.emailVerified ? "true" : "false",
          verificationStatus: contact.verificationStatus,
          sourcePlatform: contact.sourcePlatform,
        }));

        await storage.createRecruiterContacts(recruiterContacts);

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

  const httpServer = createServer(app);
  return httpServer;
}
