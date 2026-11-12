CREATE TYPE "public"."game_status" AS ENUM('finished', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('inappropriate_drawing', 'offensive_chat', 'cheating', 'spam', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewed', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TABLE "game_players" (
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"final_score" integer DEFAULT 0 NOT NULL,
	"final_rank" smallint,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "game_players_pkey" PRIMARY KEY("game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" text NOT NULL,
	"host_id" uuid,
	"pack_id" uuid,
	"status" "game_status" NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	CONSTRAINT "games_check" CHECK ("games"."ended_at" >= "games"."started_at")
);
--> statement-breakpoint
CREATE TABLE "round_results" (
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"guessed" boolean NOT NULL,
	"guess_time_ms" integer,
	"points" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "round_results_pkey" PRIMARY KEY("round_id","user_id"),
	CONSTRAINT "round_results_guess_time_ms_check" CHECK ("round_results"."guess_time_ms" >= 0),
	CONSTRAINT "round_results_points_check" CHECK ("round_results"."points" >= 0),
	CONSTRAINT "round_results_check" CHECK ("round_results"."guessed" OR "round_results"."guess_time_ms" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_number" smallint NOT NULL,
	"turn_number" smallint NOT NULL,
	"drawer_id" uuid,
	"word_id" uuid,
	"word_text" text NOT NULL,
	"drawing_key" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rounds_game_id_round_number_turn_number_key" UNIQUE("game_id","round_number","turn_number"),
	CONSTRAINT "rounds_round_number_check" CHECK ("rounds"."round_number" >= 1),
	CONSTRAINT "rounds_turn_number_check" CHECK ("rounds"."turn_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"reported_user_id" uuid NOT NULL,
	"round_id" uuid,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "reports_details_check" CHECK (length("reports"."details") <= 1000),
	CONSTRAINT "reports_check" CHECK ("reports"."reporter_id" IS DISTINCT FROM "reports"."reported_user_id")
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identities_provider_provider_user_id_key" UNIQUE("provider","provider_user_id"),
	CONSTRAINT "auth_identities_provider_check" CHECK ("auth_identities"."provider" IN ('google', 'apple', 'guest'))
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"total_score" bigint DEFAULT 0 NOT NULL,
	"correct_guesses" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_stats_games_played_check" CHECK ("user_stats"."games_played" >= 0),
	CONSTRAINT "user_stats_games_won_check" CHECK ("user_stats"."games_won" >= 0),
	CONSTRAINT "user_stats_total_score_check" CHECK ("user_stats"."total_score" >= 0),
	CONSTRAINT "user_stats_correct_guesses_check" CHECK ("user_stats"."correct_guesses" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"is_banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_check" CHECK ("users"."username" ~ '^[a-zA-Z0-9_]{3,20}$'),
	CONSTRAINT "users_display_name_check" CHECK (length("users"."display_name") BETWEEN 1 AND 40)
);
--> statement-breakpoint
CREATE TABLE "word_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "word_packs_slug_key" UNIQUE("slug"),
	CONSTRAINT "word_packs_slug_check" CHECK ("word_packs"."slug" ~ '^[a-z0-9-]{3,50}$')
);
--> statement-breakpoint
CREATE TABLE "words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"text" text NOT NULL,
	"difficulty" smallint DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "words_text_check" CHECK (length("words"."text") BETWEEN 1 AND 40),
	CONSTRAINT "words_difficulty_check" CHECK ("words"."difficulty" BETWEEN 1 AND 3)
);
--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."word_packs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_drawer_id_fkey" FOREIGN KEY ("drawer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_packs" ADD CONSTRAINT "word_packs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "words" ADD CONSTRAINT "words_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."word_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_players_user_idx" ON "game_players" USING btree ("user_id","joined_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "games_started_at_idx" ON "games" USING btree ("started_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "games_host_idx" ON "games" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "round_results_user_idx" ON "round_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rounds_drawer_idx" ON "rounds" USING btree ("drawer_id");--> statement-breakpoint
CREATE INDEX "rounds_word_idx" ON "rounds" USING btree ("word_id");--> statement-breakpoint
CREATE INDEX "reports_open_idx" ON "reports" USING btree ("created_at") WHERE "reports"."status" = 'open';--> statement-breakpoint
CREATE INDEX "reports_reported_user_idx" ON "reports" USING btree ("reported_user_id");--> statement-breakpoint
CREATE INDEX "auth_identities_user_idx" ON "auth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_stats_leaderboard_idx" ON "user_stats" USING btree ("total_score" DESC NULLS FIRST);--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_uq" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "word_packs_creator_idx" ON "word_packs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "word_packs_public_idx" ON "word_packs" USING btree ("language") WHERE "word_packs"."visibility" = 'public';--> statement-breakpoint
CREATE UNIQUE INDEX "words_pack_text_uq" ON "words" USING btree ("pack_id",lower("text"));