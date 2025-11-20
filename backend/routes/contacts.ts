import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { supabase } from "../lib/supabaseClient";

export function registerContactRoutes(app: Express) {
  // Get all contacts for authenticated user
  app.get("/api/contacts/all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
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
            job_input,
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
        jobInput: contact.job_submissions?.job_input,
        submissionId: contact.job_submission_id,
        jobUrl: contact.job_submissions?.job_input,
      }));

      res.json(transformedContacts);
    } catch (error) {
      console.error("Error fetching all contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Update contact
  app.patch("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

      // Map camelCase updates to snake_case for Supabase
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.linkedinUrl !== undefined) updateData.linkedin_url = updates.linkedinUrl;
      if (updates.department !== undefined) updateData.department = updates.department;
      if (updates.seniority !== undefined) updateData.seniority = updates.seniority;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.contactStatus !== undefined) updateData.contact_status = updates.contactStatus;
      if (updates.emailDraft !== undefined) updateData.email_draft = updates.emailDraft;
      if (updates.linkedinMessage !== undefined) updateData.linkedin_message = updates.linkedinMessage;
      if (updates.generatedEmailMessage !== undefined) updateData.generated_email_message = updates.generatedEmailMessage;
      if (updates.generatedLinkedInMessage !== undefined) updateData.generated_linkedin_message = updates.generatedLinkedInMessage;
      if (updates.lastContactedAt !== undefined) updateData.last_contacted_at = updates.lastContactedAt;

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
  app.post("/api/contacts/:id/generate-message", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contactId = parseInt(req.params.id);
      const { messageType, tone } = req.body;

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

      // Generate messages (placeholder - matches original behavior)
      const emailDraft = `Hi ${contact.name},\n\nI hope this email finds you well. I recently came across the ${contact.job_submissions?.job_title || 'position'} opening at ${contact.job_submissions?.company_name || 'your company'} and I'm very interested in learning more about this opportunity.\n\nI believe my background would be a great fit for this role. Would you be available for a brief call to discuss how I can contribute to your team?\n\nBest regards,\n[Your Name]`;
      
      const linkedinMessage = `Hi ${contact.name}, I'm interested in the ${contact.job_submissions?.job_title || 'position'} at ${contact.job_submissions?.company_name || 'your company'}. Would love to connect and learn more about this opportunity!`;

      // Return the contact with generated messages (matches original response format)
      res.json({ 
        ...contact,
        emailDraft,
        linkedinMessage
      });
    } catch (error) {
      console.error("Error generating message:", error);
      res.status(500).json({ message: "Failed to generate message" });
    }
  });
}