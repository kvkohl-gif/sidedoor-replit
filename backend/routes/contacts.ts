import type { Express, Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabaseClient";
import { callClaude } from "../claude";

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

      // Fetch user's outreach profile for personalization
      const { data: profile } = await supabase
        .from('user_outreach_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Build personalization context from outreach profile
      const bio = profile?.bio?.trim() || '';
      const achievements = (() => {
        try {
          const arr = typeof profile?.achievements === 'string' ? JSON.parse(profile.achievements) : (profile?.achievements || []);
          return Array.isArray(arr) ? arr : [];
        } catch { return []; }
      })();
      const storyHooks = (() => {
        try {
          const arr = typeof profile?.story_hooks === 'string' ? JSON.parse(profile.story_hooks) : (profile?.story_hooks || []);
          return Array.isArray(arr) ? arr : [];
        } catch { return []; }
      })();
      const careerGoals = profile?.career_goals?.trim() || '';
      const voiceFormality = profile?.voice_formality ?? 0.5;
      const voiceDirectness = profile?.voice_directness ?? 0.5;
      const voiceLength = profile?.voice_length ?? 0.3;
      const voiceNotes = profile?.voice_notes?.trim() || '';

      // Build voice instruction
      const voiceInstruction = [
        voiceFormality < 0.3 ? 'Use a casual, conversational tone.' : voiceFormality > 0.7 ? 'Use a formal, polished tone.' : '',
        voiceDirectness > 0.7 ? 'Be direct and get to the point quickly.' : voiceDirectness < 0.3 ? 'Be warm and build rapport before the ask.' : '',
        voiceLength > 0.6 ? 'Write at full length with detail.' : voiceLength < 0.2 ? 'Keep it extremely brief.' : 'Keep it concise.',
        voiceNotes ? `Additional voice notes: ${voiceNotes}` : ''
      ].filter(Boolean).join(' ');

      // Build profile context block
      const profileContext = [
        bio ? `About me: ${bio}` : '',
        achievements.length > 0 ? `Key achievements:\n${achievements.slice(0, 3).map((a: string) => `- ${a}`).join('\n')}` : '',
        storyHooks.length > 0 ? `Personal hooks for rapport: ${storyHooks.slice(0, 2).join('; ')}` : '',
        careerGoals ? `Career goals: ${careerGoals}` : ''
      ].filter(Boolean).join('\n\n');

      // Generate message using Claude with outreach profile context
      const contactName = contact.name || "the recruiter";
      const contactTitle = contact.title || "Unknown Title";
      const companyName = contact.job_submissions.company_name || "the company";
      const jobTitle = contact.job_submissions.job_title || "the position";

      const prompt = messageType === "email"
        ? `Write an outreach email to ${contactName} (${contactTitle}) about the ${jobTitle} role at ${companyName}.

STRUCTURE (exactly 3 short paragraphs, 75-125 words total):
1. Personal hook — reference a shared connection, something specific about ${companyName}, or a story hook. Make it feel human, not templated.
2. Value match — mention 1-2 specific experiences or achievements that directly map to this role. Don't list your resume, pick the most relevant wins.
3. Soft CTA — express interest in chatting, don't ask them to "review your resume" or "consider your application."

${profileContext ? `\nABOUT THE SENDER:\n${profileContext}` : ''}

${voiceInstruction}

RULES:
- No subject line (will be generated separately)
- Do NOT start with "I hope this email finds you well" or any cliche opener
- Do NOT use "I am writing to express my interest..."
- First name only for greeting (Hi ${contactName.split(' ')[0]},)
- Sign off with just "Best," and the sender's name (leave as [Your Name])`
        : `Write a LinkedIn connection request message to ${contactName} (${contactTitle}) about the ${jobTitle} role at ${companyName}.

RULES:
- Under 200 characters (LinkedIn limit)
- One sentence max, conversational
- Reference something specific about the role or company
- End with a question to invite response
${storyHooks.length > 0 ? `- Try to use one of these hooks: ${storyHooks[0]}` : ''}
${voiceInstruction}`;

      const systemPrompt = `You write authentic, high-converting outreach messages for job seekers. Your messages sound like a real person wrote them — not a template. You never use corporate jargon, cliches, or generic phrases. Every message includes something specific to the recipient, the company, or the role.`;

      const generatedMessage = await callClaude({
        system: systemPrompt,
        user: prompt,
        temperature: 0.7,
        maxTokens: messageType === "email" ? 500 : 150,
      });

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