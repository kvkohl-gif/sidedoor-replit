import {
  users,
  jobSubmissions,
  recruiterContacts,
  emailPatternAnalysis,
  messageTemplates,
  type User,
  type UpsertUser,
  type JobSubmission,
  type InsertJobSubmission,
  type RecruiterContact,
  type InsertRecruiterContact,
  type EmailPatternAnalysis,
  type InsertEmailPatternAnalysis,
  type MessageTemplate,
  type InsertMessageTemplate,
  type JobSubmissionWithRecruiters,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Job submission operations
  createJobSubmission(submission: InsertJobSubmission): Promise<JobSubmission>;
  getJobSubmissionsByUser(userId: string): Promise<JobSubmissionWithRecruiters[]>;
  getJobSubmissionById(id: number): Promise<JobSubmissionWithRecruiters | undefined>;
  updateJobSubmission(id: number, updates: Partial<JobSubmission>): Promise<JobSubmission>;
  
  // Recruiter contact operations
  createRecruiterContact(contact: InsertRecruiterContact): Promise<RecruiterContact>;
  createRecruiterContacts(contacts: InsertRecruiterContact[]): Promise<RecruiterContact[]>;
  getContactById(id: number): Promise<RecruiterContact | undefined>;
  updateContact(id: number, updates: Partial<RecruiterContact>): Promise<RecruiterContact>;
  
  // Email pattern analysis operations
  createEmailPatternAnalysis(analysis: InsertEmailPatternAnalysis): Promise<EmailPatternAnalysis>;
  
  // Message template operations
  createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate>;
  getMessageTemplatesByRecruiter(recruiterId: number): Promise<MessageTemplate[]>;
  getMessageTemplateById(id: number): Promise<MessageTemplate | undefined>;
  updateMessageTemplate(id: number, updates: Partial<MessageTemplate>): Promise<MessageTemplate>;
  getRecruiterById(id: number): Promise<RecruiterContact | undefined>;
  
  // Extended contact operations for global contacts page
  getAllUserContacts(userId: string): Promise<any[]>;
  generateContactMessage(contactId: number, userId: string, messageType: string, tone: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // User operations - mandatory for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Job submission operations
  async createJobSubmission(submission: InsertJobSubmission): Promise<JobSubmission> {
    const [jobSubmission] = await db
      .insert(jobSubmissions)
      .values(submission)
      .returning();
    return jobSubmission;
  }

  async getJobSubmissionsByUser(userId: string): Promise<JobSubmissionWithRecruiters[]> {
    const submissions = await db.query.jobSubmissions.findMany({
      where: eq(jobSubmissions.userId, userId),
      orderBy: [desc(jobSubmissions.submittedAt)],
      with: {
        recruiters: true,
      },
    });
    return submissions;
  }

  async getJobSubmissionById(id: number): Promise<JobSubmissionWithRecruiters | undefined> {
    const submission = await db.query.jobSubmissions.findFirst({
      where: eq(jobSubmissions.id, id),
      with: {
        recruiters: true,
      },
    });
    return submission;
  }

  async updateJobSubmission(id: number, updates: Partial<JobSubmission>): Promise<JobSubmission> {
    const [updated] = await db
      .update(jobSubmissions)
      .set(updates)
      .where(eq(jobSubmissions.id, id))
      .returning();
    return updated;
  }

  // Recruiter contact operations
  async createRecruiterContact(contact: InsertRecruiterContact): Promise<RecruiterContact> {
    const [created] = await db
      .insert(recruiterContacts)
      .values(contact)
      .returning();
    return created;
  }

  async createRecruiterContacts(contacts: InsertRecruiterContact[]): Promise<RecruiterContact[]> {
    if (contacts.length === 0) return [];
    const created = await db
      .insert(recruiterContacts)
      .values(contacts)
      .returning();
    return created;
  }

  async getContactById(id: number): Promise<RecruiterContact | undefined> {
    const [contact] = await db
      .select()
      .from(recruiterContacts)
      .where(eq(recruiterContacts.id, id));
    return contact;
  }

  async updateRecruiterContact(id: number, updates: Partial<RecruiterContact>): Promise<RecruiterContact> {
    const [updated] = await db
      .update(recruiterContacts)
      .set(updates)
      .where(eq(recruiterContacts.id, id))
      .returning();
    return updated;
  }

  // Email pattern analysis operations
  async createEmailPatternAnalysis(analysis: InsertEmailPatternAnalysis): Promise<EmailPatternAnalysis> {
    const [created] = await db
      .insert(emailPatternAnalysis)
      .values(analysis)
      .returning();
    return created;
  }

  async getEmailPatternAnalysis(jobSubmissionId: number): Promise<EmailPatternAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(emailPatternAnalysis)
      .where(eq(emailPatternAnalysis.jobSubmissionId, jobSubmissionId));
    return analysis;
  }

  // Message template operations
  async createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate> {
    const [created] = await db
      .insert(messageTemplates)
      .values(template)
      .returning();
    return created;
  }

  async getMessageTemplatesByRecruiter(recruiterId: number): Promise<MessageTemplate[]> {
    return await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.recruiterContactId, recruiterId))
      .orderBy(desc(messageTemplates.createdAt));
  }

  async getMessageTemplateById(id: number): Promise<MessageTemplate | undefined> {
    const [template] = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.id, id));
    return template;
  }

  async updateMessageTemplate(id: number, updates: Partial<MessageTemplate>): Promise<MessageTemplate> {
    const [updated] = await db
      .update(messageTemplates)
      .set(updates)
      .where(eq(messageTemplates.id, id))
      .returning();
    return updated;
  }

  async getRecruiterById(id: number): Promise<RecruiterContact | undefined> {
    const [recruiter] = await db
      .select()
      .from(recruiterContacts)
      .where(eq(recruiterContacts.id, id));
    return recruiter;
  }

  // Extended contact operations for global contacts page
  async getAllUserContacts(userId: string): Promise<any[]> {
    const contacts = await db
      .select({
        id: recruiterContacts.id,
        name: recruiterContacts.name,
        title: recruiterContacts.title,
        email: recruiterContacts.email,
        linkedinUrl: recruiterContacts.linkedinUrl,
        department: recruiterContacts.department,
        sourcePlatform: recruiterContacts.sourcePlatform,
        confidenceScore: recruiterContacts.confidenceScore,
        recruiterConfidence: recruiterContacts.recruiterConfidence,
        emailVerified: recruiterContacts.emailVerified,
        verificationStatus: recruiterContacts.verificationStatus,
        notes: recruiterContacts.notes,
        createdAt: recruiterContacts.createdAt,
        jobSubmissionId: recruiterContacts.jobSubmissionId,
        // userId: recruiterContacts.userId, // This field doesn't exist in schema
        apolloId: recruiterContacts.apolloId,
        jobTitle: jobSubmissions.jobTitle,
        companyName: jobSubmissions.companyName,
        jobInput: jobSubmissions.jobInput,
      })
      .from(recruiterContacts)
      .leftJoin(jobSubmissions, eq(recruiterContacts.jobSubmissionId, jobSubmissions.id))
      .where(eq(jobSubmissions.userId, userId))
      .orderBy(desc(recruiterContacts.createdAt));

    // Transform to include job submission details
    return contacts.map(contact => ({
      ...contact,
      submissionId: contact.jobSubmissionId,
      jobUrl: contact.jobInput,
    }));
  }

  async updateContact(id: number, updates: Partial<RecruiterContact>): Promise<RecruiterContact>;
  async updateContact(contactId: number, userId: string, updates: any): Promise<any>;
  async updateContact(contactId: number, userId?: string | any, updates?: any): Promise<any> {
    // Handle overloaded signatures
    if (typeof userId === 'object' && updates === undefined) {
      updates = userId;
      userId = undefined;
    }
    // First verify the contact belongs to the user
    const [contact] = await db
      .select()
      .from(recruiterContacts)
      .where(eq(recruiterContacts.id, contactId));

    // Get the associated job submission to check user ownership
    const [jobSub] = await db
      .select()
      .from(jobSubmissions)
      .where(eq(jobSubmissions.id, contact.jobSubmissionId));
    
    if (!contact || !jobSub || jobSub.userId !== userId) {
      throw new Error("Contact not found or access denied");
    }

    const [updated] = await db
      .update(recruiterContacts)
      .set(updates)
      .where(eq(recruiterContacts.id, contactId))
      .returning();
    
    return updated;
  }

  async generateContactMessage(contactId: number, userId: string, messageType: string, tone: string): Promise<any> {
    // First verify the contact belongs to the user  
    const contactQuery = await db
      .select()
      .from(recruiterContacts)
      .leftJoin(jobSubmissions, eq(recruiterContacts.jobSubmissionId, jobSubmissions.id))
      .where(eq(recruiterContacts.id, contactId));

    if (contactQuery.length === 0) {
      throw new Error("Contact not found");
    }

    const contact = contactQuery[0].recruiter_contacts;
    const jobSubmission = contactQuery[0].job_submissions;

    // Get the associated job submission to check user ownership
    const jobSub = contactQuery[0].job_submissions;
    
    if (!jobSub || jobSub.userId !== userId) {
      throw new Error("Access denied");
    }

    // For now, return placeholder messages - you can integrate with OpenAI later
    const emailDraft = `Hi ${contact.name},\n\nI hope this email finds you well. I recently came across the ${jobSubmission?.jobTitle || 'position'} opening at ${jobSubmission?.companyName || 'your company'} and I'm very interested in learning more about this opportunity.\n\nI believe my background would be a great fit for this role. Would you be available for a brief call to discuss how I can contribute to your team?\n\nBest regards,\n[Your Name]`;
    
    const linkedinMessage = `Hi ${contact.name}, I'm interested in the ${jobSubmission?.jobTitle || 'position'} at ${jobSubmission?.companyName || 'your company'}. Would love to connect and learn more about this opportunity!`;

    // Update the contact with generated messages
    const [updated] = await db
      .update(recruiterContacts)
      .set({
        notes: contact.notes || "",
      })
      .where(eq(recruiterContacts.id, contactId))
      .returning();

    return { ...updated, emailDraft, linkedinMessage };
  }
}

export const storage = new DatabaseStorage();
