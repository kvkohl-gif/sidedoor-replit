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
}));

export const messageTemplatesRelations = relations(messageTemplates, ({ one }) => ({
  recruiterContact: one(recruiterContacts, {
    fields: [messageTemplates.recruiterContactId],
    references: [recruiterContacts.id],
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

// Extended types with relations
export type JobSubmissionWithRecruiters = JobSubmission & {
  recruiters: RecruiterContact[];
};

export type RecruiterContactWithMessages = RecruiterContact & {
  messageTemplates: MessageTemplate[];
};
