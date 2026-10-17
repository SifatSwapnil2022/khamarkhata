import { getDb } from "@/db";
import { can, type Permission } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { bdToday } from "@/server/common";
import { EXPORTS, exportRows, resolvePeriod, toCsv, type ExportKind } from "@/server/finance";

const NEEDS: Record<ExportKind, Permission> = {
  animals: "animal.view",
  milk: "animal.view",
  health: "animal.view",
  weights: "animal.view",
  "milk-sales": "milk.sales",
  expenses: "finance.view",
};

/** CSV download of one kind of record for the current farm, e.g. /app/export/milk?period=30d */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!EXPORTS.includes(kind as ExportKind)) return new Response("Unknown export", { status: 404 });
  const ctx = await requireFarm();
  if (!can(ctx.role, NEEDS[kind as ExportKind])) return new Response("Your role can't export this.", { status: 403 });
  const url = new URL(req.url);
  const { from, to } = resolvePeriod(Object.fromEntries(url.searchParams), bdToday());
  const rows = await exportRows(await getDb(), ctx.farm.id, kind as ExportKind, from, to);
  const slug = ctx.farm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "farm";
  const name = kind === "animals" ? `${slug}-animals.csv` : `${slug}-${kind}-${from}-to-${to}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
