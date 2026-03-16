import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { registerContactRoutes } from "./routes/contacts";
import { registerOutreachProfileRoutes } from "./routes/outreachProfile";
import dbTestRouter from "./routes/dbTest";
import { supabase } from "./lib/supabaseClient";
import { callClaude } from "./claude";
import { extractRecruiterInfo, extractJobData, extractApolloSearchParams } from "./openai";
import { enrichmentService, ContactEnrichmentService } from "./enrichmentService";
import { enhancedEnrichmentService } from "./enhancedEnrichmentService";
import { supplementalEmailService } from "./supplementalEmailService";
import { urlScrapingService } from "./urlScrapingService";
import { insertJobSubmissionSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

// Session-based authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function mapSubmissionToFrontend(row: any) {
  if (!row) return row;
  return {
    id: row.id,
    userId: row.user_id,
    jobInput: row.job_input,
    inputType: row.input_type,
    openaiResponseRaw: row.openai_response_raw,
    emailDraft: row.email_draft,
    linkedinMessage: row.linkedin_message,
    companyName: row.company_name,
    jobTitle: row.job_title,
    organizationId: row.organization_id,
    companyDomain: row.company_domain,
    status: row.status,
    notes: row.notes,
    submittedAt: row.submitted_at,
    recruiters: row.recruiters?.map((r: any) => ({
      id: r.id,
      jobSubmissionId: r.job_submission_id,
      name: r.name,
      title: r.title,
      email: r.email,
      linkedinUrl: r.linkedin_url,
      confidenceScore: r.confidence_score,
      source: r.source,
      emailVerified: r.email_verified,
      verificationStatus: r.verification_status,
      sourcePlatform: r.source_platform,
      apolloId: r.apollo_id,
      recruiterConfidence: r.recruiter_confidence,
      verificationData: r.verification_data,
      suggestedEmail: r.suggested_email,
      emailSuggestionReasoning: r.email_suggestion_reasoning,
      contactStatus: r.contact_status,
      lastContactedAt: r.last_contacted_at,
      notes: r.notes,
      outreachBucket: r.outreach_bucket,
      department: r.department,
      seniority: r.seniority,
      generatedEmailMessage: r.generated_email_message,
      generatedLinkedInMessage: r.generated_linkedin_message,
      emailDraft: r.email_draft,
      linkedinMessage: r.linkedin_message,
    })),
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for Replit Preview
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Supabase database test route
  app.use("/api/db-test", dbTestRouter);

  /*
   * OLD PASSPORT-BASED AUTH (REPLACED WITH SESSION-BASED AUTH)
   * Auth routes now handled by backend/routes/auth.ts
   * Middleware now handled by backend/middleware/sessionAuth.ts
   */
  // await setupAuth(app);

  // Get current user
  app.get('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Get user from Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Active run IDs for session-based duplicate prevention
  const activeRuns = new Map<string, { userId: string; startTime: number }>();

  // Job submission routes
  app.post("/api/submissions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
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

      // Create initial job submission using Supabase
      const { data: jobSubmission, error: insertError } = await supabase
        .from('job_submissions')
        .insert({
          user_id: submissionData.userId,
          job_input: submissionData.jobInput,
          input_type: submissionData.inputType,
          openai_response_raw: submissionData.openaiResponseRaw || null,
          email_draft: submissionData.emailDraft || null,
          linkedin_message: submissionData.linkedinMessage || null,
          company_name: submissionData.companyName || null,
          job_title: submissionData.jobTitle || null,
          organization_id: submissionData.organizationId || null,
          company_domain: submissionData.companyDomain || null,
          status: submissionData.status || 'not_contacted',
          notes: submissionData.notes || null,
        })
        .select()
        .single();

      if (insertError || !jobSubmission) {
        throw new Error(`Failed to create job submission: ${insertError?.message}`);
      }

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

        // Update job submission with extracted data and organization info using Supabase
        const { data: updatedSubmission, error: updateError } = await supabase
          .from('job_submissions')
          .update({
            openai_response_raw: JSON.stringify({
              basic_extraction: extraction,
              enhanced_data: jobDataExtraction
            }),
            company_name: companyName,
            job_title: jobTitle,
            organization_id: organizationId,
            company_domain: companyDomain,
            email_draft: extraction.email_draft,
            linkedin_message: extraction.linkedin_message,
          })
          .eq('id', jobSubmission.id)
          .select()
          .single();

        if (updateError || !updatedSubmission) {
          throw new Error(`Failed to update job submission: ${updateError?.message}`);
        }

        // Extract optimized Apollo search parameters
        console.log(`Extracting Apollo search parameters for ${companyName}`);
        const apolloParams = await extractApolloSearchParams(jobContent);
        console.log(`Apollo search params:`, apolloParams);

        // Apollo params provide search terms for contact lookup

        // Apollo + NeverBounce Enhanced Search
        console.log(`Starting Apollo + NeverBounce enrichment for ${companyName}`);
        
        // Fetch company employee count from Apollo for size-aware targeting
        let employeeCount: number | undefined;
        if (organizationId) {
          try {
            const { apolloService } = await import("./apolloService");
            const orgs = await apolloService.searchOrganizations({
              company_name: apolloParams.company_name || companyName
            });
            const matchedOrg = orgs.find(o => o.id === organizationId);
            if (matchedOrg?.employees) {
              employeeCount = matchedOrg.employees;
              console.log(`Company size from Apollo: ${employeeCount} employees`);
            }
          } catch (e) {
            console.warn("Could not fetch employee count:", e);
          }
        }

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
          employee_count: employeeCount
        });

        console.log(`Apollo search completed:`, apolloSearchResult.searchMetadata);

        // Save email pattern analysis if available using Supabase
        if (apolloSearchResult.emailPatterns) {
          try {
            const { error: patternError } = await supabase
              .from('email_pattern_analysis')
              .insert({
                job_submission_id: updatedSubmission.id,
                verified_pattern: apolloSearchResult.emailPatterns.verified_pattern || null,
                analysis_summary: apolloSearchResult.emailPatterns.analysis_summary,
                suggestions_count: apolloSearchResult.emailPatterns.suggestions.length,
              });
            
            if (patternError) {
              console.error("Failed to save email pattern analysis:", patternError);
            } else {
              console.log(`Saved email pattern analysis with ${apolloSearchResult.emailPatterns.suggestions.length} suggestions`);
            }
          } catch (error) {
            console.error("Failed to save email pattern analysis:", error);
          }
        }

        let totalContactsAdded = 0;

        // Save Apollo contacts to database using Supabase
        if (apolloSearchResult.contacts.length > 0) {
          const contactsToInsert = enhancedEnrichmentService.convertToInsertFormat(
            apolloSearchResult.contacts,
            updatedSubmission.id,
            apolloSearchResult.emailPatterns?.suggestions
          );

          // Map camelCase to snake_case for Supabase
          const supabaseContacts = contactsToInsert.map(contact => ({
            job_submission_id: contact.jobSubmissionId,
            name: contact.name,
            title: contact.title,
            email: contact.email,
            linkedin_url: contact.linkedinUrl,
            confidence_score: contact.confidenceScore,
            source: contact.source,
            email_verified: contact.emailVerified,
            verification_status: contact.verificationStatus,
            source_platform: contact.sourcePlatform,
            apollo_id: contact.apolloId,
            recruiter_confidence: contact.recruiterConfidence,
            verification_data: contact.verificationData,
            suggested_email: contact.suggestedEmail,
            email_suggestion_reasoning: contact.emailSuggestionReasoning,
            contact_status: contact.contactStatus,
            last_contacted_at: contact.lastContactedAt,
            notes: contact.notes,
            outreach_bucket: contact.outreachBucket,
            department: contact.department,
            seniority: contact.seniority,
            generated_email_message: contact.generatedEmailMessage,
            generated_linkedin_message: contact.generatedLinkedInMessage,
            email_draft: contact.emailDraft,
            linkedin_message: contact.linkedinMessage,
          }));

          const { error: contactsError } = await supabase
            .from('recruiter_contacts')
            .insert(supabaseContacts);

          if (contactsError) {
            console.error("Failed to save recruiter contacts:", contactsError);
            throw new Error(`Failed to save recruiter contacts: ${contactsError.message}`);
          }

          totalContactsAdded = supabaseContacts.length;
          console.log(`Saved ${apolloSearchResult.contacts.length} Apollo contacts to database`);
          
          // NEW: Run supplemental email pattern inference (additive enhancement)
          try {
            console.log(`[ENHANCEMENT] Starting supplemental email pattern inference...`);
            await supplementalEmailService.addPatternInferredEmails(updatedSubmission.id);
            console.log(`[ENHANCEMENT] Supplemental email pattern inference completed`);
          } catch (error) {
            console.error(`[ENHANCEMENT] Supplemental email pattern inference failed (non-critical):`, error);
            // Continue normally - this is just an enhancement
          }
        }

        // If no Apollo contacts found, create a placeholder message using Supabase
        if (apolloSearchResult.contacts.length === 0) {
          console.log("No Apollo contacts found - no fallback contacts will be generated");
          
          // Create a single informational record indicating no contacts were found
          const { error: placeholderError } = await supabase
            .from('recruiter_contacts')
            .insert({
              job_submission_id: updatedSubmission.id,
              name: "No Recruiter Contacts Found",
              title: "Apollo search returned no results",
              email: null,
              linkedin_url: null,
              confidence_score: 0,
              source: "Apollo Search",
              email_verified: "false",
              verification_status: "unknown",
              source_platform: "apollo",
              recruiter_confidence: 0.0,
            });
          
          if (placeholderError) {
            console.error("Failed to create placeholder contact:", placeholderError);
          } else {
            console.log("Created placeholder record for no contacts found");
          }
        }

        console.log(`Total contacts added: ${totalContactsAdded}`);

        // Return the complete submission with recruiters using Supabase
        const { data: completeSubmission, error: fetchError } = await supabase
          .from('job_submissions')
          .select(`
            *,
            recruiters:recruiter_contacts(*)
          `)
          .eq('id', jobSubmission.id)
          .single();

        if (fetchError || !completeSubmission) {
          throw new Error(`Failed to fetch complete submission: ${fetchError?.message}`);
        }

        res.json({ id: jobSubmission.id, submission: mapSubmissionToFrontend(completeSubmission), runId });

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
        
        // Update submission with error status but still return it using Supabase
        const errorMessage = openaiError instanceof Error ? openaiError.message : "Unknown error";
        await supabase
          .from('job_submissions')
          .update({
            openai_response_raw: JSON.stringify({ error: errorMessage }),
          })
          .eq('id', jobSubmission.id);
        res.status(500).json({ 
          message: "Failed to extract recruiter information", 
          submissionId: jobSubmission.id 
        });
      }

    } catch (error) {
      console.error("Error creating submission:", error);
      
      // Ensure runId is removed from active runs on any error
      if (req.body.runId) {
        activeRuns.delete(req.body.runId);
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
    for (const [id, run] of Array.from(activeRuns.entries())) {
      if (run.startTime < tenMinutesAgo) {
        activeRuns.delete(id);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired run IDs`);
    }
  }, 5 * 60 * 1000); // 5 minutes

  app.get("/api/submissions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Fetch submissions with recruiters using Supabase
      const { data: submissions, error: fetchError } = await supabase
        .from('job_submissions')
        .select(`
          *,
          recruiters:recruiter_contacts(*)
        `)
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false });

      if (fetchError) {
        throw new Error(`Failed to fetch submissions: ${fetchError.message}`);
      }

      res.json((submissions || []).map(mapSubmissionToFrontend));
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  app.get("/api/submissions/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const submissionId = parseInt(req.params.id);
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }

      // Fetch submission with recruiters using Supabase
      const { data: submission, error: fetchError } = await supabase
        .from('job_submissions')
        .select(`
          *,
          recruiters:recruiter_contacts(*)
        `)
        .eq('id', submissionId)
        .single();
      
      if (fetchError || !submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Ensure user owns this submission
      if (submission.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(mapSubmissionToFrontend(submission));
    } catch (error) {
      console.error("Error fetching submission:", error);
      res.status(500).json({ message: "Failed to fetch submission" });
    }
  });

  // Update job submission (status, notes, etc.)
  app.patch("/api/submissions/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const submissionId = parseInt(req.params.id);
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }

      // First verify the submission exists and user owns it using Supabase
      const { data: submission, error: fetchError } = await supabase
        .from('job_submissions')
        .select('id, user_id')
        .eq('id', submissionId)
        .single();
        
      if (fetchError || !submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      if (submission.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Map camelCase request body to snake_case for Supabase
      const updateData: any = {};
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.jobInput !== undefined) updateData.job_input = req.body.jobInput;
      if (req.body.companyName !== undefined) updateData.company_name = req.body.companyName;
      if (req.body.jobTitle !== undefined) updateData.job_title = req.body.jobTitle;
      if (req.body.jobUrl !== undefined) updateData.job_url = req.body.jobUrl;
      if (req.body.jobDescription !== undefined) updateData.job_description = req.body.jobDescription;

      // Guard against empty updates
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      // Update the submission using Supabase
      const { data: updatedSubmission, error: updateError } = await supabase
        .from('job_submissions')
        .update(updateData)
        .eq('id', submissionId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update submission: ${updateError.message}`);
      }

      res.json(mapSubmissionToFrontend(updatedSubmission));
    } catch (error) {
      console.error("Error updating submission:", error);
      res.status(500).json({ message: "Failed to update submission" });
    }
  });

  // Get enhanced job data for a submission
  app.get("/api/submissions/:id/job-data", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const submissionId = parseInt(req.params.id);
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }

      // Get submission from Supabase
      const { data: submission, error: submissionError } = await supabase
        .from('job_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();
      
      if (submissionError || !submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Ensure user owns this submission
      if (submission.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Parse the enhanced job data from openai_response_raw
      let enhancedData = null;
      if (submission.openai_response_raw) {
        try {
          const parsed = JSON.parse(submission.openai_response_raw);
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
  app.get("/api/submissions/:id/email-patterns", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const submissionId = parseInt(req.params.id);
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }

      // Verify user owns this submission using Supabase
      const { data: submission, error: submissionError } = await supabase
        .from('job_submissions')
        .select('id, user_id')
        .eq('id', submissionId)
        .single();
        
      if (submissionError || !submission || submission.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get email pattern analysis using Supabase
      const { data: patterns, error: patternsError } = await supabase
        .from('email_pattern_analysis')
        .select('*')
        .eq('job_submission_id', submissionId)
        .single();

      if (patternsError && patternsError.code !== 'PGRST116') {
        console.error("Error fetching patterns:", patternsError);
      }

      res.json(patterns || { message: "No pattern analysis found" });
    } catch (error) {
      console.error("Error fetching email patterns:", error);
      res.status(500).json({ message: "Failed to fetch email patterns" });
    }
  });

  // Message template routes
  app.post("/api/recruiters/:recruiterId/messages", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const recruiterId = parseInt(req.params.recruiterId);
      const { messageType, subject, content, version } = req.body;
      
      if (isNaN(recruiterId)) {
        return res.status(400).json({ message: "Invalid recruiter ID" });
      }

      // Verify the recruiter belongs to a job submission owned by the user using Supabase
      const { data: recruiter, error: recruiterError } = await supabase
        .from('recruiter_contacts')
        .select('id, job_submission_id, job_submissions!inner(user_id)')
        .eq('id', recruiterId)
        .single();
      
      if (recruiterError || !recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }

      if (recruiter.job_submissions.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Create message template using Supabase
      const { data: template, error: insertError } = await supabase
        .from('message_templates')
        .insert({
          recruiter_contact_id: recruiterId,
          message_type: messageType,
          subject: subject,
          content: content,
          version: version || "v1"
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create message template: ${insertError.message}`);
      }

      res.json(template);
    } catch (error) {
      console.error("Error creating message template:", error);
      res.status(500).json({ message: "Failed to create message template" });
    }
  });

  app.get("/api/recruiters/:recruiterId/messages", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const recruiterId = parseInt(req.params.recruiterId);
      
      if (isNaN(recruiterId)) {
        return res.status(400).json({ message: "Invalid recruiter ID" });
      }

      // Verify access through job submission ownership using Supabase
      const { data: recruiter, error: recruiterError } = await supabase
        .from('recruiter_contacts')
        .select('id, job_submission_id, job_submissions!inner(user_id)')
        .eq('id', recruiterId)
        .single();
      
      if (recruiterError || !recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }

      if (recruiter.job_submissions.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get message templates using Supabase
      const { data: templates, error: templatesError } = await supabase
        .from('message_templates')
        .select('*')
        .eq('recruiter_contact_id', recruiterId)
        .order('created_at', { ascending: false });

      if (templatesError) {
        throw new Error(`Failed to fetch message templates: ${templatesError.message}`);
      }

      res.json(templates || []);
    } catch (error) {
      console.error("Error fetching message templates:", error);
      res.status(500).json({ message: "Failed to fetch message templates" });
    }
  });

  app.patch("/api/messages/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const messageId = parseInt(req.params.id);
      
      if (isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }

      // Get template and verify ownership through recruiter -> job submission using Supabase
      const { data: template, error: templateError } = await supabase
        .from('message_templates')
        .select(`
          *,
          recruiter_contacts!inner (
            id,
            job_submission_id,
            job_submissions!inner (
              user_id
            )
          )
        `)
        .eq('id', messageId)
        .single();
      
      if (templateError || !template) {
        return res.status(404).json({ message: "Message template not found" });
      }
      
      if (template.recruiter_contacts.job_submissions.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Map camelCase updates to snake_case for Supabase
      const updateData: any = {};
      if (req.body.subject !== undefined) updateData.subject = req.body.subject;
      if (req.body.content !== undefined) updateData.content = req.body.content;
      if (req.body.version !== undefined) updateData.version = req.body.version;
      if (req.body.isSent !== undefined) updateData.is_sent = req.body.isSent;
      if (req.body.sentAt !== undefined) updateData.sent_at = req.body.sentAt;

      const { data: updated, error: updateError } = await supabase
        .from('message_templates')
        .update(updateData)
        .eq('id', messageId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update message template: ${updateError.message}`);
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating message template:", error);
      res.status(500).json({ message: "Failed to update message template" });
    }
  });

  app.post("/api/recruiters/:recruiterId/generate-messages", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const recruiterId = parseInt(req.params.recruiterId);
      
      if (isNaN(recruiterId)) {
        return res.status(400).json({ message: "Invalid recruiter ID" });
      }

      // Verify access and get context using Supabase
      const { data: recruiter, error: recruiterError } = await supabase
        .from('recruiter_contacts')
        .select(`
          *,
          job_submissions!inner (
            job_title,
            company_name,
            job_input,
            user_id
          )
        `)
        .eq('id', recruiterId)
        .single();
      
      if (recruiterError || !recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }

      if (recruiter.job_submissions.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Fetch user's outreach profile for personalization
      const { data: outreachProfile } = await supabase
        .from('user_outreach_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      const parseJsonArray = (val: any): string[] => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
        return [];
      };

      // Generate personalized messages using Claude + outreach profile
      const { generatePersonalizedMessages } = await import("./personalizedMessaging.js");
      const messages = await generatePersonalizedMessages({
        recruiterName: recruiter.name || "Hiring Manager",
        recruiterTitle: recruiter.title || "Recruiter",
        companyName: recruiter.job_submissions.company_name || "the company",
        jobTitle: recruiter.job_submissions.job_title || "this position",
        jobDescription: recruiter.job_submissions.job_input,
        recruiterEmail: recruiter.email,
        userBio: outreachProfile?.bio || undefined,
        userAchievements: parseJsonArray(outreachProfile?.achievements),
        userStoryHooks: parseJsonArray(outreachProfile?.story_hooks),
        userCareerGoals: outreachProfile?.career_goals || undefined,
        voiceFormality: outreachProfile?.voice_formality,
        voiceDirectness: outreachProfile?.voice_directness,
        voiceLength: outreachProfile?.voice_length,
        voiceNotes: outreachProfile?.voice_notes || undefined,
      });

      // Save both messages to database using Supabase
      const { data: emailTemplate, error: emailError } = await supabase
        .from('message_templates')
        .insert({
          recruiter_contact_id: recruiterId,
          message_type: "email",
          subject: messages.emailSubject,
          content: messages.emailContent,
          version: "v1"
        })
        .select()
        .single();

      if (emailError) {
        throw new Error(`Failed to create email template: ${emailError.message}`);
      }

      const { data: linkedinTemplate, error: linkedinError} = await supabase
        .from('message_templates')
        .insert({
          recruiter_contact_id: recruiterId,
          message_type: "linkedin",
          subject: null,
          content: messages.linkedinContent,
          version: "v1"
        })
        .select()
        .single();

      if (linkedinError) {
        throw new Error(`Failed to create LinkedIn template: ${linkedinError.message}`);
      }

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
  app.post("/api/company/search", requireAuth, async (req: any, res) => {
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
        company_name: companyInfo.company_name || undefined,
        domain: companyInfo.company_domain || undefined,
        fallback_query: companyInfo.fallback_query || undefined
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
  app.get("/api/status", requireAuth, async (req, res) => {
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
        claude: {
          configured: !!process.env.ANTHROPIC_API_KEY,
          status: !!process.env.ANTHROPIC_API_KEY ? "ready" : "api_key_missing"
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching API status:", error);
      res.status(500).json({ message: "Failed to fetch API status" });
    }
  });

  // Message improvement endpoint
  app.post("/api/improve-message", requireAuth, async (req, res) => {
    try {
      const { message, tone } = req.body;
      
      if (!message || !tone) {
        return res.status(400).json({ message: "Message and tone are required" });
      }

      const tonePrompts = {
        confident: "Rewrite the following message to sound more confident and assertive. Preserve the meaning, and keep it suitable for outreach.",
        concise: "Rewrite the following message to be more concise and direct while maintaining the key points. Preserve the meaning, and keep it suitable for outreach.",
        friendly: "Rewrite the following message to sound friendlier and more approachable. Preserve the meaning, and keep it suitable for outreach.",
        professional: "Rewrite the following message to sound more professional and formal. Preserve the meaning, and keep it suitable for outreach.",
        personalized: "Rewrite the following message to sound more personalized and engaging. Preserve the meaning, and keep it suitable for outreach."
      };

      const prompt = tonePrompts[tone as keyof typeof tonePrompts] || tonePrompts.professional;

      const improvedMessage = await callClaude({
        system: prompt,
        user: `Message:\n${message}`,
        temperature: 0.7,
        maxTokens: 500,
      });
      
      res.json({ improvedMessage });
    } catch (error) {
      console.error("Error improving message:", error);
      res.status(500).json({ message: "Failed to improve message" });
    }
  });

  // Update contact information
  app.patch("/api/contacts/:id", requireAuth, async (req: any, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const updates = req.body;
      const userId = req.user.id;
      
      // First verify the contact belongs to the user via job submission using Supabase
      const { data: contact, error: fetchError } = await supabase
        .from('recruiter_contacts')
        .select('id, job_submission_id, job_submissions!inner(user_id)')
        .eq('id', contactId)
        .single();

      if (fetchError || !contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Check user ownership
      if (contact.job_submissions.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Map camelCase updates to snake_case for Supabase (complete field coverage)
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.linkedinUrl !== undefined) updateData.linkedin_url = updates.linkedinUrl;
      if (updates.department !== undefined) updateData.department = updates.department;
      if (updates.seniority !== undefined) updateData.seniority = updates.seniority;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.source !== undefined) updateData.source = updates.source;
      if (updates.sourcePlatform !== undefined) updateData.source_platform = updates.sourcePlatform;
      if (updates.confidenceScore !== undefined) updateData.confidence_score = updates.confidenceScore;
      if (updates.recruiterConfidence !== undefined) updateData.recruiter_confidence = updates.recruiterConfidence;
      if (updates.emailVerified !== undefined) updateData.email_verified = updates.emailVerified;
      if (updates.verificationStatus !== undefined) updateData.verification_status = updates.verificationStatus;
      if (updates.verificationData !== undefined) updateData.verification_data = updates.verificationData;
      if (updates.apolloId !== undefined) updateData.apollo_id = updates.apolloId;
      if (updates.suggestedEmail !== undefined) updateData.suggested_email = updates.suggestedEmail;
      if (updates.emailSuggestionReasoning !== undefined) updateData.email_suggestion_reasoning = updates.emailSuggestionReasoning;
      if (updates.contactStatus !== undefined) updateData.contact_status = updates.contactStatus;
      if (updates.lastContactedAt !== undefined) updateData.last_contacted_at = updates.lastContactedAt;
      if (updates.outreachBucket !== undefined) updateData.outreach_bucket = updates.outreachBucket;
      if (updates.emailDraft !== undefined) updateData.email_draft = updates.emailDraft;
      if (updates.linkedinMessage !== undefined) updateData.linkedin_message = updates.linkedinMessage;
      if (updates.generatedEmailMessage !== undefined) updateData.generated_email_message = updates.generatedEmailMessage;
      if (updates.generatedLinkedInMessage !== undefined) updateData.generated_linkedin_message = updates.generatedLinkedInMessage;

      // Update the contact using Supabase
      const { data: updatedContact, error: updateError } = await supabase
        .from('recruiter_contacts')
        .update(updateData)
        .eq('id', contactId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update contact: ${updateError.message}`);
      }
      
      res.json(updatedContact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  // Generate message for contact
  app.post("/api/contacts/:id/generate-message", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const contactId = parseInt(req.params.id);
      const { instructions, currentDraft, currentSubject, currentLinkedin } = req.body;

      // Get contact details with job data
      const { data: contact, error: contactError } = await supabase
        .from('recruiter_contacts')
        .select(`
          *,
          job_submissions!inner (
            job_title,
            company_name,
            job_input,
            user_id
          )
        `)
        .eq('id', contactId)
        .single();

      if (contactError || !contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (contact.job_submissions.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Fetch outreach profile for full personalization
      const { data: outreachProfile } = await supabase
        .from('user_outreach_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      const parseJsonArray = (val: any): string[] => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
        return [];
      };

      const hasProfile = !!(outreachProfile?.bio || parseJsonArray(outreachProfile?.achievements).length > 0);

      // If instructions provided, refine existing draft with AI
      if (instructions && (currentDraft || currentLinkedin)) {
        const refinePrompt = `You are refining outreach messages for a job seeker. Apply the user's instructions to improve the existing drafts.

USER INSTRUCTIONS: ${instructions}

TARGET:
- Recruiter: ${contact.name || "Hiring Manager"} (${contact.title || "Recruiter"})
- Company: ${contact.job_submissions.company_name || "the company"}
- Job: ${contact.job_submissions.job_title || "this position"}

${currentSubject ? `CURRENT EMAIL SUBJECT: ${currentSubject}` : ''}
${currentDraft ? `CURRENT EMAIL DRAFT:\n${currentDraft}` : ''}
${currentLinkedin ? `CURRENT LINKEDIN MESSAGE:\n${currentLinkedin}` : ''}

Return JSON with the refined versions. Only include fields that had content:
{
  ${currentSubject !== undefined ? '"emailSubject": "refined subject",' : ''}
  ${currentDraft ? '"emailContent": "refined email body",' : ''}
  ${currentLinkedin ? '"linkedinContent": "refined linkedin message"' : ''}
}

RULES:
- Apply the user's instructions faithfully
- Keep email under 150 words, 3 paragraphs max
- Keep LinkedIn under 200 characters
- Subject line under 7 words
- Maintain authentic, non-templated voice`;

        const raw = await callClaude({
          system: "You refine cold outreach to sound human and authentic. Apply user instructions precisely. Return valid JSON only.",
          user: refinePrompt,
          jsonMode: true,
          maxTokens: 1500,
          temperature: 0.6,
        });

        const refined = JSON.parse(raw);

        const updateData: any = {};
        if (refined.emailContent) {
          updateData.email_draft = refined.emailContent;
          updateData.generated_email_message = refined.emailContent;
        }
        if (refined.emailSubject) {
          updateData.email_subject = refined.emailSubject;
        }
        if (refined.linkedinContent) {
          updateData.linkedin_message = refined.linkedinContent;
          updateData.generated_linkedin_message = refined.linkedinContent;
        }

        await supabase.from('recruiter_contacts').update(updateData).eq('id', contactId);

        return res.json({
          emailSubject: refined.emailSubject || currentSubject,
          emailContent: refined.emailContent || currentDraft,
          linkedinContent: refined.linkedinContent || currentLinkedin,
          hasProfile,
        });
      }

      // Full regeneration using personalized messaging
      const { generatePersonalizedMessages } = await import("./personalizedMessaging.js");
      const messages = await generatePersonalizedMessages({
        recruiterName: contact.name || "Hiring Manager",
        recruiterTitle: contact.title || "Recruiter",
        companyName: contact.job_submissions.company_name || "the company",
        jobTitle: contact.job_submissions.job_title || "this position",
        jobDescription: contact.job_submissions.job_input,
        recruiterEmail: contact.email,
        userBio: outreachProfile?.bio || undefined,
        userAchievements: parseJsonArray(outreachProfile?.achievements),
        userStoryHooks: parseJsonArray(outreachProfile?.story_hooks),
        userCareerGoals: outreachProfile?.career_goals || undefined,
        voiceFormality: outreachProfile?.voice_formality,
        voiceDirectness: outreachProfile?.voice_directness,
        voiceLength: outreachProfile?.voice_length,
        voiceNotes: outreachProfile?.voice_notes || undefined,
      });

      // Save all fields to recruiter_contacts
      await supabase
        .from('recruiter_contacts')
        .update({
          email_draft: messages.emailContent,
          generated_email_message: messages.emailContent,
          email_subject: messages.emailSubject,
          linkedin_message: messages.linkedinContent,
          generated_linkedin_message: messages.linkedinContent,
        })
        .eq('id', contactId);

      res.json({
        emailSubject: messages.emailSubject,
        emailContent: messages.emailContent,
        linkedinContent: messages.linkedinContent,
        hasProfile,
      });
    } catch (error) {
      console.error("Error generating message:", error);
      res.status(500).json({ message: "Failed to generate message" });
    }
  });

  // Register contact routes
  registerContactRoutes(app);
  registerOutreachProfileRoutes(app);

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
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Debug endpoint for testing Apollo API
  app.post('/api/debug/apollo-test', async (req, res) => {
    try {
      const { company_name = "Replicant" } = req.body;
      
      console.log('=== DEBUG: Testing Apollo API ===');
      console.log(`Company: ${company_name}`);
      
      // Import Apollo service
      const { apolloService } = await import('./apolloService');
      
      // Test basic connection
      console.log('Testing Apollo API connection...');
      const connectionTest = await apolloService.testApiConnection();
      console.log(`Apollo API connection test result: ${connectionTest}`);
      
      // Run debug search
      console.log('Running Apollo debug search...');
      const debugResult = { message: "Debug search not available" };
      
      res.json({ 
        success: true, 
        connection_test: connectionTest,
        debug_result: null,
        apollo_configured: !!process.env.APOLLO_API_KEY
      });
    } catch (error) {
      console.error('Apollo test error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // NEW: Supplemental emails endpoint - fetch pattern-inferred emails for a submission
  app.get("/api/submissions/:id/supplemental-emails", requireAuth, async (req: any, res) => {
    try {
      const submissionId = parseInt(req.params.id);
      const userId = req.user.id;
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }
      
      // Verify ownership of the submission using Supabase
      const { data: submission, error: submissionError } = await supabase
        .from('job_submissions')
        .select('id, user_id')
        .eq('id', submissionId)
        .single();
        
      if (submissionError || !submission || submission.user_id !== userId) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      // Get supplemental emails for all contacts in this submission using Supabase
      const { data: supplementalEmailsRaw, error: emailsError } = await supabase
        .from('contact_emails_supplemental')
        .select(`
          recruiter_contact_id,
          email_address,
          email_type,
          verification_status,
          confidence_score,
          pattern_reasoning,
          is_verified,
          created_at,
          recruiter_contacts!inner (
            job_submission_id
          )
        `)
        .eq('recruiter_contacts.job_submission_id', submissionId)
        .order('created_at', { ascending: true });
      
      if (emailsError) {
        console.error("Error fetching supplemental emails:", emailsError);
        return res.status(500).json({ message: "Failed to fetch supplemental emails" });
      }

      // Transform to match expected response format
      const supplementalEmails = (supplementalEmailsRaw || []).map((item: any) => ({
        contactId: item.recruiter_contact_id,
        email: item.email_address,
        emailType: item.email_type,
        verificationStatus: item.verification_status,
        confidenceScore: item.confidence_score,
        patternReasoning: item.pattern_reasoning,
        isVerified: item.is_verified,
        createdAt: item.created_at,
      }));
      
      console.log(`[API] Fetched ${supplementalEmails.length} supplemental emails for submission ${submissionId}`);
      
      res.json({ 
        submissionId,
        supplementalEmails,
        totalCount: supplementalEmails.length
      });
    } catch (error) {
      console.error("Error fetching supplemental emails:", error);
      res.status(500).json({ message: "Failed to fetch supplemental emails" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
