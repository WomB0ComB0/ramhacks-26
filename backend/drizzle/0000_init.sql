CREATE TABLE "action_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"seven_day_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"thirty_day_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ninety_day_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"six_month_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"long_term_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"confidence" real DEFAULT 0 NOT NULL,
	"anchor_career_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"fit_reason" text NOT NULL,
	"required_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_projects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entry_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"growth_path" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence_score" real DEFAULT 0 NOT NULL,
	"difficulty" text DEFAULT 'moderate' NOT NULL,
	"tradeoffs" text,
	"ai_explanation" text,
	"saved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "networking_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recipient_type" text NOT NULL,
	"message_type" text NOT NULL,
	"tone" text NOT NULL,
	"channel" text DEFAULT 'linkedin' NOT NULL,
	"generated_message" text NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"follow_ups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source_id" text,
	"name" text NOT NULL,
	"organization" text,
	"type" text NOT NULL,
	"description" text,
	"eligibility" text,
	"deadline" timestamp with time zone,
	"url" text,
	"location" text,
	"remote" boolean DEFAULT false NOT NULL,
	"cost" text,
	"fit_reason" text,
	"eligibility_check" text,
	"match_score" real DEFAULT 0 NOT NULL,
	"application_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"watch_outs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"saved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"must_have_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"should_have_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nice_to_have_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"learning_resources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prioritized_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"major" text,
	"education_level" text,
	"location" jsonb,
	"experience_level" text,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_industries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"career_goals" text,
	"constraints" jsonb,
	"preferred_work_style" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_anchor_career_id_career_recommendations_id_fk" FOREIGN KEY ("anchor_career_id") REFERENCES "public"."career_recommendations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_plans_user_idx" ON "action_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "action_plans_user_created_idx" ON "action_plans" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "career_recs_user_idx" ON "career_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "career_recs_saved_idx" ON "career_recommendations" USING btree ("user_id","saved");--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_target_idx" ON "feedback" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "networking_messages_user_idx" ON "networking_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "opp_recs_user_idx" ON "opportunity_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "opp_recs_type_idx" ON "opportunity_recommendations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "opp_recs_saved_idx" ON "opportunity_recommendations" USING btree ("user_id","saved");--> statement-breakpoint
CREATE INDEX "skill_insights_user_idx" ON "skill_insights" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_id_uq" ON "user_profiles" USING btree ("user_id");