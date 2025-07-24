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

export const recruiterContactsRelations = relations(recruiterContacts, ({ one }) => ({
  jobSubmission: one(jobSubmissions, {
    fields: [recruiterContacts.jobSubmissionId],
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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type JobSubmission = typeof jobSubmissions.$inferSelect;
export type InsertJobSubmission = z.infer<typeof insertJobSubmissionSchema>;
export type RecruiterContact = typeof recruiterContacts.$inferSelect;
export type InsertRecruiterContact = z.infer<typeof insertRecruiterContactSchema>;

// Extended types with relations
export type JobSubmissionWithRecruiters = JobSubmission & {
  recruiters: RecruiterContact[];
};
