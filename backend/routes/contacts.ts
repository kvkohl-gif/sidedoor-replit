import type { Express, Request, Response, NextFunction } from "express";
import { supabaseAdmin as supabase } from "../lib/supabaseClient";
import { generatePersonalizedMessages } from "../personalizedMessaging";

// Session-based authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function registerContactRoutes(app: Express) {
  // Get all contacts for authenticated user
  app.get("/api/contacts/all", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Fetch all contacts for user's job submissions using Supabase
      const { data: contacts, error: fetchError } = await supabase
        .from('recruiter_contacts')
        .select(`
          id,
          name,
          title,
          email,
          linkedin_url,
          department,
          source_platform,
          confidence_score,
          recruiter_confidence,
          email_verified,
          verification_status,
          notes,
          created_at,
          job_submission_id,
          apollo_id,
          outreach_bucket,
          contact_status,
          seniority,
          generated_email_message,
          job_submissions!inner (
            job_title,
            company_name,
            user_id
          )
        `)
        .eq('job_submissions.user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(`Failed to fetch contacts: ${fetchError.message}`);
      }

      // Transform to match expected response format (camelCase for frontend)
      const transformedContacts = (contacts || []).map((contact: any) => ({
        id: contact.id,
        name: contact.name,
        title: contact.title,
        email: contact.email,
        linkedinUrl: contact.linkedin_url,
        department: contact.department,
        sourcePlatform: contact.source_platform,
        confidenceScore: contact.confidence_score,
        recruiterConfidence: contact.recruiter_confidence,
        emailVerified: contact.email_verified,
        verificationStatus: contact.verification_status,
        notes: contact.notes,
        createdAt: contact.created_at,
        jobSubmissionId: contact.job_submission_id,
        apolloId: contact.apollo_id,
        outreachBucket: contact.outreach_bucket,
        contactStatus: contact.contact_status,
        seniority: contact.seniority,
        generatedEmailMessage: contact.generated_email_message,
        jobTitle: contact.job_submissions?.job_title,
        companyName: contact.job_submissions?.company_name,
        submissionId: contact.job_submission_id,
      }));

      res.json(transformedContacts);
    } catch (error) {
      console.error("Error fetching all contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Get single contact by ID
  app.get("/api/contacts/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const contactId = parseInt(req.params.id);

      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }

      const { data: contact, error: fetchError } = await supabase
        .from('recruiter_contacts')
        .select(`
          *,
          job_submissions!inner (
            id,
            job_title,
            company_name,
            user_id
          )
        `)
        .eq('id', contactId)
        .single();

      if (fetchError || !contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const jobSubmission = Array.isArray(contact.job_submissions)
        ? contact.job_submissions[0]
        : contact.job_submissions;
      if (!jobSubmission || jobSubmission.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json({
        id: contact.id,
        jobSubmissionId: contact.job_submission_id,
        name: contact.name,
        title: contact.title,
        email: contact.email,
        linkedinUrl: contact.linkedin_url,
        department: contact.department,
        seniority: contact.seniority,
        source: contact.source,
        sourcePlatform: contact.source_platform,
        confidenceScore: contact.confidence_score,
        recruiterConfidence: contact.recruiter_confidence,
        emailVerified: contact.email_verified,
        verificationStatus: contact.verification_status,
        verificationData: contact.verification_data,
        apolloId: contact.apollo_id,
        suggestedEmail: contact.suggested_email,
        emailSuggestionReasoning: contact.email_suggestion_reasoning,
        contactStatus: contact.contact_status,
        lastContactedAt: contact.last_contacted_at,
        notes: contact.notes,
        outreachBucket: contact.outreach_bucket,
        emailDraft: contact.email_draft,
        linkedinMessage: contact.linkedin_message,
        generatedEmailMessage: contact.generated_email_message,
        generatedLinkedInMessage: contact.generated_linkedin_message,
        createdAt: contact.created_at,
        jobTitle: jobSubmission.job_title,
        companyName: jobSubmission.company_name,
      });
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  // Update contact
  app.patch("/api/contacts/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const contactId = parseInt(req.params.id);
      const updates = req.body;

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
      const jobSubmission = Array.isArray(contact.job_submissions) 
        ? contact.job_submissions[0] 
        : contact.job_submissions;
      if (!jobSubmission || jobSubmission.user_id !== userId) {
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

      // Transform snake_case response to camelCase for frontend
      const transformedContact = {
        id: updatedContact.id,
        jobSubmissionId: updatedContact.job_submission_id,
        name: updatedContact.name,
        title: updatedContact.title,
        email: updatedContact.email,
        linkedinUrl: updatedContact.linkedin_url,
        department: updatedContact.department,
        seniority: updatedContact.seniority,
        source: updatedContact.source,
        sourcePlatform: updatedContact.source_platform,
        confidenceScore: updatedContact.confidence_score,
        recruiterConfidence: updatedContact.recruiter_confidence,
        emailVerified: updatedContact.email_verified,
        verificationStatus: updatedContact.verification_status,
        verificationData: updatedContact.verification_data,
        apolloId: updatedContact.apollo_id,
        suggestedEmail: updatedContact.suggested_email,
        emailSuggestionReasoning: updatedContact.email_suggestion_reasoning,
        contactStatus: updatedContact.contact_status,
        lastContactedAt: updatedContact.last_contacted_at,
        notes: updatedContact.notes,
        outreachBucket: updatedContact.outreach_bucket,
        emailDraft: updatedContact.email_draft,
        linkedinMessage: updatedContact.linkedin_message,
        generatedEmailMessage: updatedContact.generated_email_message,
        generatedLinkedInMessage: updatedContact.generated_linkedin_message,
        createdAt: updatedContact.created_at,
        updatedAt: updatedContact.updated_at,
      };

      res.json(transformedContact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  // Generate message for contact — uses consolidated personalizedMessaging service
  app.post("/api/contacts/:id/generate-message", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const contactId = parseInt(req.params.id);

      // Fetch contact WITH job_input (job description) for full context
      const { data: contact, error: fetchError } = await supabase
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

      if (fetchError || !contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Verify user ownership
      if (contact.job_submissions.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Fetch user's outreach profile for personalization
      const { data: profile } = await supabase
        .from('user_outreach_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      const parseJsonArray = (val: any): string[] => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
        return [];
      };

      // Use consolidated service — includes job description, resume, story hooks,
      // outreach bucket differentiation, and research-backed frameworks
      const messages = await generatePersonalizedMessages({
        recruiterName: contact.name || "Hiring Manager",
        recruiterTitle: contact.title || "Recruiter",
        companyName: contact.job_submissions.company_name || "the company",
        jobTitle: contact.job_submissions.job_title || "this position",
        jobDescription: contact.job_submissions.job_input || "",
        recruiterEmail: contact.email,
        outreachBucket: contact.outreach_bucket || undefined,
        userBio: profile?.bio || undefined,
        userResume: profile?.resume_text || undefined,
        userAchievements: parseJsonArray(profile?.achievements),
        userStoryHooks: parseJsonArray(profile?.story_hooks),
        userCareerGoals: profile?.career_goals || undefined,
        userHobbies: parseJsonArray(profile?.hobbies),
        voiceFormality: profile?.voice_formality,
        voiceDirectness: profile?.voice_directness,
        voiceLength: profile?.voice_length,
        voiceNotes: profile?.voice_notes || undefined,
      });

      // Save all generated fields to the contact
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
      });
    } catch (error) {
      console.error("Error generating message:", error);
      res.status(500).json({ message: "Failed to generate message" });
    }
  });
}