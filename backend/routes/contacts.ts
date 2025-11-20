import type { Express, Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabaseClient";
import OpenAI from "openai";

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
          job_submissions!inner (
            job_title,
            company_name,
            job_url,
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
        jobTitle: contact.job_submissions?.job_title,
        companyName: contact.job_submissions?.company_name,
        jobUrl: contact.job_submissions?.job_url,
        submissionId: contact.job_submission_id,
      }));

      res.json(transformedContacts);
    } catch (error) {
      console.error("Error fetching all contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
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

  // Generate message for contact
  app.post("/api/contacts/:id/generate-message", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const contactId = parseInt(req.params.id);
      const { messageType, tone = "professional" } = req.body;

      // Fetch contact and verify user ownership via job submission using Supabase
      const { data: contact, error: fetchError } = await supabase
        .from('recruiter_contacts')
        .select(`
          *,
          job_submissions!inner (
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

      // Verify user ownership
      if (contact.job_submissions.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Generate message using OpenAI GPT-4o
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const prompt = messageType === "email" 
        ? `Generate a professional ${tone} email to ${contact.name || "the recruiter"} (${contact.title || "Unknown Title"}) about the ${contact.job_submissions.job_title || "position"} at ${contact.job_submissions.company_name || "the company"}. 

Keep it concise (under 150 words), personalized, and include:
- Brief introduction
- Specific interest in the role
- Relevant qualifications
- Request for discussion

Contact: ${contact.name || "Unknown"} - ${contact.title || "Unknown Title"}
Company: ${contact.job_submissions.company_name || "Unknown Company"}
Job: ${contact.job_submissions.job_title || "Unknown Position"}

Email tone: ${tone}`
        : `Generate a professional ${tone} LinkedIn message to ${contact.name || "the recruiter"} (${contact.title || "Unknown Title"}) about the ${contact.job_submissions.job_title || "position"} at ${contact.job_submissions.company_name || "the company"}.

Keep it under 300 characters for LinkedIn limits, personalized and include:
- Brief introduction
- Interest in the role
- Request to connect

Contact: ${contact.name || "Unknown"} - ${contact.title || "Unknown Title"}
Company: ${contact.job_submissions.company_name || "Unknown Company"}
Job: ${contact.job_submissions.job_title || "Unknown Position"}

LinkedIn message tone: ${tone}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
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

      // Update contact with generated message using Supabase
      const updateData: any = {};
      
      if (messageType === "email") {
        updateData.generated_email_message = generatedMessage;
        updateData.email_draft = generatedMessage;
      } else {
        updateData.generated_linkedin_message = generatedMessage;
        updateData.linkedin_message = generatedMessage;
      }
      
      await supabase
        .from('recruiter_contacts')
        .update(updateData)
        .eq('id', contactId);

      res.json({ message: generatedMessage });
    } catch (error) {
      console.error("Error generating message:", error);
      res.status(500).json({ message: "Failed to generate message" });
    }
  });
}