CREATE TYPE "public"."check_status" AS ENUM('pending', 'success', 'not_applicable', 'not_found', 'error');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'huf', 'trust', 'society', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."flag_confidence" AS ENUM('confirmed', 'probable', 'unconfirmed');--> statement-breakpoint
CREATE TYPE "public"."flag_severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."identifier_kind" AS ENUM('gstin', 'pan', 'cin', 'udyam', 'epfo_code', 'name');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('clear', 'caution', 'adverse', 'insufficient_data');--> statement-breakpoint
CREATE TYPE "public"."verification_level" AS ENUM('verified', 'probable', 'stated', 'unavailable');--> statement-breakpoint
CREATE TABLE "assessment_checks" (
	"assessment_id" uuid NOT NULL,
	"check_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" uuid NOT NULL,
	"verdict" "verdict" NOT NULL,
	"coverage_checked" integer NOT NULL,
	"coverage_applicable" integer NOT NULL,
	"score" integer,
	"summary" text,
	"methodology_version" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" text
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"status" "check_status" DEFAULT 'pending' NOT NULL,
	"raw_response" jsonb,
	"provider" text,
	"error_message" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"trade_name" text,
	"entity_type" "entity_type" DEFAULT 'unknown' NOT NULL,
	"gstin" text,
	"pan" text,
	"cin" text,
	"udyam_number" text,
	"epfo_code" text,
	"state" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_id" uuid NOT NULL,
	"contractor_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"field_key" text NOT NULL,
	"value" jsonb,
	"verification_level" "verification_level" NOT NULL,
	"observed_at" timestamp with time zone,
	"source_reference" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" uuid NOT NULL,
	"check_id" uuid,
	"source_key" text,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "flag_severity" NOT NULL,
	"confidence" "flag_confidence" NOT NULL,
	"evidence_id" uuid,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_note" text
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" integer NOT NULL,
	"description" text,
	"applicable_entity_types" text[] NOT NULL,
	"requires_identifier" "identifier_kind" NOT NULL,
	"provider" text,
	"source_url" text,
	"is_name_matched" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_checks" ADD CONSTRAINT "assessment_checks_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_checks" ADD CONSTRAINT "assessment_checks_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_source_key_sources_key_fk" FOREIGN KEY ("source_key") REFERENCES "public"."sources"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_key_sources_key_fk" FOREIGN KEY ("source_key") REFERENCES "public"."sources"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_source_key_sources_key_fk" FOREIGN KEY ("source_key") REFERENCES "public"."sources"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_checks_pk" ON "assessment_checks" USING btree ("assessment_id","check_id");--> statement-breakpoint
CREATE INDEX "assessments_contractor_idx" ON "assessments" USING btree ("contractor_id");--> statement-breakpoint
CREATE INDEX "checks_contractor_idx" ON "checks" USING btree ("contractor_id");--> statement-breakpoint
CREATE INDEX "checks_source_idx" ON "checks" USING btree ("source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "contractors_gstin_idx" ON "contractors" USING btree ("gstin");--> statement-breakpoint
CREATE INDEX "contractors_pan_idx" ON "contractors" USING btree ("pan");--> statement-breakpoint
CREATE INDEX "contractors_legal_name_idx" ON "contractors" USING btree ("legal_name");--> statement-breakpoint
CREATE INDEX "evidence_contractor_idx" ON "evidence" USING btree ("contractor_id");--> statement-breakpoint
CREATE INDEX "evidence_check_idx" ON "evidence" USING btree ("check_id");--> statement-breakpoint
CREATE INDEX "evidence_field_idx" ON "evidence" USING btree ("field_key");--> statement-breakpoint
CREATE INDEX "flags_contractor_idx" ON "flags" USING btree ("contractor_id");--> statement-breakpoint
CREATE INDEX "flags_code_idx" ON "flags" USING btree ("code");