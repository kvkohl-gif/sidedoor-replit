import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - mandatory for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobSubmissions = pgTable("job_submissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  jobInput: text("job_input").notNull(),
  inputType: varchar("input_type").notNull(), // "text" or "url"
  openaiResponseRaw: text("openai_response_raw"),
  emailDraft: text("email_draft"),
  linkedinMessage: text("linkedin_message"),
  companyName: varchar("company_name"),
  jobTitle: varchar("job_title"),
  organizationId: varchar("organization_id"), // Apollo organization ID for precise matching
  companyDomain: varchar("company_domain"), // Company domain from Apollo or manual entry
  status: varchar("status").default("not_contacted"), // not_contacted, email_sent, awaiting_reply, follow_up_needed, rejected, interview_scheduled
  notes: text("notes"), // Job-level notes
  lastContactedAt: timestamp("last_contacted_at"), // When user last contacted someone for this job
  lastContactedRecruiter: varchar("last_contacted_recruiter"), // Name of last contacted recruiter
  isArchived: varchar("is_archived").default("false"), // Archive status
  snoozeUntil: timestamp("snooze_until"), // Snooze date
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const recruiterContacts = pgTable("recruiter_contacts", {
  id: serial("id").primaryKey(),
  jobSubmissionId: integer("job_submission_id").notNull().references(() => jobSubmissions.id),
  name: varchar("name"),
  title: varchar("title"),
  email: varchar("email"),
  linkedinUrl: varchar("linkedin_url"),
  confidenceScore: real("confidence_score"),
  source: varchar("source").default("OpenAI"),
  emailVerified: varchar("email_verified").default("false"),
  verificationStatus: varchar("verification_status").default("unknown"), // valid, risky, invalid, unknown
  sourcePlatform: varchar("source_platform").default("openai"), // openai, apollo, zoominfo, clay
  apolloId: varchar("apollo_id"), // Apollo contact ID for future reference
  recruiterConfidence: real("recruiter_confidence").default(0.0), // 0.0 to 1.0 confidence score
  verificationData: jsonb("verification_data"), // Store full verification response
  suggestedEmail: varchar("suggested_email"), // AI-suggested email alternative
  emailSuggestionReasoning: text("email_suggestion_reasoning"), // Explanation for suggestion
  contactStatus: varchar("contact_status").default("not_contacted"), // not_contacted, email_sent, awaiting_reply, follow_up_needed, rejected, interview_scheduled
  lastContactedAt: timestamp("last_contacted_at"), // When this specific contact was last reached out to
  notes: text("notes"), // Contact-specific notes
  // New fields for two-bucket outreach system
  outreachBucket: varchar("outreach_bucket").default("recruiter"), // "recruiter" or "department_lead"
  department: varchar("department"), // Department for department_lead bucket
  seniority: varchar("seniority"), // Seniority level for department_lead bucket
  // Generated message fields
  generatedEmailMessage: text("generated_email_message"), // AI-generated email content
  generatedLinkedInMessage: text("generated_linkedin_message"), // AI-generated LinkedIn content
  emailDraft: text("email_draft"), // Alternative email field name
  linkedinMessage: text("linkedin_message"), // Alternative LinkedIn field name
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailPatternAnalysis = pgTable("email_pattern_analysis", {
  id: serial("id").primaryKey(),
  jobSubmissionId: integer("job_submission_id").notNull().references(() => jobSubmissions.id),
  verifiedPattern: varchar("verified_pattern"),
  analysisSummary: text("analysis_summary"),
  suggestionsCount: integer("suggestions_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageTemplates = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  recruiterContactId: integer("recruiter_contact_id").notNull().references(() => recruiterContacts.id),
  messageType: varchar("message_type").notNull(), // "email" or "linkedin"
  subject: varchar("subject"), // For emails
  content: text("content").notNull(),
  version: varchar("version").default("v1"), // v1, v2, custom_draft_a, etc.
  isSent: varchar("is_sent").default("false"), // Whether this version was marked as sent
  sentAt: timestamp("sent_at"), // When it was marked as sent
  createdAt: timestamp("created_at").defaultNow(),
});

// NEW: Supplemental email tables for pattern inference
export const contactEmailsSupplemental = pgTable("contact_emails_supplemental", {
  id: serial("id").primaryKey(),
  recruiterContactId: integer("recruiter_contact_id").notNull().references(() => recruiterContacts.id),
  emailAddress: varchar("email_address").notNull(),
  emailType: varchar("email_type").default("pattern_inferred"), // Only pattern-inferred emails
  verificationStatus: varchar("verification_status").default("unknown"), // valid, risky, invalid, unknown
  verificationData: jsonb("verification_data"), // Full NeverBounce response
  confidenceScore: real("confidence_score"), // Pattern confidence 0.0 to 1.0
  patternReasoning: text("pattern_reasoning"), // Why this pattern was chosen
  isVerified: varchar("is_verified").default("false"), // NeverBounce verified
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companyEmailPatterns = pgTable("company_email_patterns", {
  id: serial("id").primaryKey(),
  jobSubmissionId: integer("job_submission_id").notNull().references(() => jobSubmissions.id),
  companyDomain: varchar("company_domain").notNull(),
  detectedPattern: varchar("detected_pattern"), // e.g., "firstname.lastname"
  patternConfidence: real("pattern_confidence"), // 0.0 to 1.0
  validEmailSampleCount: integer("valid_email_sample_count"), // Number of valid emails used for analysis
  lastAnalyzed: timestamp("last_analyzed").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  jobSubmissions: many(jobSubmissions),
}));

export const jobSubmissionsRelations = relations(jobSubmissions, ({ one, many }) => ({
  user: one(users, {
    fields: [jobSubmissions.userId],
    references: [users.id],
  }),
  recruiters: many(recruiterContacts),
}));

export const recruiterContactsRelations = relations(recruiterContacts, ({ one, many }) => ({
  jobSubmission: one(jobSubmissions, {
    fields: [recruiterContacts.jobSubmissionId],
    references: [jobSubmissions.id],
  }),
  messageTemplates: many(messageTemplates),
  supplementalEmails: many(contactEmailsSupplemental), // NEW: Supplemental emails
}));

export const messageTemplatesRelations = relations(messageTemplates, ({ one }) => ({
  recruiterContact: one(recruiterContacts, {
    fields: [messageTemplates.recruiterContactId],
    references: [recruiterContacts.id],
  }),
}));

// NEW: Relations for supplemental email tables
export const contactEmailsSupplementalRelations = relations(contactEmailsSupplemental, ({ one }) => ({
  recruiterContact: one(recruiterContacts, {
    fields: [contactEmailsSupplemental.recruiterContactId],
    references: [recruiterContacts.id],
  }),
}));

export const companyEmailPatternsRelations = relations(companyEmailPatterns, ({ one }) => ({
  jobSubmission: one(jobSubmissions, {
    fields: [companyEmailPatterns.jobSubmissionId],
    references: [jobSubmissions.id],
  }),
}));

// Insert schemas
export const insertJobSubmissionSchema = createInsertSchema(jobSubmissions).omit({
  id: true,
  submittedAt: true,
});

export const insertRecruiterContactSchema = createInsertSchema(recruiterContacts).omit({
  id: true,
});

export const insertEmailPatternAnalysisSchema = createInsertSchema(emailPatternAnalysis).omit({
  id: true,
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
});

// NEW: Insert schemas for supplemental email tables
export const insertContactEmailSupplementalSchema = createInsertSchema(contactEmailsSupplemental).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyEmailPatternSchema = createInsertSchema(companyEmailPatterns).omit({
  id: true,
  createdAt: true,
  lastAnalyzed: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type JobSubmission = typeof jobSubmissions.$inferSelect;
export type InsertJobSubmission = z.infer<typeof insertJobSubmissionSchema>;
export type RecruiterContact = typeof recruiterContacts.$inferSelect;
export type InsertRecruiterContact = z.infer<typeof insertRecruiterContactSchema>;
export type EmailPatternAnalysis = typeof emailPatternAnalysis.$inferSelect;
export type InsertEmailPatternAnalysis = z.infer<typeof insertEmailPatternAnalysisSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;

// NEW: Types for supplemental email tables
export type ContactEmailSupplemental = typeof contactEmailsSupplemental.$inferSelect;
export type InsertContactEmailSupplemental = z.infer<typeof insertContactEmailSupplementalSchema>;
export type CompanyEmailPattern = typeof companyEmailPatterns.$inferSelect;
export type InsertCompanyEmailPattern = z.infer<typeof insertCompanyEmailPatternSchema>;

// Extended types with relations
export type JobSubmissionWithRecruiters = JobSubmission & {
  recruiters: RecruiterContact[];
};

export type RecruiterContactWithMessages = RecruiterContact & {
  messageTemplates: MessageTemplate[];
};

// NEW: Extended type with supplemental emails
export type RecruiterContactWithSupplementalEmails = RecruiterContact & {
  supplementalEmails: ContactEmailSupplemental[];
};
