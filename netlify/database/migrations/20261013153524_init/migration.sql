CREATE TYPE "breeding_type" AS ENUM('heat', 'service', 'pregnancy_check', 'calving', 'abortion', 'dry_off');--> statement-breakpoint
CREATE TYPE "buyer_kind" AS ENUM('collector', 'sweet_shop', 'direct', 'other');--> statement-breakpoint
CREATE TYPE "calving_ease" AS ENUM('normal', 'assisted', 'difficult', 'caesarean');--> statement-breakpoint
CREATE TYPE "expense_category" AS ENUM('feed', 'medicine', 'vet', 'labour', 'utilities', 'transport', 'equipment', 'animal_purchase', 'other');--> statement-breakpoint
CREATE TYPE "health_type" AS ENUM('vaccine', 'deworming', 'treatment', 'vet_visit', 'observation');--> statement-breakpoint
CREATE TYPE "inquiry_status" AS ENUM('new', 'replied', 'closed');--> statement-breakpoint
CREATE TYPE "invite_status" AS ENUM('pending', 'accepted', 'declined', 'revoked');--> statement-breakpoint
CREATE TYPE "lifecycle" AS ENUM('active', 'sold', 'dead', 'culled');--> statement-breakpoint
CREATE TYPE "listing_category" AS ENUM('qurbani', 'milking_cow', 'heifer', 'breeding_bull', 'other');--> statement-breakpoint
CREATE TYPE "listing_status" AS ENUM('draft', 'active', 'sold', 'withdrawn');--> statement-breakpoint
CREATE TYPE "milk_session" AS ENUM('am', 'pm');--> statement-breakpoint
CREATE TYPE "origin" AS ENUM('born', 'purchased');--> statement-breakpoint
CREATE TYPE "pd_result" AS ENUM('positive', 'negative', 'uncertain');--> statement-breakpoint
CREATE TYPE "purpose" AS ENUM('dairy', 'breeding', 'qurbani', 'calf', 'other');--> statement-breakpoint
CREATE TYPE "role" AS ENUM('owner', 'manager', 'worker', 'vet');--> statement-breakpoint
CREATE TYPE "segment" AS ENUM('dairy', 'breeding', 'qurbani');--> statement-breakpoint
CREATE TYPE "service_method" AS ENUM('ai', 'natural');--> statement-breakpoint
CREATE TYPE "sex" AS ENUM('female', 'male');--> statement-breakpoint
CREATE TYPE "species" AS ENUM('cattle', 'buffalo', 'goat', 'sheep');--> statement-breakpoint
CREATE TYPE "weigh_method" AS ENUM('scale', 'tape');--> statement-breakpoint
CREATE TABLE "animal_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"url" text NOT NULL,
	"kind" text DEFAULT 'photo' NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"listing_id" uuid,
	"date" date NOT NULL,
	"buyer_name" text,
	"buyer_phone" text,
	"price_tk" integer NOT NULL,
	"weight_kg" numeric(6,1),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"tag" text NOT NULL,
	"govt_id" text,
	"name" text,
	"name_bn" text,
	"species" "species" DEFAULT 'cattle'::"species" NOT NULL,
	"sex" "sex" NOT NULL,
	"breed_id" uuid,
	"breed_label" text,
	"breed_percent" integer,
	"color" text,
	"birth_date" date,
	"birth_date_estimated" boolean DEFAULT false NOT NULL,
	"origin" "origin" NOT NULL,
	"purchase_date" date,
	"purchase_price_tk" integer,
	"purchased_from" text,
	"dam_id" uuid,
	"sire_animal_id" uuid,
	"sire_id" uuid,
	"shed_id" uuid,
	"purpose" "purpose" NOT NULL,
	"lifecycle" "lifecycle" DEFAULT 'active'::"lifecycle" NOT NULL,
	"exit_date" date,
	"exit_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "breeding_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"type" "breeding_type" NOT NULL,
	"date" date NOT NULL,
	"method" "service_method",
	"sire_id" uuid,
	"sire_animal_id" uuid,
	"technician" text,
	"pd_result" "pd_result",
	"calving_ease" "calving_ease",
	"calf_id" uuid,
	"notes" text,
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "breeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"species" "species" NOT NULL,
	"name" text NOT NULL,
	"name_bn" text,
	"is_local" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"kind" "buyer_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"date" date NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount_tk" integer NOT NULL,
	"animal_id" uuid,
	"shed_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"district" text NOT NULL,
	"upazila" text,
	"segments" "segment"[] NOT NULL,
	"settings" jsonb DEFAULT '{"heatCycleDays":21,"pregnancyCheckDays":75,"gestationDays":283,"dryOffDaysBeforeCalving":60,"milkUnitPriceTk":null}' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fattening_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"season_year" integer NOT NULL,
	"start_date" date NOT NULL,
	"start_weight_kg" numeric(6,1) NOT NULL,
	"target_weight_kg" numeric(6,1) NOT NULL,
	"price_per_kg_tk" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shed_id" uuid,
	"animal_id" uuid,
	"item" text NOT NULL,
	"quantity_kg" numeric(8,2) NOT NULL,
	"cost_tk" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"type" "health_type" NOT NULL,
	"date" date NOT NULL,
	"vaccine_id" uuid,
	"batch_no" text,
	"diagnosis" text,
	"drug" text,
	"dose" text,
	"vet_name" text,
	"milk_withdrawal_until" date,
	"meat_withdrawal_until" date,
	"next_due_date" date,
	"cost_tk" integer,
	"notes" text,
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"listing_id" uuid NOT NULL,
	"buyer_user_id" uuid,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"message" text,
	"status" "inquiry_status" DEFAULT 'new'::"inquiry_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"role" "role" NOT NULL,
	"invited_by_id" uuid NOT NULL,
	"status" "invite_status" DEFAULT 'pending'::"invite_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"category" "listing_category" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price_tk" integer,
	"negotiable" boolean DEFAULT true NOT NULL,
	"district" text NOT NULL,
	"status" "listing_status" DEFAULT 'draft'::"listing_status" NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milk_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"date" date NOT NULL,
	"session" "milk_session" NOT NULL,
	"litres" numeric(5,2) NOT NULL,
	"under_withdrawal" boolean DEFAULT false NOT NULL,
	"client_id" text UNIQUE,
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milk_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"buyer_id" uuid,
	"date" date NOT NULL,
	"litres" numeric(7,2) NOT NULL,
	"price_per_litre_tk" numeric(7,2) NOT NULL,
	"amount_tk" integer NOT NULL,
	"paid_tk" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"farm_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"due_date" date,
	"dedupe_key" text NOT NULL UNIQUE,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"ip" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_listings" (
	"user_id" uuid,
	"listing_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_listings_pkey" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"active_farm_id" uuid,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sheds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text,
	"breed_label" text,
	"source" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"phone" text NOT NULL UNIQUE,
	"name" text,
	"email" text,
	"locale" text DEFAULT 'bn' NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vaccines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid,
	"species" "species" DEFAULT 'cattle'::"species" NOT NULL,
	"name" text NOT NULL,
	"name_bn" text,
	"is_deworming" boolean DEFAULT false NOT NULL,
	"default_interval_days" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weigh_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"date" date NOT NULL,
	"weight_kg" numeric(6,1) NOT NULL,
	"method" "weigh_method" NOT NULL,
	"heart_girth_cm" numeric(5,1),
	"body_length_cm" numeric(5,1),
	"body_condition_score" numeric(2,1),
	"client_id" text UNIQUE,
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "animals_farm_id_tag_index" ON "animals" ("farm_id","tag");--> statement-breakpoint
CREATE INDEX "animals_farm_id_lifecycle_index" ON "animals" ("farm_id","lifecycle");--> statement-breakpoint
CREATE INDEX "animals_dam_id_index" ON "animals" ("dam_id");--> statement-breakpoint
CREATE INDEX "animals_sire_animal_id_index" ON "animals" ("sire_animal_id");--> statement-breakpoint
CREATE INDEX "audit_logs_farm_id_created_at_index" ON "audit_logs" ("farm_id","created_at");--> statement-breakpoint
CREATE INDEX "breeding_events_animal_id_date_index" ON "breeding_events" ("animal_id","date");--> statement-breakpoint
CREATE INDEX "breeding_events_farm_id_type_date_index" ON "breeding_events" ("farm_id","type","date");--> statement-breakpoint
CREATE INDEX "expenses_farm_id_date_index" ON "expenses" ("farm_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "fattening_plans_animal_id_season_year_index" ON "fattening_plans" ("animal_id","season_year");--> statement-breakpoint
CREATE INDEX "health_events_farm_id_next_due_date_index" ON "health_events" ("farm_id","next_due_date");--> statement-breakpoint
CREATE INDEX "health_events_animal_id_date_index" ON "health_events" ("animal_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_one_pending_per_phone" ON "invites" ("farm_id","phone") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "invites_phone_status_index" ON "invites" ("phone","status");--> statement-breakpoint
CREATE INDEX "listings_status_category_district_index" ON "listings" ("status","category","district");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_farm_id_user_id_index" ON "memberships" ("farm_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_index" ON "memberships" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "milk_records_animal_id_date_session_index" ON "milk_records" ("animal_id","date","session");--> statement-breakpoint
CREATE INDEX "milk_records_farm_id_date_index" ON "milk_records" ("farm_id","date");--> statement-breakpoint
CREATE INDEX "milk_sales_farm_id_date_index" ON "milk_sales" ("farm_id","date");--> statement-breakpoint
CREATE INDEX "notifications_user_id_read_at_index" ON "notifications" ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "otp_codes_phone_created_at_index" ON "otp_codes" ("phone","created_at");--> statement-breakpoint
CREATE INDEX "otp_codes_ip_created_at_index" ON "otp_codes" ("ip","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "weigh_ins_animal_id_date_index" ON "weigh_ins" ("animal_id","date");--> statement-breakpoint
ALTER TABLE "animal_media" ADD CONSTRAINT "animal_media_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_media" ADD CONSTRAINT "animal_media_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_sales" ADD CONSTRAINT "animal_sales_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_sales" ADD CONSTRAINT "animal_sales_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_sales" ADD CONSTRAINT "animal_sales_listing_id_listings_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_breed_id_breeds_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "breeds"("id");--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_dam_id_animals_id_fkey" FOREIGN KEY ("dam_id") REFERENCES "animals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_sire_animal_id_animals_id_fkey" FOREIGN KEY ("sire_animal_id") REFERENCES "animals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_sire_id_sires_id_fkey" FOREIGN KEY ("sire_id") REFERENCES "sires"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_shed_id_sheds_id_fkey" FOREIGN KEY ("shed_id") REFERENCES "sheds"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "breeding_events" ADD CONSTRAINT "breeding_events_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "breeding_events" ADD CONSTRAINT "breeding_events_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "breeding_events" ADD CONSTRAINT "breeding_events_sire_id_sires_id_fkey" FOREIGN KEY ("sire_id") REFERENCES "sires"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "breeding_events" ADD CONSTRAINT "breeding_events_sire_animal_id_animals_id_fkey" FOREIGN KEY ("sire_animal_id") REFERENCES "animals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "breeding_events" ADD CONSTRAINT "breeding_events_calf_id_animals_id_fkey" FOREIGN KEY ("calf_id") REFERENCES "animals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "breeding_events" ADD CONSTRAINT "breeding_events_recorded_by_id_users_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shed_id_sheds_id_fkey" FOREIGN KEY ("shed_id") REFERENCES "sheds"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "fattening_plans" ADD CONSTRAINT "fattening_plans_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fattening_plans" ADD CONSTRAINT "fattening_plans_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feed_logs" ADD CONSTRAINT "feed_logs_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feed_logs" ADD CONSTRAINT "feed_logs_shed_id_sheds_id_fkey" FOREIGN KEY ("shed_id") REFERENCES "sheds"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "feed_logs" ADD CONSTRAINT "feed_logs_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_vaccine_id_vaccines_id_fkey" FOREIGN KEY ("vaccine_id") REFERENCES "vaccines"("id");--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_recorded_by_id_users_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_listing_id_listings_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_buyer_user_id_users_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_id_users_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "milk_records" ADD CONSTRAINT "milk_records_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "milk_records" ADD CONSTRAINT "milk_records_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "milk_records" ADD CONSTRAINT "milk_records_recorded_by_id_users_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "milk_sales" ADD CONSTRAINT "milk_sales_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "milk_sales" ADD CONSTRAINT "milk_sales_buyer_id_buyers_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listing_id_listings_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_farm_id_farms_id_fkey" FOREIGN KEY ("active_farm_id") REFERENCES "farms"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sheds" ADD CONSTRAINT "sheds_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sires" ADD CONSTRAINT "sires_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "vaccines" ADD CONSTRAINT "vaccines_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "weigh_ins" ADD CONSTRAINT "weigh_ins_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "weigh_ins" ADD CONSTRAINT "weigh_ins_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "weigh_ins" ADD CONSTRAINT "weigh_ins_recorded_by_id_users_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id");