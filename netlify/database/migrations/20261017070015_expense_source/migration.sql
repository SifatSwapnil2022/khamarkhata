ALTER TABLE "expenses" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
-- Treatment, vaccine and deworming costs recorded before this change go into the expense ledger,
-- so Finance counts every cost once. Vet visits are left out: farms already log those as expenses.
INSERT INTO "expenses" ("farm_id", "date", "category", "amount_tk", "animal_id", "note", "source")
SELECT h."farm_id", h."date", 'medicine', h."cost_tk", h."animal_id",
  coalesce(h."diagnosis", v."name", h."type"::text), 'health'
FROM "health_events" h LEFT JOIN "vaccines" v ON v."id" = h."vaccine_id"
WHERE h."cost_tk" > 0 AND h."type" IN ('treatment', 'vaccine', 'deworming');
