import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  smallint,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// User identity is provided by Neon Auth (@neondatabase/neon-js). The auth
// SDK manages its own tables in the `neon_auth` schema (e.g. neon_auth.user).
// Per Neon's recommended pattern (see neon-auth-orgs-example), we DO NOT
// foreign-key into that schema — it's upstream-managed and may shift across
// SDK versions. Instead we store `user_id text` and scope every query by
// `req.auth.userId`. App-layer ownership enforcement only.

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    major: text("major"),
    educationLevel: text("education_level"),
    location: jsonb("location").$type<{
      country?: string;
      region?: string;
      city?: string;
      remoteOk?: boolean;
    }>(),
    experienceLevel: text("experience_level"),
    interests: jsonb("interests").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    currentSkills: jsonb("current_skills").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    targetIndustries: jsonb("target_industries").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    careerGoals: text("career_goals"),
    constraints: jsonb("constraints").$type<{
      schedule?: string;
      budget?: string;
      transport?: string;
      accessibility?: string;
      other?: string;
    }>(),
    preferredWorkStyle: jsonb("preferred_work_style")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdUnique: uniqueIndex("user_profiles_user_id_uq").on(t.userId),
  }),
);

export const careerRecommendations = pgTable(
  "career_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    fitReason: text("fit_reason").notNull(),
    requiredSkills: jsonb("required_skills").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    missingSkills: jsonb("missing_skills").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    suggestedProjects: jsonb("suggested_projects")
      .$type<Array<{ name: string; outline: string; estTimeWeeks?: number }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    entryRoles: jsonb("entry_roles").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    growthPath: jsonb("growth_path").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    confidenceScore: real("confidence_score").notNull().default(0),
    difficulty: text("difficulty").notNull().default("moderate"),
    tradeoffs: text("tradeoffs"),
    aiExplanation: text("ai_explanation"),
    saved: boolean("saved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("career_recs_user_idx").on(t.userId),
    savedIdx: index("career_recs_saved_idx").on(t.userId, t.saved),
  }),
);

export const opportunityRecommendations = pgTable(
  "opportunity_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    sourceId: text("source_id"),
    name: text("name").notNull(),
    organization: text("organization"),
    type: text("type").notNull(),
    description: text("description"),
    eligibility: text("eligibility"),
    deadline: timestamp("deadline", { withTimezone: true }),
    url: text("url"),
    location: text("location"),
    remote: boolean("remote").notNull().default(false),
    cost: text("cost"),
    fitReason: text("fit_reason"),
    eligibilityCheck: text("eligibility_check"),
    matchScore: real("match_score").notNull().default(0),
    applicationSteps: jsonb("application_steps")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    watchOuts: jsonb("watch_outs").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    saved: boolean("saved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("opp_recs_user_idx").on(t.userId),
    typeIdx: index("opp_recs_type_idx").on(t.type),
    savedIdx: index("opp_recs_saved_idx").on(t.userId, t.saved),
  }),
);

export const skillInsights = pgTable(
  "skill_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    mustHaveSkills: jsonb("must_have_skills")
      .$type<Array<{ skill: string; rationale: string; priority: number }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    shouldHaveSkills: jsonb("should_have_skills")
      .$type<Array<{ skill: string; rationale: string; priority: number }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    niceToHaveSkills: jsonb("nice_to_have_skills")
      .$type<Array<{ skill: string; rationale: string; priority: number }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    gaps: jsonb("gaps").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    learningResources: jsonb("learning_resources")
      .$type<
        Array<{
          skill: string;
          title: string;
          url?: string;
          kind: "course" | "book" | "tutorial" | "docs" | "video" | "project";
          estHours: number;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    certifications: jsonb("certifications")
      .$type<Array<{ name: string; why: string; optional: boolean }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    prioritizedOrder: jsonb("prioritized_order")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    confidence: real("confidence").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("skill_insights_user_idx").on(t.userId),
  }),
);

export type ActionStep = {
  action: string;
  why: string;
  estTimeHours: number;
  difficulty: "easy" | "moderate" | "hard";
  expectedOutcome: string;
  successCriteria: string;
  resources?: Array<{ label: string; url?: string }>;
  done?: boolean;
};

export const actionPlans = pgTable(
  "action_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    sevenDayPlan: jsonb("seven_day_plan").$type<ActionStep[]>().notNull().default(sql`'[]'::jsonb`),
    thirtyDayPlan: jsonb("thirty_day_plan").$type<ActionStep[]>().notNull().default(sql`'[]'::jsonb`),
    ninetyDayPlan: jsonb("ninety_day_plan").$type<ActionStep[]>().notNull().default(sql`'[]'::jsonb`),
    sixMonthPlan: jsonb("six_month_plan").$type<ActionStep[]>().notNull().default(sql`'[]'::jsonb`),
    longTermPlan: jsonb("long_term_plan").$type<ActionStep[]>().notNull().default(sql`'[]'::jsonb`),
    summary: text("summary"),
    confidence: real("confidence").notNull().default(0),
    anchorCareerId: uuid("anchor_career_id").references(() => careerRecommendations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("action_plans_user_idx").on(t.userId),
    userCreatedIdx: index("action_plans_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export const networkingMessages = pgTable(
  "networking_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    recipientType: text("recipient_type").notNull(),
    messageType: text("message_type").notNull(),
    tone: text("tone").notNull(),
    channel: text("channel").notNull().default("linkedin"),
    generatedMessage: text("generated_message").notNull(),
    alternatives: jsonb("alternatives").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    followUps: jsonb("follow_ups").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    questions: jsonb("questions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    context: jsonb("context")
      .$type<{
        recipientName?: string;
        recipientRole?: string;
        sharedConnection?: string;
        askOrGoal?: string;
      }>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("networking_messages_user_idx").on(t.userId),
  }),
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("feedback_user_idx").on(t.userId),
    targetIdx: index("feedback_target_idx").on(t.targetType, t.targetId),
  }),
);

// Cross-table relations only (user_id columns are plain text references — no
// Drizzle relation to neon_auth.* per Neon's recommended pattern).
export const careerRecommendationsRelations = relations(careerRecommendations, ({ many }) => ({
  anchoredPlans: many(actionPlans),
}));

export const actionPlansRelations = relations(actionPlans, ({ one }) => ({
  anchorCareer: one(careerRecommendations, {
    fields: [actionPlans.anchorCareerId],
    references: [careerRecommendations.id],
  }),
}));

// User identity is sourced from Neon Auth (req.auth.userId from JWT). No local users table.
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type CareerRecommendation = typeof careerRecommendations.$inferSelect;
export type NewCareerRecommendation = typeof careerRecommendations.$inferInsert;
export type OpportunityRecommendation = typeof opportunityRecommendations.$inferSelect;
export type NewOpportunityRecommendation = typeof opportunityRecommendations.$inferInsert;
export type SkillInsightRow = typeof skillInsights.$inferSelect;
export type NewSkillInsightRow = typeof skillInsights.$inferInsert;
export type ActionPlanRow = typeof actionPlans.$inferSelect;
export type NewActionPlanRow = typeof actionPlans.$inferInsert;
export type NetworkingMessageRow = typeof networkingMessages.$inferSelect;
export type NewNetworkingMessageRow = typeof networkingMessages.$inferInsert;
export type FeedbackRow = typeof feedback.$inferSelect;
export type NewFeedbackRow = typeof feedback.$inferInsert;
